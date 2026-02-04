import { PrismaClient, AssessmentType } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ============================================================
  // SKILL PACKAGES (Premium Features)
  // ============================================================

  console.log("Creating skill packages...");

  const skillPackages = [
    {
      id: "skill-vendor-catalog",
      skillId: "com.nel.dpocentral.vendor-catalog",
      name: "VENDOR_CATALOG",
      displayName: "Vendor Catalog",
      assessmentType: null, // Not an assessment - it's a feature skill
      description: "Access to pre-audited vendor database with 400+ MarTech, AI, and SaaS vendors. Search, autofill, and track vendor compliance information.",
      isPremium: true,
      isActive: true,
    },
    {
      id: "skill-dpia",
      skillId: "com.nel.dpocentral.dpia",
      name: "DPIA",
      displayName: "Data Protection Impact Assessment",
      assessmentType: AssessmentType.DPIA,
      description: "Conduct GDPR Article 35 compliant Data Protection Impact Assessments for high-risk processing activities.",
      isPremium: true,
      isActive: true,
    },
    {
      id: "skill-pia",
      skillId: "com.nel.dpocentral.pia",
      name: "PIA",
      displayName: "Privacy Impact Assessment",
      assessmentType: AssessmentType.PIA,
      description: "Comprehensive privacy impact assessments for new projects, systems, and initiatives.",
      isPremium: true,
      isActive: true,
    },
    {
      id: "skill-tia",
      skillId: "com.nel.dpocentral.tia",
      name: "TIA",
      displayName: "Transfer Impact Assessment",
      assessmentType: AssessmentType.TIA,
      description: "Assess the risks of international data transfers and document appropriate safeguards.",
      isPremium: true,
      isActive: true,
    },
    {
      id: "skill-vendor",
      skillId: "com.nel.dpocentral.vendor",
      name: "VENDOR",
      displayName: "Vendor Risk Assessment",
      assessmentType: AssessmentType.VENDOR,
      description: "Evaluate third-party vendor privacy and security risks with comprehensive questionnaires.",
      isPremium: true,
      isActive: true,
    },
    {
      id: "skill-lia",
      skillId: "com.nel.dpocentral.lia",
      name: "LIA",
      displayName: "Legitimate Interest Assessment",
      assessmentType: AssessmentType.LIA,
      description: "Document and balance legitimate interests against data subject rights.",
      isPremium: false,
      isActive: true,
    },
    {
      id: "skill-custom",
      skillId: "com.nel.dpocentral.custom",
      name: "CUSTOM",
      displayName: "Custom Assessment",
      assessmentType: AssessmentType.CUSTOM,
      description: "Create and conduct custom assessments tailored to your organization's needs.",
      isPremium: false,
      isActive: true,
    },
  ];

  for (const pkg of skillPackages) {
    await prisma.skillPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
  }

  console.log(`Created ${skillPackages.length} skill packages`);

  // ============================================================
  // PLATFORM ADMIN
  // ============================================================

  console.log("Creating platform admin...");

  await prisma.platformAdmin.upsert({
    where: { email: "smaldonado@privacycloud.com" },
    update: { isActive: true },
    create: {
      email: "smaldonado@privacycloud.com",
      name: "Sergio Maldonado",
      isActive: true,
    },
  });

  console.log("Created platform admin");

  // ============================================================
  // VENDOR CATALOG (Shared Reference Database)
  // ============================================================

  console.log("Seeding vendor catalog from processors.json...");

  try {
    const processorsPath = path.join(process.cwd(), "vendors", "processors.json");
    const processorsFile = fs.readFileSync(processorsPath, "utf-8");
    const { processors } = JSON.parse(processorsFile);

    let vendorCount = 0;
    for (const p of processors) {
      // Extract compliance flags
      const gdprCompliant = p.compliance?.gdpr?.compliant ?? null;
      const ccpaCompliant = p.compliance?.ccpa?.compliant ?? null;
      const certifications = p.compliance?.certifications || [];

      // Build frameworks array based on compliance
      const frameworks: string[] = [];
      if (gdprCompliant) frameworks.push("GDPR");
      if (ccpaCompliant) frameworks.push("CCPA");

      await prisma.vendorCatalog.upsert({
        where: { slug: p.id },
        update: {
          name: p.name,
          category: p.category,
          description: p.description || null,
          website: p.website || null,
          privacyPolicyUrl: p.privacyPolicy || null,
          gdprCompliant,
          ccpaCompliant,
          certifications,
          frameworks,
          source: "processors.json",
        },
        create: {
          slug: p.id,
          name: p.name,
          category: p.category,
          description: p.description || null,
          website: p.website || null,
          privacyPolicyUrl: p.privacyPolicy || null,
          gdprCompliant,
          ccpaCompliant,
          certifications,
          frameworks,
          source: "processors.json",
        },
      });
      vendorCount++;
    }

    console.log(`Seeded ${vendorCount} vendors into catalog`);
  } catch (error) {
    console.log("Skipping vendor catalog seed (processors.json not found or error):", error);
  }

  // Seed Jurisdictions
  const jurisdictions = [
    {
      code: "GDPR",
      name: "General Data Protection Regulation",
      region: "EU",
      dsarDeadlineDays: 30,
      breachNotificationHours: 72,
      dpaCContactInfo: {
        note: "Contact your lead supervisory authority based on main establishment",
        euList: "https://edpb.europa.eu/about-edpb/about-edpb/members_en",
      },
      requirements: {
        dsarExtensionDays: 60,
        breachThreshold: "risk to rights and freedoms",
        dpoRequired: ["public_authority", "large_scale_monitoring", "special_categories"],
      },
    },
    {
      code: "CCPA",
      name: "California Consumer Privacy Act",
      region: "US-CA",
      dsarDeadlineDays: 45,
      breachNotificationHours: 0, // "Without unreasonable delay"
      dpaCContactInfo: {
        name: "California Attorney General",
        website: "https://oag.ca.gov/privacy",
      },
      requirements: {
        dsarExtensionDays: 45,
        breachThreshold: "500+ California residents",
        applicability: ["$25M+ revenue", "50K+ consumers/devices", "50%+ revenue from selling data"],
      },
    },
    {
      code: "CPRA",
      name: "California Privacy Rights Act",
      region: "US-CA",
      dsarDeadlineDays: 45,
      breachNotificationHours: 0,
      dpaCContactInfo: {
        name: "California Privacy Protection Agency",
        website: "https://cppa.ca.gov/",
      },
      requirements: {
        dsarExtensionDays: 45,
        breachThreshold: "500+ California residents",
        sensitive_data_opt_in: true,
      },
    },
    {
      code: "LGPD",
      name: "Lei Geral de Proteção de Dados",
      region: "BR",
      dsarDeadlineDays: 15,
      breachNotificationHours: 48, // "Reasonable time" interpreted as 48h
      dpaCContactInfo: {
        name: "ANPD - Autoridade Nacional de Proteção de Dados",
        website: "https://www.gov.br/anpd/",
      },
      requirements: {
        dsarExtensionDays: 0,
        breachThreshold: "significant risk to data subjects",
      },
    },
    {
      code: "PIPEDA",
      name: "Personal Information Protection and Electronic Documents Act",
      region: "CA",
      dsarDeadlineDays: 30,
      breachNotificationHours: 0, // "As soon as feasible"
      dpaCContactInfo: {
        name: "Office of the Privacy Commissioner of Canada",
        website: "https://www.priv.gc.ca/",
      },
      requirements: {
        dsarExtensionDays: 30,
        breachThreshold: "real risk of significant harm",
      },
    },
    {
      code: "POPIA",
      name: "Protection of Personal Information Act",
      region: "ZA",
      dsarDeadlineDays: 30,
      breachNotificationHours: 0, // "As soon as reasonably possible"
      dpaCContactInfo: {
        name: "Information Regulator South Africa",
        website: "https://www.justice.gov.za/inforeg/",
      },
      requirements: {
        dsarExtensionDays: 0,
        breachThreshold: "reasonable grounds to believe compromise",
      },
    },
    {
      code: "PDPA-SG",
      name: "Personal Data Protection Act (Singapore)",
      region: "SG",
      dsarDeadlineDays: 30,
      breachNotificationHours: 72,
      dpaCContactInfo: {
        name: "Personal Data Protection Commission",
        website: "https://www.pdpc.gov.sg/",
      },
      requirements: {
        dsarExtensionDays: 30,
        breachThreshold: "significant harm or large scale",
      },
    },
    {
      code: "APPI",
      name: "Act on Protection of Personal Information",
      region: "JP",
      dsarDeadlineDays: 14, // "Without delay"
      breachNotificationHours: 72,
      dpaCContactInfo: {
        name: "Personal Information Protection Commission",
        website: "https://www.ppc.go.jp/en/",
      },
      requirements: {
        dsarExtensionDays: 0,
        breachThreshold: "leak of personal data",
      },
    },
  ];

  for (const jurisdiction of jurisdictions) {
    await prisma.jurisdiction.upsert({
      where: { code: jurisdiction.code },
      update: jurisdiction,
      create: jurisdiction,
    });
  }

  console.log(`Created ${jurisdictions.length} jurisdictions`);

  // ============================================================
  // FREE ASSESSMENT TEMPLATES
  // Premium templates (DPIA, PIA, TIA, VENDOR) are managed via:
  // - Private repo: dpocentral-premium-skills
  // - Sync API: /api/admin/sync-templates
  // ============================================================

  // LIA Template (Free)
  const liaTemplate = {
    type: "LIA" as const,
    name: "Legitimate Interest Assessment",
    description: "Document and balance legitimate interests against data subject rights (GDPR Article 6(1)(f)).",
    version: "1.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "lia1",
        title: "Purpose Test",
        description: "Identify the legitimate interest",
        questions: [
          {
            id: "lia1_1",
            text: "What is the legitimate interest being pursued?",
            type: "textarea",
            required: true,
            helpText: "Describe the specific interest, not just 'business purposes'",
          },
          {
            id: "lia1_2",
            text: "Is this interest recognized as legitimate under law?",
            type: "select",
            required: true,
            options: ["Yes, explicitly recognized", "Yes, generally accepted", "Possibly", "Uncertain"],
          },
          {
            id: "lia1_3",
            text: "What benefit does pursuing this interest provide?",
            type: "textarea",
            required: true,
          },
        ],
      },
      {
        id: "lia2",
        title: "Necessity Test",
        description: "Assess whether processing is necessary",
        questions: [
          {
            id: "lia2_1",
            text: "Is the processing necessary to achieve the interest?",
            type: "select",
            required: true,
            options: ["Essential", "Highly beneficial", "Somewhat beneficial", "Not clearly necessary"],
            riskWeight: 1.5,
          },
          {
            id: "lia2_2",
            text: "Are there less intrusive ways to achieve the same goal?",
            type: "select",
            required: true,
            options: ["No alternatives exist", "Alternatives less effective", "Alternatives available", "Better alternatives exist"],
            riskWeight: 1.5,
          },
        ],
      },
      {
        id: "lia3",
        title: "Balancing Test",
        description: "Balance interests against data subject rights",
        questions: [
          {
            id: "lia3_1",
            text: "What is the nature of the data being processed?",
            type: "select",
            required: true,
            options: ["Non-sensitive only", "Mix of sensitivity levels", "Includes sensitive data"],
            riskWeight: 2,
          },
          {
            id: "lia3_2",
            text: "Would data subjects reasonably expect this processing?",
            type: "select",
            required: true,
            options: ["Definitely expected", "Probably expected", "Possibly unexpected", "Likely unexpected"],
            riskWeight: 2,
          },
          {
            id: "lia3_3",
            text: "What is the potential impact on data subjects?",
            type: "select",
            required: true,
            options: ["Positive/Neutral", "Minor negative", "Moderate negative", "Significant negative"],
            riskWeight: 2,
          },
          {
            id: "lia3_4",
            text: "Are there vulnerable individuals affected?",
            type: "boolean",
            required: true,
            riskWeight: 2,
          },
        ],
      },
      {
        id: "lia4",
        title: "Safeguards",
        description: "Document safeguards to protect data subjects",
        questions: [
          {
            id: "lia4_1",
            text: "What safeguards are in place to protect data subjects?",
            type: "multiselect",
            required: true,
            options: ["Opt-out mechanism", "Data minimization", "Retention limits", "Access controls", "Transparency measures", "Other"],
          },
          {
            id: "lia4_2",
            text: "Have you provided clear privacy information about this processing?",
            type: "boolean",
            required: true,
          },
        ],
      },
    ],
    scoringLogic: {
      method: "weighted_average",
      riskLevels: {
        LOW: { min: 0, max: 25 },
        MEDIUM: { min: 26, max: 50 },
        HIGH: { min: 51, max: 75 },
        CRITICAL: { min: 76, max: 100 },
      },
    },
  };

  await prisma.assessmentTemplate.upsert({
    where: { id: "system-lia-template" },
    update: liaTemplate,
    create: { id: "system-lia-template", ...liaTemplate },
  });

  console.log("Created assessment templates");

  // Seed Vendor Questionnaire Template
  const vendorQuestionnaire = {
    name: "Standard Vendor Security Questionnaire",
    description: "A comprehensive questionnaire for vendor due diligence.",
    version: "1.0",
    isSystem: true,
    isActive: true,
    sections: [
      {
        id: "sec1",
        title: "Organization & Governance",
        questions: [
          { id: "org1", text: "Do you have a dedicated information security team?", type: "boolean" },
          { id: "org2", text: "Do you have documented security policies?", type: "boolean" },
          { id: "org3", text: "How often are security policies reviewed?", type: "select", options: ["Annually", "Semi-annually", "Quarterly", "Ad-hoc", "Never"] },
          { id: "org4", text: "Do you have a Data Protection Officer (DPO)?", type: "boolean" },
        ],
      },
      {
        id: "sec2",
        title: "Data Protection",
        questions: [
          { id: "dp1", text: "Do you encrypt personal data at rest?", type: "boolean" },
          { id: "dp2", text: "Do you encrypt personal data in transit?", type: "boolean" },
          { id: "dp3", text: "What encryption standards do you use?", type: "text" },
          { id: "dp4", text: "Do you have data retention and deletion policies?", type: "boolean" },
          { id: "dp5", text: "Can you support DSAR (data subject access request) fulfillment?", type: "boolean" },
        ],
      },
      {
        id: "sec3",
        title: "Access Control",
        questions: [
          { id: "ac1", text: "Do you implement role-based access control?", type: "boolean" },
          { id: "ac2", text: "Do you require multi-factor authentication?", type: "boolean" },
          { id: "ac3", text: "How often are access rights reviewed?", type: "select", options: ["Monthly", "Quarterly", "Annually", "Upon role change", "Never"] },
          { id: "ac4", text: "Do you maintain access logs?", type: "boolean" },
        ],
      },
      {
        id: "sec4",
        title: "Incident Response",
        questions: [
          { id: "ir1", text: "Do you have a documented incident response plan?", type: "boolean" },
          { id: "ir2", text: "Within what timeframe would you notify us of a data breach?", type: "select", options: ["24 hours", "48 hours", "72 hours", "1 week", "No commitment"] },
          { id: "ir3", text: "Have you experienced any data breaches in the past 3 years?", type: "boolean" },
          { id: "ir4", text: "Do you conduct incident response drills?", type: "boolean" },
        ],
      },
      {
        id: "sec5",
        title: "Subprocessors",
        questions: [
          { id: "sp1", text: "Do you use subprocessors to process personal data?", type: "boolean" },
          { id: "sp2", text: "Can you provide a list of current subprocessors?", type: "boolean" },
          { id: "sp3", text: "Do you have data processing agreements with all subprocessors?", type: "boolean" },
          { id: "sp4", text: "Will you notify us before engaging new subprocessors?", type: "boolean" },
        ],
      },
    ],
  };

  await prisma.vendorQuestionnaire.upsert({
    where: { id: "system-vendor-questionnaire" },
    update: vendorQuestionnaire,
    create: { id: "system-vendor-questionnaire", ...vendorQuestionnaire },
  });

  console.log("Created vendor questionnaire template");

  // ============================================================
  // DEMO ORGANIZATION WITH SAMPLE DATA
  // ============================================================

  console.log("Creating demo organization...");

  // Create demo organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: { domain: "privacycloud.com" },
    create: {
      id: "demo-organization",
      name: "Acme Corporation (Demo)",
      slug: "demo",
      domain: "privacycloud.com",
      settings: { isDemo: true },
    },
  });

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@privacysuite.example" },
    update: {},
    create: {
      id: "demo-user",
      email: "demo@privacysuite.example",
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
    where: { id: "demo-dsar-completed" },
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

  // ============================================================
  // DEMO COMPLETED ASSESSMENT
  // ============================================================

  const completedAssessment = await prisma.assessment.upsert({
    where: { id: "demo-assessment-completed" },
    update: {},
    create: {
      id: "demo-assessment-completed",
      organizationId: demoOrg.id,
      templateId: "system-dpia-template",
      processingActivityId: analyticsActivity.id,
      name: "Customer Analytics DPIA",
      description: "Data Protection Impact Assessment for the customer analytics processing activity.",
      status: "APPROVED",
      riskLevel: "MEDIUM",
      riskScore: 42,
      startedAt: new Date("2025-09-01"),
      submittedAt: new Date("2025-09-20"),
      completedAt: new Date("2025-09-25"),
    },
  });

  // Add assessment responses (sample responses)
  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q1_1",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q1_1",
      sectionId: "s1",
      response: "Customer identifiers (name, email, customer ID), behavioral data (page views, purchase history, product preferences), and aggregated analytics data.",
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q1_2",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q1_2",
      sectionId: "s1",
      response: "To analyze customer behavior patterns to improve product recommendations, optimize user experience, and inform business strategy decisions.",
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q1_3",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q1_3",
      sectionId: "s1",
      response: "Legitimate Interests",
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q1_4",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q1_4",
      sectionId: "s1",
      response: ["Customers"],
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q1_5",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q1_5",
      sectionId: "s1",
      response: 150000,
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q2_1",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q2_1",
      sectionId: "s2",
      response: "Yes, essential",
      riskScore: 0.2,
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q3_1",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q3_1",
      sectionId: "s3",
      response: false,
      riskScore: 0,
      responderId: demoUser.id,
    },
  });

  await prisma.assessmentResponse.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId: completedAssessment.id,
        questionId: "q3_2",
      },
    },
    update: {},
    create: {
      assessmentId: completedAssessment.id,
      questionId: "q3_2",
      sectionId: "s3",
      response: false,
      riskScore: 0,
      responderId: demoUser.id,
    },
  });

  // Add assessment approval
  await prisma.assessmentApproval.upsert({
    where: { id: "demo-assessment-approval" },
    update: {},
    create: {
      id: "demo-assessment-approval",
      assessmentId: completedAssessment.id,
      approverId: demoUser.id,
      level: 1,
      status: "APPROVED",
      comments: "Approved. Appropriate safeguards are in place. Please proceed with implementing the recommended mitigations.",
      decidedAt: new Date("2025-09-25"),
    },
  });

  // Add assessment mitigation
  await prisma.assessmentMitigation.upsert({
    where: { id: "demo-assessment-mitigation-1" },
    update: {},
    create: {
      id: "demo-assessment-mitigation-1",
      assessmentId: completedAssessment.id,
      riskId: "risk-data-minimization",
      title: "Implement data minimization review",
      description: "Conduct quarterly reviews to ensure only necessary data is being collected and retained for analytics purposes.",
      status: "IMPLEMENTED",
      priority: 2,
      owner: "Data Team",
      completedAt: new Date("2025-10-15"),
      evidence: "Quarterly review process documented and first review completed. Identified and removed 3 unnecessary data fields.",
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
