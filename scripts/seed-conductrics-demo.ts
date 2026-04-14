/**
 * Seeds the Conductrics demo org with one record per major module so every
 * PDF export has something to render. Idempotent-ish: checks for existing
 * rows by distinctive name before creating.
 */
import prisma from "../src/lib/prisma";

const orgId = "cmnpflh5r000013q77ssfe148";
const userId = "cmm473dmb000004kwq1bexzqp"; // Sergio — the sole OrganizationMember

async function main() {
  // ─── Vendors: risk tiers + one contract ──────────────────────────────
  const hubspot = await prisma.vendor.findFirst({ where: { organizationId: orgId, name: "HubSpot" } });
  const piwik = await prisma.vendor.findFirst({ where: { organizationId: orgId, name: "Piwik Pro" } });
  if (!hubspot || !piwik) throw new Error("expected HubSpot + Piwik Pro vendors");

  await prisma.vendor.update({
    where: { id: hubspot.id },
    data: {
      status: "ACTIVE",
      riskTier: "HIGH",
      riskScore: 72,
      primaryContact: "Data Protection Officer",
      contactEmail: "privacy@hubspot.com",
      lastAssessedAt: new Date("2026-03-15"),
      nextReviewAt: new Date("2027-03-15"),
    },
  });
  await prisma.vendor.update({
    where: { id: piwik.id },
    data: {
      status: "ACTIVE",
      riskTier: "LOW",
      riskScore: 28,
      primaryContact: "GDPR Team",
      contactEmail: "gdpr@piwik.pro",
      lastAssessedAt: new Date("2026-02-20"),
      nextReviewAt: new Date("2027-02-20"),
    },
  });

  const contractExists = await prisma.vendorContract.findFirst({
    where: { vendorId: hubspot.id, name: "HubSpot DPA 2026" },
  });
  if (!contractExists) {
    await prisma.vendorContract.create({
      data: {
        vendorId: hubspot.id,
        type: "DPA",
        status: "ACTIVE",
        name: "HubSpot DPA 2026",
        description: "GDPR-compliant Data Processing Agreement covering CRM and Marketing Hub processing of event attendee personal data.",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2027-12-31"),
        renewalDate: new Date("2027-10-01"),
        autoRenewal: true,
        value: 48000,
        currency: "USD",
      },
    });
  }

  // ─── DataTransfer: EU-based Conductrics → US HubSpot, SCCs ───────────
  const activity = await prisma.processingActivity.findFirst({
    where: { organizationId: orgId, name: "Event lead onboarding" },
  });
  if (!activity) throw new Error("expected Event lead onboarding activity");

  const transferExists = await prisma.dataTransfer.findFirst({
    where: { organizationId: orgId, name: "Event leads → HubSpot US" },
  });
  if (!transferExists) {
    await prisma.dataTransfer.create({
      data: {
        organizationId: orgId,
        processingActivityId: activity.id,
        name: "Event leads → HubSpot US",
        description: "Cross-border transfer of event attendee contact details from EU data subjects to HubSpot's US-hosted CRM instance.",
        destinationCountry: "US",
        destinationOrg: "HubSpot, Inc.",
        mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
        safeguards: "2021 EU SCCs (Module 2: Controller → Processor), supplementary measures include encryption at rest (AES-256) and in transit (TLS 1.3), pseudonymisation of direct identifiers, and contractual prohibition on onward transfers without prior authorisation.",
        tiaCompleted: true,
        tiaDate: new Date("2026-03-10"),
        isActive: true,
        sccExpiryDate: new Date("2029-03-10"),
        complianceStatus: "COMPLIANT",
      },
    });
  }

  // ─── Incident: minor exposure, REPORTED, with timeline + task ────────
  const incidentExists = await prisma.incident.findFirst({
    where: { organizationId: orgId, title: "Accidental CRM export shared externally" },
  });
  if (!incidentExists) {
    const incident = await prisma.incident.create({
      data: {
        organizationId: orgId,
        title: "Accidental CRM export shared externally",
        description: "A marketing team member exported a segment of event leads from HubSpot to a CSV and attached it to an email sent to an external agency that was not authorised to process the data. The email was recalled within 12 minutes and the agency confirmed deletion. Approximately 140 records were affected (name + email only, no special categories).",
        type: "UNAUTHORIZED_ACCESS",
        severity: "MEDIUM",
        status: "CONTAINED",
        discoveredAt: new Date("2026-04-11T09:30:00Z"),
        discoveredBy: "Marketing Team Lead",
        discoveryMethod: "INTERNAL_REPORT",
        affectedRecords: 140,
        affectedSubjects: ["Event attendees"],
        dataCategories: ["IDENTIFIERS"],
        containedAt: new Date("2026-04-11T09:42:00Z"),
        containmentActions: "Email recalled via Outlook; recipient agency confirmed deletion in writing; CSV export permission on HubSpot segment revoked for the marketing team pending training.",
        rootCause: "Insufficient access controls on CRM export functionality combined with missing classification warning on personal-data segments.",
        rootCauseCategory: "HUMAN_ERROR",
        notificationRequired: false,
      },
    });
    await prisma.incidentTimelineEntry.create({
      data: {
        incidentId: incident.id,
        title: "Incident discovered",
        description: "Marketing team lead noticed the external email recipient and flagged it immediately via Slack.",
        entryType: "OBSERVATION",
        timestamp: new Date("2026-04-11T09:30:00Z"),
        createdById: userId,
      },
    });
    await prisma.incidentTimelineEntry.create({
      data: {
        incidentId: incident.id,
        title: "Containment confirmed",
        description: "Email recalled and external agency confirmed deletion of the CSV attachment.",
        entryType: "ACTION",
        timestamp: new Date("2026-04-11T09:42:00Z"),
        createdById: userId,
      },
    });
    await prisma.incidentTask.create({
      data: {
        incidentId: incident.id,
        title: "Roll out mandatory data-export training for marketing team",
        description: "All marketing users must complete a 30-minute refresher on handling personal data exports before HubSpot export permissions are restored.",
        priority: "HIGH",
        status: "TODO",
        dueDate: new Date("2026-04-30"),
      },
    });
  }

  // ─── DSAR: access request, in progress ───────────────────────────────
  const dsarExists = await prisma.dSARRequest.findFirst({
    where: { organizationId: orgId, requesterEmail: "alex.kowalski@example.com" },
  });
  if (!dsarExists) {
    await prisma.dSARRequest.create({
      data: {
        organizationId: orgId,
        type: "ACCESS",
        status: "IN_PROGRESS",
        requesterName: "Alex Kowalski",
        requesterEmail: "alex.kowalski@example.com",
        relationship: "Event attendee",
        description: "Requesting all personal data held following attendance at the 2026-02 Berlin meetup.",
        requestedData: "All CRM records, email communications, and analytics profile data associated with my email address.",
        receivedAt: new Date("2026-04-05T14:00:00Z"),
        acknowledgedAt: new Date("2026-04-05T14:35:00Z"),
        dueDate: new Date("2026-05-05T23:59:00Z"),
        verifiedAt: new Date("2026-04-06T10:00:00Z"),
        verificationMethod: "Email ownership verification via magic link",
      },
    });
  }

  // ─── AI System: A/B testing reinforcement-learning model ─────────────
  const aiExists = await prisma.aISystem.findFirst({
    where: { organizationId: orgId, name: "Conductrics Experimentation Engine" },
  });
  if (!aiExists) {
    await prisma.aISystem.create({
      data: {
        organizationId: orgId,
        name: "Conductrics Experimentation Engine",
        description: "Contextual-bandit reinforcement learning model used to optimise website A/B test variant allocation for converting event leads. Operates on pseudonymised visitor sessions only.",
        purpose: "Optimise landing-page variant selection to improve conversion of event attendees into product trials.",
        riskLevel: "LIMITED",
        category: "Marketing optimisation",
        status: "REGISTERED",
        modelType: "Contextual bandit (reinforcement learning)",
        deployer: "Conductrics (in-house deployment)",
        provider: "Conductrics",
        humanOversight: "Marketing analytics team reviews variant allocations weekly; manual override available for any variant the model starts favouring excessively.",
        transparencyMeasures: "Visitors informed of A/B testing via the cookie banner; documented in the public privacy notice under 'Website experimentation'.",
        trainingDataSources: ["Pseudonymised visitor session data", "Historical conversion outcomes"],
        euAiActRole: "Provider",
        euAiActCompliant: true,
        lastReviewedAt: new Date("2026-03-28"),
        nextReviewAt: new Date("2026-09-28"),
      },
    });
  }

  // ─── Assessment: DPIA for the cross-border transfer ──────────────────
  const assessmentExists = await prisma.assessment.findFirst({
    where: { organizationId: orgId, name: { contains: "Event lead onboarding DPIA" } },
  });
  if (!assessmentExists) {
    await prisma.assessment.create({
      data: {
        organizationId: orgId,
        templateId: "system-dpia-template",
        processingActivityId: activity.id,
        name: "Event lead onboarding DPIA",
        description: "Data Protection Impact Assessment covering the ingestion of event attendee personal data into HubSpot and downstream analytics in Piwik Pro, including the EU→US transfer to HubSpot.",
        status: "IN_PROGRESS",
        riskLevel: "MEDIUM",
        riskScore: 58,
        startedAt: new Date("2026-04-08"),
        dueDate: new Date("2026-05-08"),
      },
    });
  }

  // ─── Final counts ────────────────────────────────────────────────────
  const counts = await prisma.$transaction([
    prisma.dataTransfer.count({ where: { organizationId: orgId } }),
    prisma.incident.count({ where: { organizationId: orgId } }),
    prisma.dSARRequest.count({ where: { organizationId: orgId } }),
    prisma.aISystem.count({ where: { organizationId: orgId } }),
    prisma.assessment.count({ where: { organizationId: orgId } }),
    prisma.vendorContract.count({ where: { vendor: { organizationId: orgId } } }),
  ]);
  console.log({
    transfers: counts[0],
    incidents: counts[1],
    dsars: counts[2],
    aiSystems: counts[3],
    assessments: counts[4],
    vendorContracts: counts[5],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
