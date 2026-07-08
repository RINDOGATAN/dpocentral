// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Export Demo Documents
 *
 * Generates the legacy-styled PDF/CSV documents from the demo organization
 * and saves them to /tmp/dpocentral-exports/ for manual review / showcase.
 *
 * Covers: Assessments (DPIA / LIA / Custom), Breach Register, DSAR Performance,
 * Regulatory Landscape. The polished design-system v2 reports (Privacy Program,
 * ROPA, Vendor Register) are produced by scripts/render-all-rebuilt-previews.ts.
 *
 * Usage: npx tsx scripts/export-demo-docs.ts [locale]
 *   locale: "en" (default) or "es".
 */

import { PrismaClient } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createTranslator } from "next-intl";
import enMessages from "../src/messages/en.json";
import esMessages from "../src/messages/es.json";
import type { PdfT } from "../src/server/services/export/privacy-program/data-mapping";

// Locale resolution from argv.
const localeArg = (process.argv[2] ?? "en") as "en" | "es";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages = (localeArg === "es" ? esMessages : enMessages) as any;
const ns = (namespace: string): PdfT =>
  createTranslator({ locale: localeArg, messages, namespace }) as unknown as PdfT;
const tRopa = ns("pdf.ropaReport");
const tCommon = ns("pdf.common");
const tEnum = ns("pdf.enum");
const tDsar = ns("pdf.dsarPerformance");
const tReg = ns("pdf.regulatoryLandscape");
const tAssessment = ns("pdf.assessmentReport");
const tBreach = ns("pdf.breachRegister");

// PDF document components
import { AssessmentReport } from "../src/server/services/export/assessment-report";
import type { AssessmentExportData } from "../src/server/services/export/assessment-report";
import { BreachRegisterReport, incidentsToCSV } from "../src/server/services/export/breach-register";
import type { IncidentExportData } from "../src/server/services/export/breach-register";
import {
  DSARPerformanceReport,
  type DSARPerformanceData,
} from "../src/server/services/export/dsar-performance-report";
import {
  RegulatoryLandscapeReport,
  type RegulatoryLandscapeData,
  type AppliedJurisdiction,
  type TransferExposure,
  type VendorExposure,
} from "../src/server/services/export/regulatory-landscape-report";
import { JURISDICTION_CATALOG } from "../src/config/jurisdiction-catalog";
import { EU_ADEQUATE_COUNTRIES } from "../src/config/vendor-data-mappings";
import { fmtDate } from "../src/server/services/export/pdf-styles";

// `tRopa`/`tEnum` are unused now that ROPA moved to the v2 script but kept for
// any future legacy ROPA needs; silence noUnusedLocals.
void tRopa;
void tEnum;

const prisma = new PrismaClient();
const OUTPUT_DIR = "/tmp/dpocentral-exports";
const dateStr = fmtDate(new Date());

async function saveBuffer(filename: string, buffer: Buffer | Uint8Array) {
  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, buffer);
  console.log(`  -> ${path}`);
}

async function saveText(filename: string, content: string) {
  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, content, "utf-8");
  console.log(`  -> ${path}`);
}

async function exportAssessments(org: { id: string; name: string }) {
  console.log("\n[1/4] Assessment Reports...");

  const assessments = await prisma.assessment.findMany({
    where: { organizationId: org.id },
    include: {
      organization: true,
      template: true,
      processingActivity: { select: { name: true } },
      vendor: { select: { name: true } },
      responses: {
        include: {
          responder: { select: { id: true, name: true, email: true } },
        },
        orderBy: { respondedAt: "desc" },
      },
      mitigations: { orderBy: { priority: "asc" } },
      approvals: {
        include: {
          approver: { select: { id: true, name: true, email: true } },
        },
        orderBy: { level: "asc" },
      },
      versions: { orderBy: { version: "desc" }, take: 5 },
    },
  });

  console.log(`  Found ${assessments.length} assessments`);

  for (const assessment of assessments) {
    const sections = (assessment.template.sections as any[]) || [];
    const totalQuestions = sections.reduce(
      (sum: number, sec: any) => sum + (sec.questions?.length || 0),
      0
    );

    const data: AssessmentExportData = {
      id: assessment.id,
      name: assessment.name,
      description: assessment.description,
      status: assessment.status,
      riskLevel: assessment.riskLevel,
      riskScore: assessment.riskScore,
      startedAt: assessment.startedAt,
      submittedAt: assessment.submittedAt,
      completedAt: assessment.completedAt,
      dueDate: assessment.dueDate,
      template: {
        type: assessment.template.type,
        name: assessment.template.name,
        version: assessment.template.version,
        sections,
      },
      processingActivity: assessment.processingActivity,
      vendor: assessment.vendor,
      responses: assessment.responses.map((r) => ({
        sectionId: r.sectionId,
        questionId: r.questionId,
        response: typeof r.response === "string" ? r.response : JSON.stringify(r.response),
        riskScore: r.riskScore,
        notes: r.notes,
        responder: r.responder,
        respondedAt: r.respondedAt,
      })),
      mitigations: assessment.mitigations.map((m) => ({
        title: m.title,
        description: m.description,
        status: m.status,
        owner: m.owner,
        priority: m.priority,
        dueDate: m.dueDate,
        completedAt: m.completedAt,
        evidence: m.evidence,
      })),
      approvals: assessment.approvals.map((a) => ({
        level: a.level,
        status: a.status,
        comments: a.comments,
        decidedAt: a.decidedAt,
        approver: a.approver,
      })),
      organization: { name: org.name },
      completionPercentage:
        totalQuestions > 0
          ? Math.round((assessment.responses.length / totalQuestions) * 100)
          : 0,
      totalQuestions,
    };

    const safeName = assessment.name.replace(/[^a-zA-Z0-9]/g, "-");
    const buffer = await renderToBuffer(AssessmentReport({ data, t: tAssessment, locale: localeArg }));
    await saveBuffer(
      `Assessment-${assessment.template.type}-${safeName}-${localeArg}-${dateStr}.pdf`,
      buffer
    );
  }
}

async function exportBreachRegister(org: { id: string; name: string }) {
  console.log("\n[2/4] Breach Register...");

  const incidents = await prisma.incident.findMany({
    where: { organizationId: org.id },
    include: {
      notifications: {
        include: { jurisdiction: true },
      },
      timeline: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { timestamp: "asc" },
      },
    },
    orderBy: { discoveredAt: "desc" },
  });

  console.log(`  Found ${incidents.length} incidents`);

  const data: IncidentExportData[] = incidents.map((inc) => ({
    id: inc.id,
    publicId: inc.publicId,
    title: inc.title,
    description: inc.description,
    type: inc.type,
    severity: inc.severity,
    status: inc.status,
    discoveredAt: inc.discoveredAt,
    discoveredBy: inc.discoveredBy,
    discoveryMethod: inc.discoveryMethod,
    affectedRecords: inc.affectedRecords,
    affectedSubjects: inc.affectedSubjects,
    dataCategories: inc.dataCategories,
    containedAt: inc.containedAt,
    containmentActions: inc.containmentActions,
    rootCause: inc.rootCause,
    resolvedAt: inc.resolvedAt,
    resolutionNotes: inc.resolutionNotes,
    lessonsLearned: inc.lessonsLearned,
    notificationRequired: inc.notificationRequired,
    notificationDeadline: inc.notificationDeadline,
    createdAt: inc.createdAt,
    notifications: inc.notifications.map((n) => ({
      status: n.status,
      notificationDate: n.sentAt,
      jurisdiction: { name: n.jurisdiction.name, code: n.jurisdiction.code },
    })),
    timeline: inc.timeline.map((t) => ({
      title: t.title,
      description: t.description,
      timestamp: t.timestamp,
      user: t.createdBy,
    })),
  }));

  const safeName = org.name.replace(/[^a-zA-Z0-9]/g, "-");
  const buffer = await renderToBuffer(BreachRegisterReport({ incidents: data, orgName: org.name, t: tBreach, locale: localeArg }));
  await saveBuffer(`Breach-Register-${safeName}-${localeArg}-${dateStr}.pdf`, buffer);
  await saveText(`Breach-Register-${safeName}-${localeArg}-${dateStr}.csv`, incidentsToCSV(data));
}

async function exportDSARPerformance(org: { id: string; name: string }) {
  console.log("\n[3/4] DSAR Performance...");

  const primaryJurisdiction = await prisma.organizationJurisdiction.findFirst({
    where: { organizationId: org.id, isPrimary: true },
    include: { jurisdiction: { select: { name: true, dsarDeadlineDays: true } } },
  });
  const primaryName = primaryJurisdiction?.jurisdiction.name ?? null;
  const primaryDeadlineDays = primaryJurisdiction?.jurisdiction.dsarDeadlineDays ?? 30;

  const allDsars = await prisma.dSARRequest.findMany({
    where: { organizationId: org.id },
    select: {
      status: true,
      type: true,
      receivedAt: true,
      completedAt: true,
      dueDate: true,
      redactedAt: true,
    },
  });

  console.log(`  Found ${allDsars.length} DSAR requests`);

  const now = new Date();
  const isClosed = (s: string) => ["COMPLETED", "CANCELLED", "REJECTED"].includes(s);
  const total = allDsars.length;
  const completed = allDsars.filter((d) => d.status === "COMPLETED").length;
  const open = allDsars.filter((d) => !isClosed(d.status)).length;
  const overdue = allDsars.filter(
    (d) => d.dueDate && new Date(d.dueDate) < now && !isClosed(d.status)
  ).length;
  const redacted = allDsars.filter((d) => d.redactedAt != null).length;

  const completedWithDates = allDsars.filter((d) => d.status === "COMPLETED" && d.completedAt);
  const avgResolutionDays =
    completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce(
            (sum, d) =>
              sum + (d.completedAt!.getTime() - d.receivedAt.getTime()) / (1000 * 60 * 60 * 24),
            0
          ) / completedWithDates.length
        )
      : 0;

  const completedOnTime = completedWithDates.filter(
    (d) => d.dueDate && d.completedAt! <= d.dueDate
  ).length;
  const onTimeRate =
    completedWithDates.length > 0
      ? Math.round((completedOnTime / completedWithDates.length) * 100)
      : 100;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const completedLast30Days = allDsars.filter(
    (d) => d.status === "COMPLETED" && d.completedAt && d.completedAt >= thirtyDaysAgo
  ).length;

  const typeMap = new Map<string, number>();
  for (const d of allDsars) typeMap.set(d.type, (typeMap.get(d.type) ?? 0) + 1);
  const byType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));

  const statusMap = new Map<string, number>();
  for (const d of allDsars) statusMap.set(d.status, (statusMap.get(d.status) ?? 0) + 1);
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId: org.id },
    include: { jurisdiction: { select: { name: true, dsarDeadlineDays: true } } },
  });
  const jurisdictionSLA = orgJurisdictions.map((oj) => {
    const deadline = oj.jurisdiction.dsarDeadlineDays ?? 30;
    return {
      name: oj.jurisdiction.name,
      deadlineDays: deadline,
      status:
        avgResolutionDays > 0 && avgResolutionDays <= deadline
          ? "Meeting"
          : avgResolutionDays > deadline
            ? "At risk"
            : "No data",
    };
  });

  const monthlyTrend: { month: string; received: number; completed: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    const received = allDsars.filter(
      (d) => d.receivedAt >= monthStart && d.receivedAt <= monthEnd
    ).length;
    const monthCompleted = allDsars.filter(
      (d) => d.completedAt && d.completedAt >= monthStart && d.completedAt <= monthEnd
    ).length;
    monthlyTrend.push({ month: monthLabel, received, completed: monthCompleted });
  }

  const openDsars = allDsars.filter((d) => !isClosed(d.status));
  const ageBands = [
    { band: "0-7 days", min: 0, max: 7 },
    { band: "7-14 days", min: 7, max: 14 },
    { band: "14-30 days", min: 14, max: 30 },
    { band: "30+ days", min: 30, max: Infinity },
  ];
  const aging = ageBands.map((band) => ({
    band: band.band,
    count: openDsars.filter((d) => {
      const age = (now.getTime() - d.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
      return age >= band.min && age < band.max;
    }).length,
  }));

  const reportData: DSARPerformanceData = {
    organization: { name: org.name },
    generatedAt: fmtDate(now),
    primaryJurisdiction: primaryName,
    primaryDeadlineDays,
    stats: {
      total,
      completed,
      overdue,
      open,
      onTimeRate,
      avgResolutionDays,
      completedLast30Days,
      redacted,
    },
    byType,
    byStatus,
    jurisdictionSLA,
    monthlyTrend,
    aging,
  };

  const safeName = org.name.replace(/[^a-zA-Z0-9]/g, "-");
  const buffer = await renderToBuffer(
    DSARPerformanceReport({ data: reportData, t: tDsar, locale: localeArg })
  );
  await saveBuffer(`DSAR-Performance-${safeName}-${localeArg}-${dateStr}.pdf`, buffer);
}

async function exportRegulatoryLandscape(org: { id: string; name: string }) {
  console.log("\n[4/4] Regulatory Landscape...");

  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId: org.id },
    include: { jurisdiction: true },
  });

  const adequateSet = new Set(EU_ADEQUATE_COUNTRIES);

  const jurisdictions: AppliedJurisdiction[] = orgJurisdictions.map((oj) => {
    const catalogEntry = JURISDICTION_CATALOG.find((c) => c.code === oj.jurisdiction.code);
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

  console.log(`  Found ${jurisdictions.length} applied jurisdictions`);

  const [assetCount, activityCount, transferCount] = await Promise.all([
    prisma.dataAsset.count({ where: { organizationId: org.id } }),
    prisma.processingActivity.count({ where: { organizationId: org.id, isActive: true } }),
    prisma.dataTransfer.count({ where: { organizationId: org.id } }),
  ]);

  const dsarAll = await prisma.dSARRequest.findMany({
    where: { organizationId: org.id },
    select: { status: true, receivedAt: true, completedAt: true, dueDate: true },
  });
  const dsarTotal = dsarAll.length;
  const dsarCompleted = dsarAll.filter((d) => d.status === "COMPLETED").length;
  const dsarOverdue = dsarAll.filter(
    (d) =>
      d.dueDate &&
      new Date(d.dueDate) < new Date() &&
      d.status !== "COMPLETED" &&
      d.status !== "CANCELLED"
  ).length;
  const completedWithDates = dsarAll.filter((d) => d.status === "COMPLETED" && d.completedAt);
  const avgDsarDays =
    completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce(
            (sum, d) =>
              sum + (d.completedAt!.getTime() - d.receivedAt.getTime()) / (1000 * 60 * 60 * 24),
            0
          ) / completedWithDates.length
        )
      : 0;

  const incidents = await prisma.incident.findMany({
    where: { organizationId: org.id },
    select: { status: true, severity: true },
  });
  const incidentTotal = incidents.length;
  const incidentOpen = incidents.filter((i) => !["CLOSED", "FALSE_POSITIVE"].includes(i.status)).length;
  const incidentCritical = incidents.filter((i) => i.severity === "CRITICAL").length;

  const assessments = await prisma.assessment.findMany({
    where: { organizationId: org.id },
    select: { status: true },
  });
  const assessmentTotal = assessments.length;
  const assessmentApproved = assessments.filter((a) => a.status === "APPROVED").length;

  const allVendors = await prisma.vendor.findMany({
    where: { organizationId: org.id },
    select: { riskTier: true, countries: true },
  });
  const vendorTotal = allVendors.length;
  const vendorHighRisk = allVendors.filter(
    (v) => v.riskTier === "HIGH" || v.riskTier === "CRITICAL"
  ).length;

  const dsarOnTimeRate = dsarTotal > 0 ? Math.round((dsarCompleted / Math.max(dsarTotal, 1)) * 100) : 100;

  const transfers = await prisma.dataTransfer.findMany({
    where: { organizationId: org.id },
    select: { destinationCountry: true, mechanism: true },
  });
  const transferMap = new Map<string, { count: number; mechanisms: Set<string> }>();
  for (const t of transfers) {
    const country = t.destinationCountry || "Unknown";
    if (!transferMap.has(country)) transferMap.set(country, { count: 0, mechanisms: new Set() });
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

  const vendorCountryMap = new Map<string, { vendorCount: number; highRiskCount: number }>();
  for (const v of allVendors) {
    for (const country of v.countries) {
      if (!vendorCountryMap.has(country)) vendorCountryMap.set(country, { vendorCount: 0, highRiskCount: 0 });
      const entry = vendorCountryMap.get(country)!;
      entry.vendorCount++;
      if (v.riskTier === "HIGH" || v.riskTier === "CRITICAL") entry.highRiskCount++;
    }
  }
  const vendorsByCountry: VendorExposure[] = Array.from(vendorCountryMap.entries()).map(
    ([country, data]) => ({
      country,
      vendorCount: data.vendorCount,
      highRiskCount: data.highRiskCount,
    })
  );

  const ropaScore = activityCount > 0 ? Math.min(100, Math.round((activityCount / Math.max(assetCount, 1)) * 100)) : 0;
  const assessmentScore = assessmentTotal > 0 ? Math.round((assessmentApproved / assessmentTotal) * 100) : 0;
  const dsarScore = dsarTotal > 0 ? Math.max(0, dsarOnTimeRate) : 100;
  const incidentScore = incidentTotal > 0 ? Math.round(((incidentTotal - incidentOpen) / incidentTotal) * 100) : 100;
  const vendorScore = vendorTotal > 0 ? Math.round(((vendorTotal - vendorHighRisk) / vendorTotal) * 100) : 100;
  const complianceScore = Math.round(
    ropaScore * 0.25 + assessmentScore * 0.2 + dsarScore * 0.25 + incidentScore * 0.15 + vendorScore * 0.15
  );

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
    breachNotificationCompliance: 100,
  };

  const safeName = org.name.replace(/[^a-zA-Z0-9]/g, "-");
  const buffer = await renderToBuffer(
    RegulatoryLandscapeReport({ data: reportData, t: tReg, locale: localeArg })
  );
  await saveBuffer(`Regulatory-Landscape-${safeName}-${localeArg}-${dateStr}.pdf`, buffer);
}

async function main() {
  console.log("DPO Central — Export Demo Documents");
  console.log("====================================");
  console.log(`Locale: ${localeArg}`);

  const org = await prisma.organization.findFirst({ where: { slug: "demo" } });
  if (!org) {
    console.error("Demo organization not found. Run `npx prisma db seed` first.");
    process.exit(1);
  }

  console.log(`Organization: ${org.name} (${org.slug})`);
  console.log(`Output: ${OUTPUT_DIR}/`);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  await exportAssessments(org);
  await exportBreachRegister(org);
  await exportDSARPerformance(org);
  await exportRegulatoryLandscape(org);

  console.log("\nDone! All documents saved to", OUTPUT_DIR);
}

main()
  .catch((e) => {
    console.error("Export failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// `tCommon` retained for parity with sibling scripts / future legacy reports.
void tCommon;
