// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The regulatory landscape report PDF. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  RegulatoryLandscapeReport,
  type RegulatoryLandscapeData,
  type AppliedJurisdiction,
  type TransferExposure,
  type VendorExposure,
} from "@/server/services/export/regulatory-landscape-report";
import { JURISDICTION_CATALOG, localizeJurisdiction } from "@/config/jurisdiction-catalog";
import { EU_ADEQUATE_COUNTRIES } from "@/config/vendor-data-mappings";
import { adequacyCoverage, getAdequacyDecision } from "@/config/transfer-compliance-rules";
import { canonicalCountryCode } from "@/lib/country-code";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { pdfDate } from "@/server/services/export/pdf-locale";
import { dsarOnTime } from "@/lib/dsar-on-time";
import { dsarDeadlineMonths as dsarMonths } from "@/server/services/privacy/slaCalculator";
import { isDsarModuleEnabled } from "@/config/features";
import { withDraftGapsPage } from "../draft-gaps-page";
import { PDF, nameForFile, fileTitle, type ExportArgs, type ExportFile } from "./context";
import { withPdfLocale } from "@/server/services/export/pdf-locale";

export async function buildRegulatoryLandscapeExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const t = await getTranslations({ locale, namespace: "pdf.regulatoryLandscape" });

  // ── Gather Applied Jurisdictions ───────────────────────
  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    include: { jurisdiction: true },
  });

  const adequateSet = new Set(EU_ADEQUATE_COUNTRIES);

  const jurisdictions: AppliedJurisdiction[] = orgJurisdictions.map((oj) => {
    const found = JURISDICTION_CATALOG.find(
      (c) => c.code === oj.jurisdiction.code
    );
    const catalogEntry = found ? localizeJurisdiction(found, locale) : undefined;
    return {
      code: oj.jurisdiction.code,
      name: catalogEntry?.name ?? oj.jurisdiction.name,
      region: catalogEntry?.region ?? oj.jurisdiction.region ?? "",
      // The region in the report's language (the Spanish catalogue's label); English keeps the code.
      regionLabel: locale === "es" ? catalogEntry?.regionLabel : undefined,
      country: catalogEntry?.country ?? "",
      dsarDeadlineDays: oj.jurisdiction.dsarDeadlineDays ?? 30,
      dsarDeadlineMonths: dsarMonths(oj.jurisdiction.code, oj.jurisdiction.dsarDeadlineDays),
      breachNotificationHours: oj.jurisdiction.breachNotificationHours ?? 72,
      keyRequirements: (catalogEntry?.keyRequirements as string[]) ?? [],
      penalties: catalogEntry?.penalties ?? "Not specified",
      dpaName: catalogEntry?.dpaName,
      dpaUrl: catalogEntry?.dpaUrl,
      category: catalogEntry?.category ?? "comprehensive",
      isPrimary: oj.isPrimary,
    };
  });

  // ── Module Stats ───────────────────────────────────────
  const [assetCount, activityCount, transferCount] = await Promise.all([
    prisma.dataAsset.count({ where: { organizationId } }),
    prisma.processingActivity.count({ where: { organizationId, isActive: true } }),
    prisma.dataTransfer.count({ where: { organizationId } }),
  ]);

  // DSAR stats (none when the rights-request module is off)
  const dsarOn = isDsarModuleEnabled();
  const dsarAll = dsarOn
    ? await prisma.dSARRequest.findMany({
        where: { organizationId },
        select: { status: true, receivedAt: true, completedAt: true, dueDate: true, extendedDueDate: true, updatedAt: true },
      })
    : [];
  const dsarTotal = dsarAll.length;
  // The shared on-time measure (src/lib/dsar-on-time.ts), as every other report prints it.
  const dsarTiming = dsarOnTime(dsarAll, new Date());
  const dsarOverdue = dsarTiming.openOverdue;
  const completedWithDates = dsarAll.filter((d) => d.status === "COMPLETED" && d.completedAt);
  const avgDsarDays = completedWithDates.length > 0
    ? Math.round(
        completedWithDates.reduce((sum, d) => {
          return sum + (d.completedAt!.getTime() - d.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / completedWithDates.length
      )
    : 0;

  // Incident stats
  const incidents = await prisma.incident.findMany({
    where: { recordedInErrorAt: null, organizationId },
    select: { status: true, severity: true },
  });
  const incidentTotal = incidents.length;
  const incidentOpen = incidents.filter((i) => !["CLOSED", "FALSE_POSITIVE"].includes(i.status)).length;
  const incidentCritical = incidents.filter((i) => i.severity === "CRITICAL").length;

  // Assessment stats
  const assessments = await prisma.assessment.findMany({
    where: { organizationId },
    select: { status: true },
  });
  const assessmentTotal = assessments.length;
  const assessmentApproved = assessments.filter((a) => a.status === "APPROVED").length;

  // Vendor stats
  const allVendors = await prisma.vendor.findMany({
    where: { organizationId },
    select: { riskTier: true, countries: true },
  });
  const vendorTotal = allVendors.length;
  const vendorHighRisk = allVendors.filter(
    (v) => v.riskTier === "HIGH" || v.riskTier === "CRITICAL"
  ).length;

  // DSAR on-time rate: null when nothing can be measured yet.
  const dsarOnTimeRate = dsarTiming.rate;

  // ── Transfer Exposure by Country ───────────────────────
  const transfers = await prisma.dataTransfer.findMany({
    where: { organizationId },
    select: { destinationCountry: true, mechanism: true },
  });

  const tMechanism = await getTranslations({ locale, namespace: "enums.transferMechanism" });
  const transferMap = new Map<string, { count: number; mechanisms: Set<string> }>();
  for (const t of transfers) {
    const country = canonicalCountryCode(t.destinationCountry) || ""; // printed as "not stated"
    if (!transferMap.has(country)) {
      transferMap.set(country, { count: 0, mechanisms: new Set() });
    }
    const entry = transferMap.get(country)!;
    entry.count++;
    if (t.mechanism) {
      entry.mechanisms.add(
        tMechanism.has(t.mechanism as never) ? tMechanism(t.mechanism as never) : t.mechanism.replace(/_/g, " ")
      );
    }
  }

  // A partial decision (US under the DPF, Canada under PIPEDA) is neither a
  // plain yes nor a no: it covers certain recipients only.
  const transfersByCountry: TransferExposure[] = Array.from(transferMap.entries()).map(
    ([country, data]) => {
      const coverage = adequacyCoverage(country);
      const scope = getAdequacyDecision(country)?.partialScope;
      return {
        country,
        count: data.count,
        mechanisms: Array.from(data.mechanisms),
        hasAdequacy: adequateSet.has(country),
        adequacyLabel:
          coverage === "PARTIAL_UNCONFIRMED" && scope
            ? t(`adequacyPartial.${scope}`)
            : undefined,
      };
    }
  );

  // ── Vendor Exposure by Country ─────────────────────────
  const vendorCountryMap = new Map<string, { vendorCount: number; highRiskCount: number }>();
  for (const v of allVendors) {
    for (const country of v.countries) {
      if (!vendorCountryMap.has(country)) {
        vendorCountryMap.set(country, { vendorCount: 0, highRiskCount: 0 });
      }
      const entry = vendorCountryMap.get(country)!;
      entry.vendorCount++;
      if (v.riskTier === "HIGH" || v.riskTier === "CRITICAL") {
        entry.highRiskCount++;
      }
    }
  }

  const vendorsByCountry: VendorExposure[] = Array.from(vendorCountryMap.entries()).map(
    ([country, data]) => ({
      country,
      vendorCount: data.vendorCount,
      highRiskCount: data.highRiskCount,
    })
  );

  // ── Compliance Score (simplified) ──────────────────────
  const ropaScore = activityCount > 0 ? Math.min(100, Math.round((activityCount / Math.max(assetCount, 1)) * 100)) : 0;
  const assessmentScore = assessmentTotal > 0 ? Math.round((assessmentApproved / assessmentTotal) * 100) : 0;
  const dsarScore = dsarOnTimeRate ?? 100;
  const incidentScore = incidentTotal > 0 ? Math.round(((incidentTotal - incidentOpen) / incidentTotal) * 100) : 100;
  const vendorScore = vendorTotal > 0 ? Math.round(((vendorTotal - vendorHighRisk) / vendorTotal) * 100) : 100;
  // Without the rights-request module its 25% share is left out and the
  // other weights are scaled up to 100%.
  const complianceScore = dsarOn
    ? Math.round(
        ropaScore * 0.25 + assessmentScore * 0.2 + dsarScore * 0.25 + incidentScore * 0.15 + vendorScore * 0.15
      )
    : Math.round(
        (ropaScore * 0.25 + assessmentScore * 0.2 + incidentScore * 0.15 + vendorScore * 0.15) / 0.75
      );

  // ── Build Report Data ──────────────────────────────────
  const reportData: RegulatoryLandscapeData = {
    organization: { name: orgName },
    generatedAt: pdfDate(new Date(), "long", locale),
    jurisdictions,
    complianceScore,
    moduleStats: {
      assets: assetCount,
      activities: activityCount,
      dsarTotal,
      dsarOverdue,
      dsarAvgDays: avgDsarDays,
      incidentTotal,
      incidentOpen,
      incidentCritical,
      assessmentTotal,
      assessmentApproved,
      vendorTotal,
      vendorHighRisk,
      transferTotal: transferCount,
    },
    transfersByCountry,
    vendorsByCountry,
    dsarOnTimeRate,
    dsarStatus:
      dsarTiming.measured === 0
        ? "noData"
        : dsarTiming.completedLate + dsarTiming.openOverdue > 0
          ? "notMet"
          : "meeting",
    breachNotificationCompliance: 100, // not printed; kept for the data shape
    dsarModule: dsarOn,
  };

  // ── Render PDF ─────────────────────────────────────────
  const buffer = await withPdfLocale(locale, () => renderToBuffer(
    withDraftGapsPage(RegulatoryLandscapeReport({ data: reportData, t, locale }), args.draftNote))
  );

  const filename = `${fileTitle("Regulatory-Landscape", locale)}-${nameForFile(orgName)}-${fmtDate(new Date())}.pdf`;

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "Report",
        entityId: "regulatory-landscape",
        action: "EXPORT_PDF",
        changes: {
          format: "pdf",
          reportType: "regulatory-landscape",
          jurisdictionCount: jurisdictions.length,
        },
      },
    });
  }

  return { data: new Uint8Array(buffer), filename, contentType: PDF };
}
