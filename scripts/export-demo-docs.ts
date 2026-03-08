/**
 * Export Demo Documents
 *
 * Generates all DPA-ready PDF/CSV documents from the demo organization
 * and saves them to /tmp/dpocentral-exports/ for manual review.
 *
 * Usage: npx tsx scripts/export-demo-docs.ts
 */

import { PrismaClient } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// PDF document components
import { AssessmentReport } from "../src/server/services/export/assessment-report";
import type { AssessmentExportData } from "../src/server/services/export/assessment-report";
import { ROPAReport } from "../src/server/services/export/ropa-report";
import { BreachRegisterReport, incidentsToCSV } from "../src/server/services/export/breach-register";
import type { IncidentExportData } from "../src/server/services/export/breach-register";
import { DataInventoryReport, dataInventoryToCSV } from "../src/server/services/export/data-inventory-report";
import type { DataInventoryExportData } from "../src/server/services/export/data-inventory-report";
import { VendorRegisterReport, vendorsToCSV } from "../src/server/services/export/vendor-register";
import type { VendorExportData } from "../src/server/services/export/vendor-register";
import type { ROPAEntry } from "../src/server/services/privacy/ropaGenerator";
import { fmtDate } from "../src/server/services/export/pdf-styles";

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
  console.log("\n[1/5] Assessment Reports...");

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
    const buffer = await renderToBuffer(AssessmentReport({ data }));
    await saveBuffer(
      `Assessment-${assessment.template.type}-${safeName}-${dateStr}.pdf`,
      buffer
    );
  }
}

async function exportROPA(org: { id: string; name: string }) {
  console.log("\n[2/5] ROPA...");

  const activities = await prisma.processingActivity.findMany({
    where: { organizationId: org.id, isActive: true },
    include: {
      assets: {
        include: {
          dataAsset: { include: { dataElements: true } },
        },
      },
      transfers: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`  Found ${activities.length} processing activities`);

  const entries: ROPAEntry[] = activities.map((activity) => ({
    name: activity.name,
    description: activity.description,
    purpose: activity.purpose,
    legalBasis: activity.legalBasis,
    legalBasisDetail: activity.legalBasisDetail,
    dataSubjects: activity.dataSubjects,
    dataCategories: activity.categories,
    recipients: activity.recipients,
    retentionPeriod: activity.retentionPeriod,
    automatedDecisionMaking: activity.automatedDecisionMaking,
    automatedDecisionDetail: activity.automatedDecisionDetail,
    systems: activity.assets.map((a) => ({
      name: a.dataAsset.name,
      type: a.dataAsset.type,
      location: a.dataAsset.location,
      elements: a.dataAsset.dataElements.map((e) => ({
        name: e.name,
        category: e.category,
        sensitivity: e.sensitivity,
      })),
    })),
    transfers: activity.transfers.map((t) => ({
      destination: t.destinationCountry,
      organization: t.destinationOrg,
      mechanism: t.mechanism,
      safeguards: t.safeguards,
    })),
    lastReviewed: activity.lastReviewedAt,
    nextReview: activity.nextReviewAt,
  }));

  const buffer = await renderToBuffer(ROPAReport({ entries, orgName: org.name }));
  await saveBuffer(`ROPA-${org.name.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf`, buffer);
}

async function exportBreachRegister(org: { id: string; name: string }) {
  console.log("\n[3/5] Breach Register...");

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
  const buffer = await renderToBuffer(BreachRegisterReport({ incidents: data, orgName: org.name }));
  await saveBuffer(`Breach-Register-${safeName}-${dateStr}.pdf`, buffer);
  await saveText(`Breach-Register-${safeName}-${dateStr}.csv`, incidentsToCSV(data));
}

async function exportDataInventory(org: { id: string; name: string }) {
  console.log("\n[4/5] Data Inventory...");

  const [assets, flows, transfers] = await Promise.all([
    prisma.dataAsset.findMany({
      where: { organizationId: org.id },
      include: { dataElements: true },
      orderBy: { name: "asc" },
    }),
    prisma.dataFlow.findMany({
      where: { organizationId: org.id },
      include: {
        sourceAsset: { select: { name: true } },
        destinationAsset: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.dataTransfer.findMany({
      where: { organizationId: org.id },
      include: {
        processingActivity: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  console.log(`  Found ${assets.length} assets, ${flows.length} flows, ${transfers.length} transfers`);

  const data: DataInventoryExportData = {
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      owner: a.owner,
      location: a.location,
      hostingType: a.hostingType,
      description: a.description,
      isProduction: a.isProduction,
      dataElements: a.dataElements.map((e) => ({
        name: e.name,
        category: e.category,
        sensitivity: e.sensitivity,
        isPersonalData: e.isPersonalData,
        isSpecialCategory: e.isSpecialCategory,
        retentionDays: e.retentionDays,
      })),
    })),
    flows: flows.map((f) => ({
      name: f.name,
      description: f.description,
      sourceAsset: f.sourceAsset,
      destinationAsset: f.destinationAsset,
      dataCategories: f.dataCategories,
      frequency: f.frequency,
      encryptionMethod: f.encryptionMethod,
      isAutomated: f.isAutomated,
    })),
    transfers: transfers.map((t) => ({
      name: t.name,
      destinationCountry: t.destinationCountry,
      destinationOrg: t.destinationOrg,
      mechanism: t.mechanism,
      safeguards: t.safeguards,
      tiaCompleted: t.tiaCompleted,
      tiaDate: t.tiaDate,
      isActive: t.isActive,
      processingActivity: t.processingActivity,
    })),
  };

  const safeName = org.name.replace(/[^a-zA-Z0-9]/g, "-");
  const buffer = await renderToBuffer(DataInventoryReport({ data, orgName: org.name }));
  await saveBuffer(`Data-Inventory-${safeName}-${dateStr}.pdf`, buffer);
  await saveText(`Data-Inventory-${safeName}-${dateStr}.csv`, dataInventoryToCSV(data));
}

async function exportVendorRegister(org: { id: string; name: string }) {
  console.log("\n[5/5] Vendor Register...");

  const vendors = await prisma.vendor.findMany({
    where: { organizationId: org.id },
    include: {
      contracts: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  console.log(`  Found ${vendors.length} vendors`);

  const data: VendorExportData[] = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    website: v.website,
    status: v.status,
    riskTier: v.riskTier,
    riskScore: v.riskScore,
    primaryContact: v.primaryContact,
    contactEmail: v.contactEmail,
    categories: v.categories,
    dataProcessed: v.dataProcessed,
    countries: v.countries,
    certifications: v.certifications,
    lastAssessedAt: v.lastAssessedAt,
    nextReviewAt: v.nextReviewAt,
    contracts: v.contracts.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
    })),
  }));

  const safeName = org.name.replace(/[^a-zA-Z0-9]/g, "-");
  const buffer = await renderToBuffer(VendorRegisterReport({ vendors: data, orgName: org.name }));
  await saveBuffer(`Vendor-Register-${safeName}-${dateStr}.pdf`, buffer);
  await saveText(`Vendor-Register-${safeName}-${dateStr}.csv`, vendorsToCSV(data));
}

async function main() {
  console.log("DPO Central — Export Demo Documents");
  console.log("====================================");

  // Find demo org
  const org = await prisma.organization.findFirst({
    where: { slug: "demo" },
  });

  if (!org) {
    console.error("Demo organization not found. Run `npx prisma db seed` first.");
    process.exit(1);
  }

  console.log(`Organization: ${org.name} (${org.slug})`);
  console.log(`Output: ${OUTPUT_DIR}/`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  await exportAssessments(org);
  await exportROPA(org);
  await exportBreachRegister(org);
  await exportDataInventory(org);
  await exportVendorRegister(org);

  console.log("\nDone! All documents saved to", OUTPUT_DIR);
}

main()
  .catch((e) => {
    console.error("Export failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
