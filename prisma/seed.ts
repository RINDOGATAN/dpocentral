// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { PrismaClient, Prisma } from "@prisma/client";
import { JURISDICTION_CORE_DATA } from "../src/config/jurisdiction-data";
const prisma = new PrismaClient();

// Content-only refresh (self-host boots on existing installs, see
// deploy/docker/migrate.sh): upsert the built-in content (jurisdictions)
// by stable identifiers, then stop. Accounts and
// demo data are never (re)planted into a firm's database in this mode.
const CONTENT_ONLY = process.env.SEED_CONTENT_ONLY === "true";

async function main() {
  console.log(CONTENT_ONLY ? "Refreshing built-in content (SEED_CONTENT_ONLY)..." : "Seeding database...");

  // Seed Jurisdictions
  //
  // Operative numbers (deadlines, breach windows, names, regulators) come
  // from the shared source of truth in src/config/jurisdiction-data.ts.
  // This file only adds the DB-specific extras (contact info, requirements).
  const jurisdictionExtras: Record<
    string,
    { dpaCContactInfo: Prisma.InputJsonValue; requirements: Record<string, unknown> }
  > = {
    GDPR: {
      dpaCContactInfo: {
        note: "Contact your lead supervisory authority based on main establishment",
        euList: "https://edpb.europa.eu/about-edpb/about-edpb/members_en",
      },
      requirements: {
        breachThreshold: "risk to rights and freedoms",
        dpoRequired: ["public_authority", "large_scale_monitoring", "special_categories"],
      },
    },
    "UK-GDPR": {
      dpaCContactInfo: {
        name: "Information Commissioner's Office (ICO)",
        website: "https://ico.org.uk/",
      },
      requirements: {
        breachThreshold: "risk to rights and freedoms",
      },
    },
    // Single California jurisdiction: CCPA as amended by the CPRA. The CPRA
    // amendments created the California Privacy Protection Agency (CPPA),
    // which enforces alongside the Attorney General.
    CCPA: {
      dpaCContactInfo: {
        name: "California Privacy Protection Agency (CPPA)",
        website: "https://cppa.ca.gov/",
        attorneyGeneral: "https://oag.ca.gov/privacy",
      },
      requirements: {
        breachThreshold: "500+ California residents",
        applicability: [
          "$25M+ revenue",
          "100,000+ consumers/households",
          "50%+ revenue from selling/sharing personal information",
        ],
        sensitive_data_limit_right: true,
      },
    },
    LGPD: {
      dpaCContactInfo: {
        name: "ANPD - Autoridade Nacional de Proteção de Dados",
        website: "https://www.gov.br/anpd/",
      },
      requirements: {
        breachThreshold: "significant risk to data subjects",
        breachNotificationNote:
          "3 business days per ANPD Resolution CD/ANPD No. 15/2024",
      },
    },
    PIPEDA: {
      dpaCContactInfo: {
        name: "Office of the Privacy Commissioner of Canada",
        website: "https://www.priv.gc.ca/",
      },
      requirements: {
        breachThreshold: "real risk of significant harm",
      },
    },
    POPIA: {
      dpaCContactInfo: {
        name: "Information Regulator South Africa",
        website: "https://www.justice.gov.za/inforeg/",
      },
      requirements: {
        breachThreshold: "reasonable grounds to believe compromise",
      },
    },
    "PDPA-SG": {
      dpaCContactInfo: {
        name: "Personal Data Protection Commission",
        website: "https://www.pdpc.gov.sg/",
      },
      requirements: {
        breachThreshold: "significant harm or large scale",
      },
    },
    APPI: {
      dpaCContactInfo: {
        name: "Personal Information Protection Commission",
        website: "https://www.ppc.go.jp/en/",
      },
      requirements: {
        breachThreshold: "leak of personal data",
      },
    },
  };

  const jurisdictions = JURISDICTION_CORE_DATA.map((core) => {
    const extras = jurisdictionExtras[core.code];
    return {
      code: core.code,
      name: core.name,
      region: core.region,
      dsarDeadlineDays: core.dsarDeadlineDays,
      breachNotificationHours: core.breachNotificationHours,
      dpaCContactInfo: extras?.dpaCContactInfo,
      requirements: {
        dsarExtensionDays: core.dsarExtensionDays ?? 0,
        ...extras?.requirements,
      } as Prisma.InputJsonValue,
    };
  });

  for (const jurisdiction of jurisdictions) {
    await prisma.jurisdiction.upsert({
      where: { code: jurisdiction.code },
      update: jurisdiction,
      create: jurisdiction,
    });
  }

  console.log(`Created ${jurisdictions.length} jurisdictions`);

  if (CONTENT_ONLY) {
    console.log("SEED_CONTENT_ONLY — built-in content refreshed; skipping demo data.");
    return;
  }

  // ============================================================
  // DEMO ORGANIZATION WITH SAMPLE DATA (opt-in via DEMO_SEED=true)
  // ============================================================
  //
  // Default installs (self-host included) get no demo organization, user or
  // sample records. An evaluation instance sets DEMO_SEED=true.

  if (process.env.DEMO_SEED !== "true") {
    console.log("DEMO_SEED != true — skipping demo organization and sample data.");
    console.log("Seeding completed!");
    return;
  }

  console.log("Creating demo organization...");

  // Create demo organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: { domain: "acme-demo.example" },
    create: {
      id: "demo-organization",
      name: "Acme Corporation (Demo)",
      slug: "demo",
      domain: "acme-demo.example",
      settings: { isDemo: true },
    },
  });

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@dpocentral.example" },
    update: {},
    create: {
      id: "demo-user",
      email: "demo@dpocentral.example",
      name: "Demo User",
      emailVerified: new Date(),
    },
  });

  // Add demo user as member of demo org
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: demoUser.id,
      role: "PRIVACY_OFFICER",
    },
  });

  // Link demo org to GDPR jurisdiction
  const gdprJurisdiction = await prisma.jurisdiction.findUnique({
    where: { code: "GDPR" },
  });

  if (gdprJurisdiction) {
    await prisma.organizationJurisdiction.upsert({
      where: {
        organizationId_jurisdictionId: {
          organizationId: demoOrg.id,
          jurisdictionId: gdprJurisdiction.id,
        },
      },
      update: {},
      create: {
        organizationId: demoOrg.id,
        jurisdictionId: gdprJurisdiction.id,
        isPrimary: true,
      },
    });
  }

  // ============================================================
  // DEMO DATA ASSETS
  // ============================================================

  const customerDb = await prisma.dataAsset.upsert({
    where: { id: "demo-asset-customer-db" },
    update: {},
    create: {
      id: "demo-asset-customer-db",
      organizationId: demoOrg.id,
      name: "Customer Database",
      description: "Primary PostgreSQL database storing customer account information, order history, and preferences.",
      type: "DATABASE",
      owner: "Engineering",
      location: "AWS us-east-1",
      hostingType: "Cloud",
      vendor: "Amazon Web Services",
      isProduction: true,
    },
  });

  const hrSystem = await prisma.dataAsset.upsert({
    where: { id: "demo-asset-hr-system" },
    update: {},
    create: {
      id: "demo-asset-hr-system",
      organizationId: demoOrg.id,
      name: "HR Management System",
      description: "Human resources information system (HRIS) containing employee records, payroll data, and performance reviews.",
      type: "APPLICATION",
      owner: "Human Resources",
      location: "Cloud (Multi-region)",
      hostingType: "Cloud",
      vendor: "Workday",
      isProduction: true,
    },
  });

  const marketingCrm = await prisma.dataAsset.upsert({
    where: { id: "demo-asset-marketing-crm" },
    update: {},
    create: {
      id: "demo-asset-marketing-crm",
      organizationId: demoOrg.id,
      name: "Marketing CRM",
      description: "Customer relationship management platform for marketing campaigns, lead tracking, and customer communications.",
      type: "APPLICATION",
      owner: "Marketing",
      location: "Cloud",
      hostingType: "Cloud",
      vendor: "Salesforce",
      isProduction: true,
    },
  });

  const analyticsDb = await prisma.dataAsset.upsert({
    where: { id: "demo-asset-analytics" },
    update: {},
    create: {
      id: "demo-asset-analytics",
      organizationId: demoOrg.id,
      name: "Analytics Data Warehouse",
      description: "Snowflake data warehouse containing aggregated customer behavior data for business intelligence.",
      type: "DATABASE",
      owner: "Data Team",
      location: "AWS us-east-1",
      hostingType: "Cloud",
      vendor: "Snowflake",
      isProduction: true,
    },
  });

  // Add data elements to customer database
  await prisma.dataElement.upsert({
    where: { id: "demo-element-customer-name" },
    update: {},
    create: {
      id: "demo-element-customer-name",
      organizationId: demoOrg.id,
      dataAssetId: customerDb.id,
      name: "Customer Name",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 2555, // 7 years
    },
  });

  await prisma.dataElement.upsert({
    where: { id: "demo-element-customer-email" },
    update: {},
    create: {
      id: "demo-element-customer-email",
      organizationId: demoOrg.id,
      dataAssetId: customerDb.id,
      name: "Customer Email",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 2555,
    },
  });

  await prisma.dataElement.upsert({
    where: { id: "demo-element-payment-info" },
    update: {},
    create: {
      id: "demo-element-payment-info",
      organizationId: demoOrg.id,
      dataAssetId: customerDb.id,
      name: "Payment Information",
      category: "FINANCIAL",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 2555,
    },
  });

  // Add data elements to HR system
  await prisma.dataElement.upsert({
    where: { id: "demo-element-employee-ssn" },
    update: {},
    create: {
      id: "demo-element-employee-ssn",
      organizationId: demoOrg.id,
      dataAssetId: hrSystem.id,
      name: "Employee SSN/Tax ID",
      category: "IDENTIFIERS",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      isSpecialCategory: false,
      retentionDays: 3650, // 10 years after employment ends
    },
  });

  await prisma.dataElement.upsert({
    where: { id: "demo-element-salary" },
    update: {},
    create: {
      id: "demo-element-salary",
      organizationId: demoOrg.id,
      dataAssetId: hrSystem.id,
      name: "Salary Information",
      category: "FINANCIAL",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 3650,
    },
  });

  // ============================================================
  // DEMO PROCESSING ACTIVITIES
  // ============================================================

  const customerCommsActivity = await prisma.processingActivity.upsert({
    where: { id: "demo-activity-customer-comms" },
    update: {},
    create: {
      id: "demo-activity-customer-comms",
      organizationId: demoOrg.id,
      name: "Customer Communications",
      description: "Sending transactional and marketing communications to customers via email and SMS.",
      purpose: "To inform customers about their orders, account updates, and relevant marketing offers based on their preferences and consent.",
      legalBasis: "CONSENT",
      legalBasisDetail: "Customers opt-in to marketing communications during account registration. Transactional emails are sent based on contractual necessity.",
      dataSubjects: ["Customers", "Prospects"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Marketing team", "Email service provider"],
      retentionPeriod: "7 years after last interaction",
      retentionDays: 2555,
      isActive: true,
      lastReviewedAt: new Date("2025-06-15"),
      nextReviewAt: new Date("2026-06-15"),
    },
  });

  const employmentActivity = await prisma.processingActivity.upsert({
    where: { id: "demo-activity-employment" },
    update: {},
    create: {
      id: "demo-activity-employment",
      organizationId: demoOrg.id,
      name: "Employment Records Management",
      description: "Processing employee data for HR purposes including payroll, benefits administration, and performance management.",
      purpose: "To manage the employment relationship, fulfill legal obligations, and administer employee benefits and compensation.",
      legalBasis: "CONTRACT",
      legalBasisDetail: "Processing is necessary for the performance of employment contracts and to comply with employment law requirements.",
      dataSubjects: ["Employees", "Job Applicants", "Former Employees"],
      categories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
      recipients: ["HR team", "Payroll provider", "Benefits administrators"],
      retentionPeriod: "10 years after employment ends",
      retentionDays: 3650,
      isActive: true,
      lastReviewedAt: new Date("2025-09-01"),
      nextReviewAt: new Date("2026-09-01"),
    },
  });

  const analyticsActivity = await prisma.processingActivity.upsert({
    where: { id: "demo-activity-analytics" },
    update: {},
    create: {
      id: "demo-activity-analytics",
      organizationId: demoOrg.id,
      name: "Customer Analytics",
      description: "Analyzing customer behavior patterns for business intelligence and product improvement.",
      purpose: "To understand customer needs, improve product offerings, and optimize business operations through data-driven insights.",
      legalBasis: "LEGITIMATE_INTERESTS",
      legalBasisDetail: "Acme has a legitimate interest in understanding customer behavior to improve services. A balancing test has been conducted.",
      dataSubjects: ["Customers"],
      categories: ["BEHAVIORAL", "IDENTIFIERS"],
      recipients: ["Data analytics team", "Product team"],
      retentionPeriod: "3 years",
      retentionDays: 1095,
      automatedDecisionMaking: false,
      isActive: true,
      lastReviewedAt: new Date("2025-11-01"),
      nextReviewAt: new Date("2026-11-01"),
    },
  });

  // Link assets to processing activities
  await prisma.processingActivityAsset.upsert({
    where: { id: "demo-paa-comms-crm" },
    update: {},
    create: {
      id: "demo-paa-comms-crm",
      processingActivityId: customerCommsActivity.id,
      dataAssetId: marketingCrm.id,
    },
  });

  await prisma.processingActivityAsset.upsert({
    where: { id: "demo-paa-employment-hr" },
    update: {},
    create: {
      id: "demo-paa-employment-hr",
      processingActivityId: employmentActivity.id,
      dataAssetId: hrSystem.id,
    },
  });

  await prisma.processingActivityAsset.upsert({
    where: { id: "demo-paa-analytics-db" },
    update: {},
    create: {
      id: "demo-paa-analytics-db",
      processingActivityId: analyticsActivity.id,
      dataAssetId: analyticsDb.id,
    },
  });

  // ============================================================
  // DEMO VENDORS
  // ============================================================

  const awsVendor = await prisma.vendor.upsert({
    where: { id: "demo-vendor-aws" },
    update: {},
    create: {
      id: "demo-vendor-aws",
      organizationId: demoOrg.id,
      name: "Amazon Web Services",
      description: "Cloud infrastructure provider hosting our primary databases and compute resources.",
      website: "https://aws.amazon.com",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      primaryContact: "AWS Account Manager",
      contactEmail: "enterprise-support@amazon.com",
      categories: ["Cloud Infrastructure", "Data Storage"],
      dataProcessed: ["IDENTIFIERS", "FINANCIAL", "BEHAVIORAL"],
      countries: ["US", "EU", "UK"],
      certifications: ["ISO 27001", "SOC 2 Type II", "PCI DSS"],
      lastAssessedAt: new Date("2025-08-15"),
      nextReviewAt: new Date("2026-08-15"),
    },
  });

  const sendgridVendor = await prisma.vendor.upsert({
    where: { id: "demo-vendor-sendgrid" },
    update: {},
    create: {
      id: "demo-vendor-sendgrid",
      organizationId: demoOrg.id,
      name: "SendGrid (Twilio)",
      description: "Email delivery service for transactional and marketing emails.",
      website: "https://sendgrid.com",
      status: "ACTIVE",
      riskTier: "LOW",
      primaryContact: "SendGrid Support",
      contactEmail: "support@sendgrid.com",
      categories: ["Email Service", "Marketing"],
      dataProcessed: ["IDENTIFIERS"],
      countries: ["US"],
      certifications: ["ISO 27001", "SOC 2 Type II"],
      lastAssessedAt: new Date("2025-10-01"),
      nextReviewAt: new Date("2026-10-01"),
    },
  });

  const snowflakeVendor = await prisma.vendor.upsert({
    where: { id: "demo-vendor-snowflake" },
    update: {},
    create: {
      id: "demo-vendor-snowflake",
      organizationId: demoOrg.id,
      name: "Snowflake",
      description: "Cloud data warehouse platform for analytics and business intelligence.",
      website: "https://snowflake.com",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      primaryContact: "Snowflake Account Team",
      contactEmail: "support@snowflake.com",
      categories: ["Data Analytics", "Data Storage"],
      dataProcessed: ["IDENTIFIERS", "BEHAVIORAL"],
      countries: ["US", "EU"],
      certifications: ["ISO 27001", "SOC 2 Type II", "FedRAMP"],
      lastAssessedAt: new Date("2025-07-20"),
      nextReviewAt: new Date("2026-07-20"),
    },
  });

  // Add vendor contracts
  await prisma.vendorContract.upsert({
    where: { id: "demo-contract-aws-dpa" },
    update: {},
    create: {
      id: "demo-contract-aws-dpa",
      vendorId: awsVendor.id,
      type: "DPA",
      status: "ACTIVE",
      name: "AWS Data Processing Addendum",
      description: "Data Processing Agreement for AWS services under GDPR.",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2027-01-01"),
      autoRenewal: true,
    },
  });

  await prisma.vendorContract.upsert({
    where: { id: "demo-contract-sendgrid-dpa" },
    update: {},
    create: {
      id: "demo-contract-sendgrid-dpa",
      vendorId: sendgridVendor.id,
      type: "DPA",
      status: "ACTIVE",
      name: "SendGrid Data Processing Agreement",
      startDate: new Date("2024-03-15"),
      endDate: new Date("2026-03-15"),
      autoRenewal: true,
    },
  });

  // ============================================================
  // DEMO COMPLETED DSAR
  // ============================================================

  const completedDsar = await prisma.dSARRequest.upsert({
    where: { publicId: "DSAR-2025-0042" },
    update: {},
    create: {
      id: "demo-dsar-completed",
      organizationId: demoOrg.id,
      publicId: "DSAR-2025-0042",
      type: "ACCESS",
      status: "COMPLETED",
      requesterName: "John Smith",
      requesterEmail: "john.smith@example.com",
      requesterPhone: "+1-555-0123",
      relationship: "Customer",
      description: "I would like to receive a copy of all personal data you hold about me, including my purchase history and any marketing preferences.",
      receivedAt: new Date("2025-11-15"),
      acknowledgedAt: new Date("2025-11-15"),
      dueDate: new Date("2025-12-15"),
      completedAt: new Date("2025-12-10"),
      verificationMethod: "Email verification with account details",
      verifiedAt: new Date("2025-11-16"),
      responseMethod: "Email",
      responseNotes: "Data export provided via secure download link. Customer confirmed receipt.",
    },
  });

  // Add DSAR tasks
  await prisma.dSARTask.upsert({
    where: { id: "demo-dsar-task-1" },
    update: {},
    create: {
      id: "demo-dsar-task-1",
      dsarRequestId: completedDsar.id,
      dataAssetId: customerDb.id,
      title: "Export customer account data",
      description: "Extract all account information, profile data, and order history from the customer database.",
      status: "COMPLETED",
      completedAt: new Date("2025-12-05"),
      notes: "Exported 145 records including 3 years of order history.",
    },
  });

  await prisma.dSARTask.upsert({
    where: { id: "demo-dsar-task-2" },
    update: {},
    create: {
      id: "demo-dsar-task-2",
      dsarRequestId: completedDsar.id,
      dataAssetId: marketingCrm.id,
      title: "Export marketing preferences and campaign data",
      description: "Extract email preferences, consent records, and campaign interaction history.",
      status: "COMPLETED",
      completedAt: new Date("2025-12-06"),
      notes: "Exported marketing preferences and 24 months of campaign engagement data.",
    },
  });

  // Add DSAR communications
  await prisma.dSARCommunication.upsert({
    where: { id: "demo-dsar-comm-1" },
    update: {},
    create: {
      id: "demo-dsar-comm-1",
      dsarRequestId: completedDsar.id,
      direction: "INBOUND",
      channel: "Email",
      subject: "Data Access Request",
      content: "I would like to request access to all personal data you hold about me under GDPR Article 15.",
      sentAt: new Date("2025-11-15"),
    },
  });

  await prisma.dSARCommunication.upsert({
    where: { id: "demo-dsar-comm-2" },
    update: {},
    create: {
      id: "demo-dsar-comm-2",
      dsarRequestId: completedDsar.id,
      direction: "OUTBOUND",
      channel: "Email",
      subject: "RE: Data Access Request - Acknowledgement",
      content: "Thank you for your data access request. We have received your request and will respond within 30 days as required by GDPR. For identity verification, please confirm the email address associated with your account.",
      sentById: demoUser.id,
      sentAt: new Date("2025-11-15"),
    },
  });

  await prisma.dSARCommunication.upsert({
    where: { id: "demo-dsar-comm-3" },
    update: {},
    create: {
      id: "demo-dsar-comm-3",
      dsarRequestId: completedDsar.id,
      direction: "OUTBOUND",
      channel: "Email",
      subject: "Your Data Export is Ready",
      content: "Your personal data export is now ready for download. Please use the secure link below to access your data. The link will expire in 7 days.",
      sentById: demoUser.id,
      sentAt: new Date("2025-12-10"),
    },
  });

  // ============================================================
  // DEMO CLOSED INCIDENT
  // ============================================================

  const closedIncident = await prisma.incident.upsert({
    where: { id: "demo-incident-closed" },
    update: {},
    create: {
      id: "demo-incident-closed",
      organizationId: demoOrg.id,
      publicId: "INC-2025-0008",
      title: "Unauthorized Access Attempt - Marketing System",
      description: "Suspicious login attempts detected on the marketing CRM system from multiple IP addresses. Investigation revealed a credential stuffing attack using leaked credentials from an unrelated third-party breach.",
      type: "UNAUTHORIZED_ACCESS",
      severity: "MEDIUM",
      status: "CLOSED",
      discoveredAt: new Date("2025-10-20T14:30:00Z"),
      discoveredBy: "Security Operations Center",
      discoveryMethod: "Automated security monitoring alert",
      affectedRecords: 0,
      affectedSubjects: [],
      dataCategories: [],
      jurisdictionId: gdprJurisdiction?.id,
      containedAt: new Date("2025-10-20T15:45:00Z"),
      containmentActions: "Blocked suspicious IP addresses, forced password reset for potentially affected accounts, enabled enhanced monitoring.",
      rootCause: "Credential stuffing attack using credentials leaked from third-party service breach. No data was accessed.",
      rootCauseCategory: "External Attack",
      resolvedAt: new Date("2025-10-25T10:00:00Z"),
      resolutionNotes: "Attack was contained before any unauthorized data access occurred. Implemented additional security controls.",
      lessonsLearned: "1. Implement mandatory MFA for all CRM users. 2. Deploy credential monitoring service to detect compromised employee credentials. 3. Review rate limiting policies.",
      notificationRequired: false,
    },
  });

  // Add incident timeline entries
  await prisma.incidentTimelineEntry.upsert({
    where: { id: "demo-incident-timeline-1" },
    update: {},
    create: {
      id: "demo-incident-timeline-1",
      incidentId: closedIncident.id,
      timestamp: new Date("2025-10-20T14:30:00Z"),
      title: "Incident Detected",
      description: "SOC received automated alert for unusual login patterns on marketing CRM system.",
      entryType: "DETECTION",
      createdById: demoUser.id,
    },
  });

  await prisma.incidentTimelineEntry.upsert({
    where: { id: "demo-incident-timeline-2" },
    update: {},
    create: {
      id: "demo-incident-timeline-2",
      incidentId: closedIncident.id,
      timestamp: new Date("2025-10-20T14:45:00Z"),
      title: "Investigation Started",
      description: "Security team began investigating the source of suspicious login attempts.",
      entryType: "ACTION",
      createdById: demoUser.id,
    },
  });

  await prisma.incidentTimelineEntry.upsert({
    where: { id: "demo-incident-timeline-3" },
    update: {},
    create: {
      id: "demo-incident-timeline-3",
      incidentId: closedIncident.id,
      timestamp: new Date("2025-10-20T15:45:00Z"),
      title: "Incident Contained",
      description: "Blocked offending IP addresses and forced password resets for potentially affected accounts.",
      entryType: "STATUS_CHANGE",
      createdById: demoUser.id,
      metadata: { from: "INVESTIGATING", to: "CONTAINED" },
    },
  });

  await prisma.incidentTimelineEntry.upsert({
    where: { id: "demo-incident-timeline-4" },
    update: {},
    create: {
      id: "demo-incident-timeline-4",
      incidentId: closedIncident.id,
      timestamp: new Date("2025-10-25T10:00:00Z"),
      title: "Incident Closed",
      description: "Investigation complete. No data breach occurred. Implemented additional preventive controls.",
      entryType: "STATUS_CHANGE",
      createdById: demoUser.id,
      metadata: { from: "CONTAINED", to: "CLOSED" },
    },
  });

  console.log("Created demo organization with sample data");

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
