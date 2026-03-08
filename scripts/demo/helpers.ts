// scripts/demo/helpers.ts
// Shared helpers for seeding vertical demo scenarios

import { PrismaClient } from "@prisma/client";
import { dpiaTemplateData, DPIA_TEMPLATE_ID } from "../../src/config/dpia-template-v2";
import type { VerticalScenario } from "./types";

const d = (s: string) => new Date(s);

// ── Prerequisites ──────────────────────────────────────────

export interface SeedContext {
  prisma: PrismaClient;
  orgId: string;
  /** Resolved user IDs keyed by symbolic ref ("dpo", "admin", etc.) */
  users: Record<string, string>;
  /** Resolved jurisdiction IDs keyed by code ("GDPR", "CCPA", etc.) */
  jurisdictions: Record<string, string>;
  /** Resolved template IDs */
  templates: { lia: string; custom: string; dpia: string };
}

export async function verifyPrerequisites(prisma: PrismaClient): Promise<{
  liaTemplate: string;
  customTemplate: string;
  vendorQuestionnaire: string;
}> {
  const lia = await prisma.assessmentTemplate.findUnique({ where: { id: "system-lia-template" } });
  const custom = await prisma.assessmentTemplate.findUnique({ where: { id: "system-custom-template" } });
  const vendorQ = await prisma.vendorQuestionnaire.findUnique({ where: { id: "system-vendor-questionnaire" } });

  if (!lia || !custom || !vendorQ) {
    const missing: string[] = [];
    if (!lia) missing.push("system-lia-template (run: npm run db:seed-templates)");
    if (!custom) missing.push("system-custom-template (run: npm run db:seed-templates)");
    if (!vendorQ) missing.push("system-vendor-questionnaire (run: npm run db:seed or npm run db:seed-questionnaire)");
    throw new Error(`Missing prerequisites:\n  - ${missing.join("\n  - ")}`);
  }

  return { liaTemplate: lia.id, customTemplate: custom.id, vendorQuestionnaire: vendorQ.id };
}

export async function upsertDpiaTemplate(prisma: PrismaClient): Promise<void> {
  await prisma.assessmentTemplate.upsert({
    where: { id: DPIA_TEMPLATE_ID },
    update: {
      name: dpiaTemplateData.name,
      description: dpiaTemplateData.description,
      version: dpiaTemplateData.version,
      sections: dpiaTemplateData.sections as any,
      scoringLogic: dpiaTemplateData.scoringLogic as any,
      isActive: true,
    },
    create: {
      id: dpiaTemplateData.id,
      type: dpiaTemplateData.type,
      name: dpiaTemplateData.name,
      description: dpiaTemplateData.description,
      version: dpiaTemplateData.version,
      sections: dpiaTemplateData.sections as any,
      scoringLogic: dpiaTemplateData.scoringLogic as any,
      isSystem: true,
      isActive: true,
    },
  });
}

// ── Cleanup ────────────────────────────────────────────────

export async function cleanupOrg(prisma: PrismaClient, orgId: string): Promise<void> {
  // Order matters: delete children before parents
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });

  // Incidents and children
  const incidents = await prisma.incident.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const incIds = incidents.map((i) => i.id);
  if (incIds.length > 0) {
    await prisma.incidentTimelineEntry.deleteMany({ where: { incidentId: { in: incIds } } });
    await prisma.incidentTask.deleteMany({ where: { incidentId: { in: incIds } } });
    await prisma.incidentAffectedAsset.deleteMany({ where: { incidentId: { in: incIds } } });
    await prisma.incidentNotification.deleteMany({ where: { incidentId: { in: incIds } } });
    await prisma.incidentDocument.deleteMany({ where: { incidentId: { in: incIds } } });
  }
  await prisma.incident.deleteMany({ where: { organizationId: orgId } });

  // Assessments and children
  const assessments = await prisma.assessment.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const assessIds = assessments.map((a) => a.id);
  if (assessIds.length > 0) {
    await prisma.assessmentResponse.deleteMany({ where: { assessmentId: { in: assessIds } } });
    await prisma.assessmentMitigation.deleteMany({ where: { assessmentId: { in: assessIds } } });
    await prisma.assessmentApproval.deleteMany({ where: { assessmentId: { in: assessIds } } });
    await prisma.assessmentVersion.deleteMany({ where: { assessmentId: { in: assessIds } } });
  }
  await prisma.assessment.deleteMany({ where: { organizationId: orgId } });

  // DSARs and children
  const dsars = await prisma.dSARRequest.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const dsarIds = dsars.map((d) => d.id);
  if (dsarIds.length > 0) {
    await prisma.dSARTask.deleteMany({ where: { dsarRequestId: { in: dsarIds } } });
    await prisma.dSARCommunication.deleteMany({ where: { dsarRequestId: { in: dsarIds } } });
    await prisma.dSARAuditLog.deleteMany({ where: { dsarRequestId: { in: dsarIds } } });
  }
  await prisma.dSARRequest.deleteMany({ where: { organizationId: orgId } });
  await prisma.dSARIntakeForm.deleteMany({ where: { organizationId: orgId } });

  // Vendors and children
  const vendors = await prisma.vendor.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const vendorIds = vendors.map((v) => v.id);
  if (vendorIds.length > 0) {
    await prisma.vendorContract.deleteMany({ where: { vendorId: { in: vendorIds } } });
    await prisma.vendorReview.deleteMany({ where: { vendorId: { in: vendorIds } } });
    await prisma.vendorQuestionnaireResponse.deleteMany({ where: { vendorId: { in: vendorIds } } });
  }
  await prisma.vendor.deleteMany({ where: { organizationId: orgId } });

  // Data Inventory
  await prisma.dataTransfer.deleteMany({ where: { organizationId: orgId } });
  await prisma.dataFlow.deleteMany({ where: { organizationId: orgId } });
  // Delete PA-Asset links
  const activities = await prisma.processingActivity.findMany({ where: { organizationId: orgId }, select: { id: true } });
  if (activities.length > 0) {
    await prisma.processingActivityAsset.deleteMany({
      where: { processingActivityId: { in: activities.map((a) => a.id) } },
    });
  }
  await prisma.processingActivity.deleteMany({ where: { organizationId: orgId } });
  await prisma.dataElement.deleteMany({ where: { organizationId: orgId } });
  await prisma.dataAsset.deleteMany({ where: { organizationId: orgId } });

  await prisma.organizationJurisdiction.deleteMany({ where: { organizationId: orgId } });
}

// ── Foundation ─────────────────────────────────────────────

export async function seedFoundation(
  prisma: PrismaClient,
  scenario: VerticalScenario,
): Promise<SeedContext> {
  const orgId = `${scenario.key}-organization`;

  const org = await prisma.organization.upsert({
    where: { slug: scenario.orgSlug },
    update: { name: scenario.orgName, domain: scenario.domain },
    create: {
      id: orgId,
      name: scenario.orgName,
      slug: scenario.orgSlug,
      domain: scenario.domain,
      settings: { isDemo: true },
    },
  });

  // Users
  const users: Record<string, string> = {};
  for (const u of scenario.users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { id: u.id, email: u.email, name: u.name, emailVerified: new Date() },
    });
    users[u.ref] = user.id;

    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role: u.role },
      create: {
        id: `${scenario.key}-member-${u.ref}`,
        organizationId: org.id,
        userId: user.id,
        role: u.role,
      },
    });
  }

  // Jurisdictions
  const jurisdictions: Record<string, string> = {};

  // Upsert extra jurisdictions first
  if (scenario.extraJurisdictions) {
    for (const j of scenario.extraJurisdictions) {
      const jur = await prisma.jurisdiction.upsert({
        where: { code: j.code },
        update: {},
        create: {
          code: j.code,
          name: j.name,
          region: j.region,
          dsarDeadlineDays: j.dsarDeadlineDays,
          breachNotificationHours: j.breachNotificationHours,
        },
      });
      jurisdictions[j.code] = jur.id;
    }
  }

  // Link existing jurisdictions
  let isPrimary = true;
  for (const code of scenario.jurisdictionCodes) {
    let jurId = jurisdictions[code];
    if (!jurId) {
      const existing = await prisma.jurisdiction.findUnique({ where: { code } });
      if (!existing) continue;
      jurId = existing.id;
      jurisdictions[code] = jurId;
    }
    await prisma.organizationJurisdiction.create({
      data: {
        id: `${scenario.key}-oj-${code.toLowerCase()}`,
        organizationId: org.id,
        jurisdictionId: jurId,
        isPrimary,
      },
    });
    isPrimary = false;
  }

  return {
    prisma,
    orgId: org.id,
    users,
    jurisdictions,
    templates: {
      lia: "system-lia-template",
      custom: "system-custom-template",
      dpia: DPIA_TEMPLATE_ID,
    },
  };
}

// ── Data Inventory ─────────────────────────────────────────

export async function seedDataInventory(
  ctx: SeedContext,
  scenario: VerticalScenario,
): Promise<void> {
  // Assets
  for (const a of scenario.assets) {
    await ctx.prisma.dataAsset.create({
      data: { ...a, organizationId: ctx.orgId },
    });
  }

  // Elements
  for (const e of scenario.elements) {
    await ctx.prisma.dataElement.create({
      data: { ...e, organizationId: ctx.orgId },
    });
  }

  // Processing Activities + links
  for (const act of scenario.activities) {
    const { assetIds, lastReviewedAt, nextReviewAt, ...rest } = act;
    await ctx.prisma.processingActivity.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        lastReviewedAt: d(lastReviewedAt),
        nextReviewAt: d(nextReviewAt),
      },
    });

    for (let i = 0; i < assetIds.length; i++) {
      await ctx.prisma.processingActivityAsset.create({
        data: {
          id: `${act.id}-link-${i}`,
          processingActivityId: act.id,
          dataAssetId: assetIds[i],
        },
      });
    }
  }

  // Flows
  for (const f of scenario.flows) {
    await ctx.prisma.dataFlow.create({
      data: { ...f, organizationId: ctx.orgId },
    });
  }

  // Transfers
  for (const t of scenario.transfers) {
    const { activityId, tiaDate, ...rest } = t;
    await ctx.prisma.dataTransfer.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        tiaDate: tiaDate ? d(tiaDate) : undefined,
        processingActivityId: activityId,
        jurisdictionId: ctx.jurisdictions["GDPR"],
      },
    });
  }
}

// ── Vendors ────────────────────────────────────────────────

export async function seedVendors(
  ctx: SeedContext,
  scenario: VerticalScenario,
): Promise<void> {
  for (const v of scenario.vendors) {
    const { lastAssessedAt, nextReviewAt, ...rest } = v;
    await ctx.prisma.vendor.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        lastAssessedAt: lastAssessedAt ? d(lastAssessedAt) : null,
        nextReviewAt: d(nextReviewAt),
      },
    });
  }

  for (const c of scenario.contracts) {
    const { startDate, endDate, ...rest } = c;
    await ctx.prisma.vendorContract.create({
      data: { ...rest, startDate: d(startDate), endDate: d(endDate) },
    });
  }
}

// ── DSARs ──────────────────────────────────────────────────

export async function seedDSARs(
  ctx: SeedContext,
  scenario: VerticalScenario,
): Promise<void> {
  // Intake form
  const form = scenario.intakeForm;
  await ctx.prisma.dSARIntakeForm.create({
    data: {
      id: `${scenario.key}-intake-form`,
      organizationId: ctx.orgId,
      name: form.name,
      slug: form.slug,
      title: form.title,
      description: form.description,
      enabledTypes: ["ACCESS", "ERASURE", "PORTABILITY", "RECTIFICATION", "OBJECTION", "RESTRICTION"],
      fields: [
        { id: "name", label: "Full Name", type: "text", required: true },
        { id: "email", label: "Email Address", type: "email", required: true },
        { id: "phone", label: "Phone Number", type: "tel", required: false },
        { id: "relationship", label: "Your Relationship to Us", type: "select", options: ["Customer", "Employee", "Patient", "User", "Subscriber", "Client", "Other"], required: true },
        { id: "details", label: "Request Details", type: "textarea", required: true },
      ],
      thankYouMessage: "Thank you for your privacy request. Reference: {{publicId}}. We will respond within 30 days.",
      isActive: true,
    },
  });

  // DSARs
  for (const dsar of scenario.dsars) {
    const {
      tasks, communications, receivedAt, acknowledgedAt, dueDate, completedAt,
      verifiedAt, ...rest
    } = dsar;

    const record = await ctx.prisma.dSARRequest.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        receivedAt: d(receivedAt),
        acknowledgedAt: acknowledgedAt ? d(acknowledgedAt) : undefined,
        dueDate: d(dueDate),
        completedAt: completedAt ? d(completedAt) : undefined,
        verifiedAt: verifiedAt ? d(verifiedAt) : undefined,
      },
    });

    for (const task of tasks) {
      const { assignee, completedAt: tc, ...trest } = task;
      await ctx.prisma.dSARTask.create({
        data: {
          ...trest,
          dsarRequestId: record.id,
          assigneeId: ctx.users[assignee],
          completedAt: tc ? d(tc) : undefined,
        },
      });
    }

    for (const comm of communications) {
      const { sentBy, sentAt, ...crest } = comm;
      await ctx.prisma.dSARCommunication.create({
        data: {
          ...crest,
          dsarRequestId: record.id,
          sentAt: d(sentAt),
          sentById: sentBy ? ctx.users[sentBy] : undefined,
        },
      });
    }
  }
}

// ── Assessments ────────────────────────────────────────────

export async function seedAssessments(
  ctx: SeedContext,
  scenario: VerticalScenario,
): Promise<void> {
  for (const assess of scenario.assessments) {
    const {
      templateType, activityId, vendorId, responses, mitigations, approvals,
      startedAt, submittedAt, completedAt, dueDate, ...rest
    } = assess;

    const templateId = ctx.templates[templateType];

    const record = await ctx.prisma.assessment.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        templateId,
        processingActivityId: activityId,
        vendorId,
        startedAt: d(startedAt),
        submittedAt: submittedAt ? d(submittedAt) : undefined,
        completedAt: completedAt ? d(completedAt) : undefined,
        dueDate: d(dueDate),
      },
    });

    for (const r of responses) {
      const { responder, ...rrest } = r;
      await ctx.prisma.assessmentResponse.create({
        data: {
          ...rrest,
          assessmentId: record.id,
          responderId: ctx.users[responder],
        },
      });
    }

    for (const m of mitigations) {
      const { completedAt: mc, dueDate: md, ...mrest } = m;
      await ctx.prisma.assessmentMitigation.create({
        data: {
          ...mrest,
          assessmentId: record.id,
          completedAt: mc ? d(mc) : undefined,
          dueDate: md ? d(md) : undefined,
        },
      });
    }

    for (const a of approvals) {
      const { approver, decidedAt, ...arest } = a;
      await ctx.prisma.assessmentApproval.create({
        data: {
          ...arest,
          assessmentId: record.id,
          approverId: ctx.users[approver],
          decidedAt: decidedAt ? d(decidedAt) : undefined,
        },
      });
    }
  }
}

// ── Incidents ──────────────────────────────────────────────

export async function seedIncidents(
  ctx: SeedContext,
  scenario: VerticalScenario,
): Promise<void> {
  for (const inc of scenario.incidents) {
    const {
      timeline, tasks, affectedAssets, notifications,
      discoveredAt, containedAt, resolvedAt, notificationDeadline,
      ...rest
    } = inc;

    const record = await ctx.prisma.incident.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        jurisdictionId: ctx.jurisdictions["GDPR"],
        discoveredAt: d(discoveredAt),
        containedAt: containedAt ? d(containedAt) : undefined,
        resolvedAt: resolvedAt ? d(resolvedAt) : undefined,
        notificationDeadline: notificationDeadline ? d(notificationDeadline) : undefined,
      },
    });

    for (const tl of timeline) {
      const { createdBy, timestamp, ...tlrest } = tl;
      await ctx.prisma.incidentTimelineEntry.create({
        data: {
          ...tlrest,
          incidentId: record.id,
          timestamp: d(timestamp),
          createdById: ctx.users[createdBy],
        },
      });
    }

    for (const task of tasks) {
      const { assignee, completedAt: tc, dueDate: td, ...trest } = task;
      await ctx.prisma.incidentTask.create({
        data: {
          ...trest,
          incidentId: record.id,
          assigneeId: ctx.users[assignee],
          completedAt: tc ? d(tc) : undefined,
          dueDate: td ? d(td) : undefined,
        },
      });
    }

    for (const aa of affectedAssets) {
      await ctx.prisma.incidentAffectedAsset.create({
        data: { ...aa, incidentId: record.id },
      });
    }

    for (const notif of notifications) {
      const { jurisdictionCode, deadline, ...nrest } = notif;
      const jurId = ctx.jurisdictions[jurisdictionCode];
      if (!jurId) continue;
      const notifData: Record<string, any> = {
        ...nrest,
        incidentId: record.id,
        jurisdictionId: jurId,
      };
      if (deadline) notifData.deadline = d(deadline);
      await ctx.prisma.incidentNotification.create({ data: notifData as any });
    }
  }
}

// ── Audit Logs ─────────────────────────────────────────────

export async function seedAuditLogs(
  ctx: SeedContext,
  scenario: VerticalScenario,
): Promise<void> {
  for (const log of scenario.auditLogs) {
    const { user, createdAt, ...rest } = log;
    await ctx.prisma.auditLog.create({
      data: {
        ...rest,
        organizationId: ctx.orgId,
        userId: ctx.users[user],
        createdAt: d(createdAt),
      },
    });
  }
}

// ── Full Scenario Seed ─────────────────────────────────────

export async function seedScenario(
  prisma: PrismaClient,
  scenario: VerticalScenario,
): Promise<void> {
  const orgId = `${scenario.key}-organization`;

  console.log(`\n  Phase 0: Cleanup...`);
  await cleanupOrg(prisma, orgId);

  console.log(`  Phase 1: Foundation...`);
  const ctx = await seedFoundation(prisma, scenario);

  console.log(`  Phase 2: Data Inventory...`);
  await seedDataInventory(ctx, scenario);
  console.log(`    ${scenario.assets.length} assets, ${scenario.elements.length} elements, ${scenario.activities.length} activities, ${scenario.flows.length} flows, ${scenario.transfers.length} transfers`);

  console.log(`  Phase 3: Vendors...`);
  await seedVendors(ctx, scenario);
  console.log(`    ${scenario.vendors.length} vendors, ${scenario.contracts.length} contracts`);

  console.log(`  Phase 4: DSARs...`);
  await seedDSARs(ctx, scenario);
  console.log(`    ${scenario.dsars.length} DSARs`);

  console.log(`  Phase 5: Assessments...`);
  await seedAssessments(ctx, scenario);
  console.log(`    ${scenario.assessments.length} assessments`);

  console.log(`  Phase 6: Incidents...`);
  await seedIncidents(ctx, scenario);
  console.log(`    ${scenario.incidents.length} incidents`);

  console.log(`  Phase 7: Audit Trail...`);
  await seedAuditLogs(ctx, scenario);
  console.log(`    ${scenario.auditLogs.length} audit log entries`);
}
