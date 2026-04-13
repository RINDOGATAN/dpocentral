import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  RegulatoryLandscapeReport,
  type RegulatoryLandscapeData,
  type AppliedJurisdiction,
  type TransferExposure,
  type VendorExposure,
} from "@/server/services/export/regulatory-landscape-report";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { EU_ADEQUATE_COUNTRIES } from "@/config/vendor-data-mappings";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json({ error: "Missing organizationId" }, { status: 400 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {

  // Verify membership
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, user: { email: userEmail } },
  });
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // ── Gather Applied Jurisdictions ───────────────────────
  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    include: { jurisdiction: true },
  });

  const adequateSet = new Set(EU_ADEQUATE_COUNTRIES);

  const jurisdictions: AppliedJurisdiction[] = orgJurisdictions.map((oj) => {
    const catalogEntry = JURISDICTION_CATALOG.find(
      (c) => c.code === oj.jurisdiction.code
    );
    return {
      code: oj.jurisdiction.code,
      name: oj.jurisdiction.name,
      region: catalogEntry?.region ?? oj.jurisdiction.region ?? "",
      country: catalogEntry?.country ?? "",
      dsarDeadlineDays: oj.jurisdiction.dsarDeadlineDays ?? 30,
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

  // DSAR stats
  const dsarAll = await prisma.dSARRequest.findMany({
    where: { organizationId },
    select: { status: true, receivedAt: true, completedAt: true, dueDate: true },
  });
  const dsarTotal = dsarAll.length;
  const dsarCompleted = dsarAll.filter((d) => d.status === "COMPLETED").length;
  const dsarOverdue = dsarAll.filter(
    (d) => d.dueDate && new Date(d.dueDate) < new Date() && d.status !== "COMPLETED" && d.status !== "CANCELLED"
  ).length;
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
    where: { organizationId },
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

  // DSAR on-time rate
  const dsarOnTimeRate = dsarTotal > 0
    ? Math.round(((dsarCompleted) / Math.max(dsarTotal, 1)) * 100)
    : 100;

  // ── Transfer Exposure by Country ───────────────────────
  const transfers = await prisma.dataTransfer.findMany({
    where: { organizationId },
    select: { destinationCountry: true, mechanism: true },
  });

  const transferMap = new Map<string, { count: number; mechanisms: Set<string> }>();
  for (const t of transfers) {
    const country = t.destinationCountry || "Unknown";
    if (!transferMap.has(country)) {
      transferMap.set(country, { count: 0, mechanisms: new Set() });
    }
    const entry = transferMap.get(country)!;
    entry.count++;
    if (t.mechanism) entry.mechanisms.add(t.mechanism.replace(/_/g, " "));
  }

  const transfersByCountry: TransferExposure[] = Array.from(transferMap.entries()).map(
    ([country, data]) => ({
      country,
      count: data.count,
      mechanisms: Array.from(data.mechanisms),
      hasAdequacy: adequateSet.has(country),
    })
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
  const dsarScore = dsarTotal > 0 ? Math.max(0, dsarOnTimeRate) : 100;
  const incidentScore = incidentTotal > 0 ? Math.round(((incidentTotal - incidentOpen) / incidentTotal) * 100) : 100;
  const vendorScore = vendorTotal > 0 ? Math.round(((vendorTotal - vendorHighRisk) / vendorTotal) * 100) : 100;
  const complianceScore = Math.round(
    ropaScore * 0.25 + assessmentScore * 0.2 + dsarScore * 0.25 + incidentScore * 0.15 + vendorScore * 0.15
  );

  // ── Build Report Data ──────────────────────────────────
  const reportData: RegulatoryLandscapeData = {
    organization: { name: org.name },
    generatedAt: fmtDate(new Date()),
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
    dsarOnTimeRate: Math.max(0, Math.min(100, dsarOnTimeRate)),
    breachNotificationCompliance: 100, // placeholder — requires incident-notification join
  };

  // ── Render PDF ─────────────────────────────────────────
  const buffer = await renderToBuffer(
    RegulatoryLandscapeReport({ data: reportData })
  );

  const dateStr = fmtDate(new Date());
  const filename = `Regulatory-Landscape-${org.name.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf`;

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
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

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    return pdfErrorResponse(err, "regulatory-landscape");
  }
}
