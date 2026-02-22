// scripts/seed-demo-scenario.ts
// Comprehensive demo seed: "Meridian Retail Group"
// Usage: npm run db:seed-demo

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = "demo-organization";

function d(s: string): Date {
  return new Date(s);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Meridian Retail Group — Demo Scenario Seed     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Phase 0: Prerequisites ─────────────────────────────────
  const liaTemplate = await prisma.assessmentTemplate.findUnique({ where: { id: "system-lia-template" } });
  const customTemplate = await prisma.assessmentTemplate.findUnique({ where: { id: "system-custom-template" } });
  const vendorQ = await prisma.vendorQuestionnaire.findUnique({ where: { id: "system-vendor-questionnaire" } });

  if (!liaTemplate || !customTemplate || !vendorQ) {
    console.error("Missing prerequisites:");
    if (!liaTemplate) console.error("  - system-lia-template (run: npm run db:seed-templates)");
    if (!customTemplate) console.error("  - system-custom-template (run: npm run db:seed-templates)");
    if (!vendorQ) console.error("  - system-vendor-questionnaire (run: npm run db:seed or npm run db:seed-questionnaire)");
    process.exit(1);
  }
  console.log("✓ Prerequisites verified\n");

  // ── Phase 0.5: Cleanup ─────────────────────────────────────
  console.log("Phase 0: Cleaning existing demo data...");
  await prisma.auditLog.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.incident.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.assessment.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dSARRequest.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dSARIntakeForm.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.vendor.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dataTransfer.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dataFlow.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.processingActivity.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dataElement.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.dataAsset.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.organizationJurisdiction.deleteMany({ where: { organizationId: ORG_ID } });
  console.log("  Done.\n");

  // ── Phase 1: Foundation ────────────────────────────────────
  console.log("Phase 1: Foundation...");

  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: { name: "Meridian Retail Group", domain: "meridianretail.com" },
    create: {
      id: ORG_ID,
      name: "Meridian Retail Group",
      slug: "demo",
      domain: "meridianretail.com",
      settings: { isDemo: true },
    },
  });

  // Users
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@privacysuite.example" },
    update: { name: "Demo User" },
    create: { id: "demo-user", email: "demo@privacysuite.example", name: "Demo User", emailVerified: new Date() },
  });
  const maria = await prisma.user.upsert({
    where: { email: "maria.torres@meridianretail.com" },
    update: { name: "Maria Torres" },
    create: { id: "demo-user-maria", email: "maria.torres@meridianretail.com", name: "Maria Torres", emailVerified: new Date() },
  });
  const james = await prisma.user.upsert({
    where: { email: "james.mitchell@meridianretail.com" },
    update: { name: "James Mitchell" },
    create: { id: "demo-user-james", email: "james.mitchell@meridianretail.com", name: "James Mitchell", emailVerified: new Date() },
  });
  const sophie = await prisma.user.upsert({
    where: { email: "sophie.laurent@meridianretail.com" },
    update: { name: "Sophie Laurent" },
    create: { id: "demo-user-sophie", email: "sophie.laurent@meridianretail.com", name: "Sophie Laurent", emailVerified: new Date() },
  });
  const alex = await prisma.user.upsert({
    where: { email: "alex.petrov@meridianretail.com" },
    update: { name: "Alex Petrov" },
    create: { id: "demo-user-alex", email: "alex.petrov@meridianretail.com", name: "Alex Petrov", emailVerified: new Date() },
  });

  // Members
  const memberData = [
    { id: "demo-member-owner", userId: demoUser.id, role: "OWNER" as const },
    { id: "demo-member-maria", userId: maria.id, role: "PRIVACY_OFFICER" as const },
    { id: "demo-member-james", userId: james.id, role: "ADMIN" as const },
    { id: "demo-member-sophie", userId: sophie.id, role: "MEMBER" as const },
    { id: "demo-member-alex", userId: alex.id, role: "MEMBER" as const },
  ];
  for (const m of memberData) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: m.userId } },
      update: { role: m.role },
      create: { id: m.id, organizationId: org.id, userId: m.userId, role: m.role },
    });
  }

  // Jurisdictions
  const gdpr = await prisma.jurisdiction.findUnique({ where: { code: "GDPR" } });
  const ccpa = await prisma.jurisdiction.findUnique({ where: { code: "CCPA" } });
  const ukGdpr = await prisma.jurisdiction.upsert({
    where: { code: "UK-GDPR" },
    update: {},
    create: {
      code: "UK-GDPR",
      name: "UK General Data Protection Regulation",
      region: "UK",
      dsarDeadlineDays: 30,
      breachNotificationHours: 72,
      dpaCContactInfo: { name: "Information Commissioner's Office (ICO)", website: "https://ico.org.uk/" },
      requirements: { dsarExtensionDays: 60, breachThreshold: "risk to rights and freedoms" },
    },
  });

  if (gdpr) {
    await prisma.organizationJurisdiction.create({
      data: { id: "demo-oj-gdpr", organizationId: org.id, jurisdictionId: gdpr.id, isPrimary: true },
    });
  }
  await prisma.organizationJurisdiction.create({
    data: { id: "demo-oj-ukgdpr", organizationId: org.id, jurisdictionId: ukGdpr.id, isPrimary: false },
  });
  if (ccpa) {
    await prisma.organizationJurisdiction.create({
      data: { id: "demo-oj-ccpa", organizationId: org.id, jurisdictionId: ccpa.id, isPrimary: false },
    });
  }
  console.log("  Org, 5 users, 3 jurisdictions\n");

  // ── Phase 2: Data Inventory ────────────────────────────────
  console.log("Phase 2: Data Inventory...");

  // 12 Data Assets
  const assets = [
    { id: "demo-asset-customer-db", name: "Customer Database", description: "Primary PostgreSQL database storing 2M+ customer accounts, order history, preferences, and loyalty data.", type: "DATABASE" as const, owner: "Engineering", location: "AWS eu-west-1 (Ireland)", hostingType: "Cloud", vendor: "Amazon RDS", isProduction: true },
    { id: "demo-asset-ecommerce", name: "E-commerce Platform", description: "Shopify Plus storefront handling product catalog, shopping cart, checkout, and order management.", type: "APPLICATION" as const, owner: "E-commerce", location: "Shopify Cloud (EU)", hostingType: "Cloud", vendor: "Shopify", isProduction: true },
    { id: "demo-asset-payment", name: "Payment Gateway", description: "Stripe payment processing for credit/debit cards, iDEAL, and SEPA direct debit payments.", type: "THIRD_PARTY" as const, owner: "Finance", location: "Stripe EU (Ireland)", hostingType: "Cloud", vendor: "Stripe", isProduction: true },
    { id: "demo-asset-marketing", name: "Marketing Platform", description: "Klaviyo email/SMS marketing automation with customer segmentation and campaign management.", type: "CLOUD_SERVICE" as const, owner: "Marketing", location: "Klaviyo Cloud (US)", hostingType: "Cloud", vendor: "Klaviyo", isProduction: true },
    { id: "demo-asset-analytics", name: "Analytics Warehouse", description: "Snowflake data warehouse aggregating customer behavior, sales metrics, and business intelligence data.", type: "DATABASE" as const, owner: "Data Team", location: "Snowflake AWS eu-west-1", hostingType: "Cloud", vendor: "Snowflake", isProduction: true },
    { id: "demo-asset-hr", name: "HR System", description: "BambooHR platform managing employee records, payroll, benefits, time-off, and performance reviews.", type: "APPLICATION" as const, owner: "Human Resources", location: "BambooHR Cloud (US)", hostingType: "Cloud", vendor: "BambooHR", isProduction: true },
    { id: "demo-asset-helpdesk", name: "Help Desk", description: "Zendesk customer support platform with ticket management, live chat, and knowledge base.", type: "CLOUD_SERVICE" as const, owner: "Customer Support", location: "Zendesk Cloud (UK)", hostingType: "Cloud", vendor: "Zendesk", isProduction: true },
    { id: "demo-asset-loyalty", name: "Loyalty Program Database", description: "Dedicated database for the Meridian Rewards loyalty program storing points, tiers, and redemption history.", type: "DATABASE" as const, owner: "Marketing", location: "AWS eu-west-1 (Ireland)", hostingType: "Cloud", vendor: "Amazon RDS", isProduction: true },
    { id: "demo-asset-warehouse", name: "Warehouse Management System", description: "SAP WMS handling inventory, picking, packing, and shipping logistics across 3 EU distribution centers.", type: "APPLICATION" as const, owner: "Operations", location: "SAP Cloud (EU)", hostingType: "Cloud", vendor: "SAP", isProduction: true },
    { id: "demo-asset-fileserver", name: "Employee File Server", description: "Azure Blob Storage hosting employee contracts, onboarding docs, and HR policy documents.", type: "FILE_SYSTEM" as const, owner: "Human Resources", location: "Azure West Europe", hostingType: "Cloud", vendor: "Microsoft Azure", isProduction: true },
    { id: "demo-asset-crm", name: "CRM", description: "HubSpot CRM for B2B wholesale accounts, partner management, and sales pipeline tracking.", type: "CLOUD_SERVICE" as const, owner: "Sales", location: "HubSpot Cloud (EU)", hostingType: "Cloud", vendor: "HubSpot", isProduction: true },
    { id: "demo-asset-cookie", name: "Cookie Consent Platform", description: "Cookiebot consent management platform handling cookie banners, consent records, and preference management.", type: "THIRD_PARTY" as const, owner: "Legal / Privacy", location: "Cookiebot Cloud (EU)", hostingType: "Cloud", vendor: "Cookiebot (Usercentrics)", isProduction: true },
  ];
  for (const a of assets) {
    await prisma.dataAsset.create({ data: { ...a, organizationId: org.id } });
  }

  // 28 Data Elements
  const elements = [
    // Customer DB (5)
    { id: "demo-elem-cdb-name", dataAssetId: "demo-asset-customer-db", name: "Customer Full Name", category: "IDENTIFIERS" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    { id: "demo-elem-cdb-email", dataAssetId: "demo-asset-customer-db", name: "Customer Email Address", category: "IDENTIFIERS" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    { id: "demo-elem-cdb-phone", dataAssetId: "demo-asset-customer-db", name: "Customer Phone Number", category: "IDENTIFIERS" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    { id: "demo-elem-cdb-address", dataAssetId: "demo-asset-customer-db", name: "Shipping Address", category: "LOCATION" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    { id: "demo-elem-cdb-orders", dataAssetId: "demo-asset-customer-db", name: "Purchase History", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    // E-commerce (3)
    { id: "demo-elem-ecom-creds", dataAssetId: "demo-asset-ecommerce", name: "Account Credentials", category: "IDENTIFIERS" as const, sensitivity: "RESTRICTED" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    { id: "demo-elem-ecom-session", dataAssetId: "demo-asset-ecommerce", name: "Session Data", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 30, legalBasis: "Legitimate interests" },
    { id: "demo-elem-ecom-browse", dataAssetId: "demo-asset-ecommerce", name: "Browsing & Click History", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 365, legalBasis: "Consent" },
    // Payment Gateway (2)
    { id: "demo-elem-pay-card", dataAssetId: "demo-asset-payment", name: "Payment Card Number (tokenized)", category: "FINANCIAL" as const, sensitivity: "RESTRICTED" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    { id: "demo-elem-pay-billing", dataAssetId: "demo-asset-payment", name: "Billing Address", category: "LOCATION" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 2555, legalBasis: "Contract" },
    // Marketing - Klaviyo (2)
    { id: "demo-elem-mkt-prefs", dataAssetId: "demo-asset-marketing", name: "Email & SMS Preferences", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 1095, legalBasis: "Consent" },
    { id: "demo-elem-mkt-campaigns", dataAssetId: "demo-asset-marketing", name: "Campaign Interaction History", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 1095, legalBasis: "Consent" },
    // Analytics - Snowflake (2)
    { id: "demo-elem-ana-behavior", dataAssetId: "demo-asset-analytics", name: "User Behavior Events", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 730, legalBasis: "Legitimate interests" },
    { id: "demo-elem-ana-demo", dataAssetId: "demo-asset-analytics", name: "Aggregated Demographics", category: "DEMOGRAPHICS" as const, sensitivity: "INTERNAL" as const, isPersonalData: false, retentionDays: 1095, legalBasis: "Legitimate interests" },
    // HR - BambooHR (3)
    { id: "demo-elem-hr-ssn", dataAssetId: "demo-asset-hr", name: "National ID / BSN", category: "IDENTIFIERS" as const, sensitivity: "RESTRICTED" as const, isPersonalData: true, isSpecialCategory: false, retentionDays: 3650, legalBasis: "Legal obligation" },
    { id: "demo-elem-hr-salary", dataAssetId: "demo-asset-hr", name: "Salary & Compensation", category: "FINANCIAL" as const, sensitivity: "RESTRICTED" as const, isPersonalData: true, retentionDays: 3650, legalBasis: "Contract" },
    { id: "demo-elem-hr-history", dataAssetId: "demo-asset-hr", name: "Employment History", category: "EMPLOYMENT" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 3650, legalBasis: "Contract" },
    // Helpdesk - Zendesk (2)
    { id: "demo-elem-hd-tickets", dataAssetId: "demo-asset-helpdesk", name: "Support Ticket Content", category: "OTHER" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 1095, legalBasis: "Contract" },
    { id: "demo-elem-hd-contact", dataAssetId: "demo-asset-helpdesk", name: "Customer Contact Info", category: "IDENTIFIERS" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 1095, legalBasis: "Contract" },
    // Loyalty DB (2)
    { id: "demo-elem-loy-points", dataAssetId: "demo-asset-loyalty", name: "Loyalty Points Balance", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 1825, legalBasis: "Contract" },
    { id: "demo-elem-loy-prefs", dataAssetId: "demo-asset-loyalty", name: "Reward Preferences", category: "BEHAVIORAL" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 1825, legalBasis: "Contract" },
    // Warehouse (1)
    { id: "demo-elem-wms-addr", dataAssetId: "demo-asset-warehouse", name: "Delivery Address", category: "LOCATION" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 365, legalBasis: "Contract" },
    // File Server (2)
    { id: "demo-elem-fs-contracts", dataAssetId: "demo-asset-fileserver", name: "Employee Contracts", category: "EMPLOYMENT" as const, sensitivity: "RESTRICTED" as const, isPersonalData: true, retentionDays: 3650, legalBasis: "Contract" },
    { id: "demo-elem-fs-reviews", dataAssetId: "demo-asset-fileserver", name: "Performance Reviews", category: "EMPLOYMENT" as const, sensitivity: "RESTRICTED" as const, isPersonalData: true, retentionDays: 3650, legalBasis: "Legitimate interests" },
    // CRM - HubSpot (2)
    { id: "demo-elem-crm-leads", dataAssetId: "demo-asset-crm", name: "B2B Contact Information", category: "IDENTIFIERS" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 1095, legalBasis: "Legitimate interests" },
    { id: "demo-elem-crm-notes", dataAssetId: "demo-asset-crm", name: "Sales Notes & Correspondence", category: "OTHER" as const, sensitivity: "CONFIDENTIAL" as const, isPersonalData: true, retentionDays: 1095, legalBasis: "Legitimate interests" },
    // Cookie Consent (2)
    { id: "demo-elem-cc-records", dataAssetId: "demo-asset-cookie", name: "Consent Records", category: "OTHER" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 1825, legalBasis: "Legal obligation" },
    { id: "demo-elem-cc-ids", dataAssetId: "demo-asset-cookie", name: "Cookie Identifiers", category: "IDENTIFIERS" as const, sensitivity: "INTERNAL" as const, isPersonalData: true, retentionDays: 365, legalBasis: "Consent" },
  ];
  for (const e of elements) {
    await prisma.dataElement.create({
      data: { ...e, organizationId: org.id },
    });
  }

  // 8 Processing Activities
  const paOrders = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-orders", organizationId: org.id,
      name: "Order Processing & Fulfillment",
      description: "End-to-end processing of customer orders including payment, picking, packing, shipping, and delivery confirmation.",
      purpose: "To fulfill purchase agreements with customers, process payments, and deliver ordered goods.",
      legalBasis: "CONTRACT",
      legalBasisDetail: "Processing is necessary for the performance of the sales contract with the customer.",
      dataSubjects: ["Customers"],
      categories: ["IDENTIFIERS", "FINANCIAL", "LOCATION"],
      recipients: ["Fulfillment team", "Payment processor (Stripe)", "Shipping carriers"],
      retentionPeriod: "7 years (tax/accounting requirements)",
      retentionDays: 2555,
      isActive: true,
      lastReviewedAt: d("2025-09-15"),
      nextReviewAt: d("2026-09-15"),
    },
  });

  const paAccounts = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-accounts", organizationId: org.id,
      name: "Customer Account Management",
      description: "Creating and maintaining customer accounts, authentication, profile management, and account preferences.",
      purpose: "To manage customer accounts, enable login/authentication, and maintain customer preferences.",
      legalBasis: "CONTRACT",
      legalBasisDetail: "Processing is necessary for the performance of the service agreement with the customer.",
      dataSubjects: ["Customers"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Customer service team"],
      retentionPeriod: "Duration of account + 2 years",
      retentionDays: 2555,
      isActive: true,
      lastReviewedAt: d("2025-10-01"),
      nextReviewAt: d("2026-10-01"),
    },
  });

  const paMarketing = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-email-marketing", organizationId: org.id,
      name: "Email & SMS Marketing",
      description: "Sending promotional emails and SMS messages including newsletters, product recommendations, and seasonal campaigns.",
      purpose: "To promote products and services to customers who have opted in to marketing communications.",
      legalBasis: "CONSENT",
      legalBasisDetail: "Customers explicitly opt-in to marketing communications via checkbox during registration and can unsubscribe at any time.",
      dataSubjects: ["Customers", "Newsletter subscribers"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Marketing team", "Klaviyo (email/SMS provider)"],
      retentionPeriod: "Until consent withdrawn + 30 days",
      retentionDays: 1095,
      isActive: true,
      lastReviewedAt: d("2025-08-20"),
      nextReviewAt: d("2026-08-20"),
    },
  });

  const paAnalytics = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-analytics", organizationId: org.id,
      name: "Customer Analytics & Business Intelligence",
      description: "Analyzing customer behavior, purchase patterns, and website usage to improve products and optimize the shopping experience.",
      purpose: "To understand customer needs, improve product offerings, and optimize business operations through data-driven insights.",
      legalBasis: "LEGITIMATE_INTERESTS",
      legalBasisDetail: "Meridian has a legitimate interest in understanding customer behavior to improve services. A Legitimate Interest Assessment has been completed.",
      dataSubjects: ["Customers", "Website visitors"],
      categories: ["BEHAVIORAL", "DEMOGRAPHICS"],
      recipients: ["Data analytics team", "Product team"],
      retentionPeriod: "2 years (aggregated data retained longer)",
      retentionDays: 730,
      automatedDecisionMaking: false,
      isActive: true,
      lastReviewedAt: d("2025-11-01"),
      nextReviewAt: d("2026-05-01"),
    },
  });

  const paLoyalty = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-loyalty", organizationId: org.id,
      name: "Meridian Rewards Loyalty Program",
      description: "Managing the loyalty program including points accrual, tier status, reward redemptions, and personalized offers.",
      purpose: "To operate the Meridian Rewards loyalty program and provide personalized member benefits.",
      legalBasis: "CONTRACT",
      legalBasisDetail: "Processing is necessary for the performance of the loyalty program terms accepted by the member.",
      dataSubjects: ["Loyalty program members"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Marketing team", "Customer service team"],
      retentionPeriod: "Duration of membership + 5 years",
      retentionDays: 1825,
      isActive: true,
      lastReviewedAt: d("2025-07-10"),
      nextReviewAt: d("2026-07-10"),
    },
  });

  const paEmployment = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-employment", organizationId: org.id,
      name: "Employment Records Management",
      description: "Processing employee data for HR purposes including payroll, benefits administration, performance management, and legal compliance.",
      purpose: "To manage the employment relationship, fulfill legal obligations, and administer employee benefits and compensation.",
      legalBasis: "CONTRACT",
      legalBasisDetail: "Processing is necessary for the performance of employment contracts and to comply with Dutch/EU employment law.",
      dataSubjects: ["Employees", "Job applicants", "Former employees"],
      categories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
      recipients: ["HR team", "Payroll provider", "Tax authorities"],
      retentionPeriod: "10 years after employment ends",
      retentionDays: 3650,
      isActive: true,
      lastReviewedAt: d("2025-06-01"),
      nextReviewAt: d("2026-06-01"),
    },
  });

  const paSupport = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-support", organizationId: org.id,
      name: "Customer Support & Service",
      description: "Handling customer inquiries, complaints, returns, and support tickets via email, chat, and phone.",
      purpose: "To provide customer support, resolve issues, and process returns and refunds.",
      legalBasis: "CONTRACT",
      legalBasisDetail: "Processing is necessary to fulfill our contractual obligations to provide after-sale support.",
      dataSubjects: ["Customers"],
      categories: ["IDENTIFIERS", "OTHER"],
      recipients: ["Customer support team", "Zendesk (helpdesk platform)"],
      retentionPeriod: "3 years from ticket closure",
      retentionDays: 1095,
      isActive: true,
      lastReviewedAt: d("2025-12-01"),
      nextReviewAt: d("2026-12-01"),
    },
  });

  const paFraud = await prisma.processingActivity.create({
    data: {
      id: "demo-pa-fraud", organizationId: org.id,
      name: "Fraud Detection & Prevention",
      description: "Automated screening of transactions for fraud indicators, velocity checks, and suspicious pattern detection.",
      purpose: "To detect and prevent fraudulent transactions, protecting both the company and customers from financial crime.",
      legalBasis: "LEGITIMATE_INTERESTS",
      legalBasisDetail: "Meridian has a legitimate interest in preventing fraud. This is also supported by PSD2 requirements for strong customer authentication.",
      dataSubjects: ["Customers", "Website visitors"],
      categories: ["IDENTIFIERS", "FINANCIAL", "BEHAVIORAL"],
      recipients: ["Risk/fraud team", "Stripe (fraud screening)"],
      retentionPeriod: "5 years (regulatory requirement)",
      retentionDays: 1825,
      automatedDecisionMaking: true,
      automatedDecisionDetail: "Automated fraud scoring may result in transaction blocks. Manual review process available for flagged transactions.",
      isActive: true,
      lastReviewedAt: d("2025-11-15"),
      nextReviewAt: d("2026-05-15"),
    },
  });

  // Processing Activity ↔ Asset links (~21)
  const paaLinks = [
    { id: "demo-paa-orders-cdb", processingActivityId: paOrders.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-orders-ecom", processingActivityId: paOrders.id, dataAssetId: "demo-asset-ecommerce" },
    { id: "demo-paa-orders-pay", processingActivityId: paOrders.id, dataAssetId: "demo-asset-payment" },
    { id: "demo-paa-orders-wms", processingActivityId: paOrders.id, dataAssetId: "demo-asset-warehouse" },
    { id: "demo-paa-accounts-cdb", processingActivityId: paAccounts.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-accounts-ecom", processingActivityId: paAccounts.id, dataAssetId: "demo-asset-ecommerce" },
    { id: "demo-paa-mkt-mkt", processingActivityId: paMarketing.id, dataAssetId: "demo-asset-marketing" },
    { id: "demo-paa-mkt-crm", processingActivityId: paMarketing.id, dataAssetId: "demo-asset-crm" },
    { id: "demo-paa-mkt-cdb", processingActivityId: paMarketing.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-ana-ana", processingActivityId: paAnalytics.id, dataAssetId: "demo-asset-analytics" },
    { id: "demo-paa-ana-cdb", processingActivityId: paAnalytics.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-ana-ecom", processingActivityId: paAnalytics.id, dataAssetId: "demo-asset-ecommerce" },
    { id: "demo-paa-loy-loy", processingActivityId: paLoyalty.id, dataAssetId: "demo-asset-loyalty" },
    { id: "demo-paa-loy-cdb", processingActivityId: paLoyalty.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-emp-hr", processingActivityId: paEmployment.id, dataAssetId: "demo-asset-hr" },
    { id: "demo-paa-emp-fs", processingActivityId: paEmployment.id, dataAssetId: "demo-asset-fileserver" },
    { id: "demo-paa-sup-hd", processingActivityId: paSupport.id, dataAssetId: "demo-asset-helpdesk" },
    { id: "demo-paa-sup-cdb", processingActivityId: paSupport.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-fraud-pay", processingActivityId: paFraud.id, dataAssetId: "demo-asset-payment" },
    { id: "demo-paa-fraud-cdb", processingActivityId: paFraud.id, dataAssetId: "demo-asset-customer-db" },
    { id: "demo-paa-fraud-ana", processingActivityId: paFraud.id, dataAssetId: "demo-asset-analytics" },
  ];
  for (const link of paaLinks) {
    await prisma.processingActivityAsset.create({ data: link });
  }

  // 10 Data Flows
  const flows = [
    { id: "demo-flow-1", name: "Orders → Customer DB", description: "New orders and customer details synced from Shopify to the customer database.", sourceAssetId: "demo-asset-ecommerce", destinationAssetId: "demo-asset-customer-db", dataCategories: ["IDENTIFIERS" as const, "FINANCIAL" as const], frequency: "Real-time", volume: "~5,000 orders/day", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "demo-flow-2", name: "Customer DB → Analytics", description: "Customer behavior and transaction data ETL'd nightly into Snowflake for BI dashboards.", sourceAssetId: "demo-asset-customer-db", destinationAssetId: "demo-asset-analytics", dataCategories: ["IDENTIFIERS" as const, "BEHAVIORAL" as const], frequency: "Daily (02:00 UTC)", volume: "~2 GB/day", encryptionMethod: "TLS 1.3 + AES-256", isAutomated: true },
    { id: "demo-flow-3", name: "Customer DB → Marketing", description: "Customer segments and email lists synced to Klaviyo for campaign targeting.", sourceAssetId: "demo-asset-customer-db", destinationAssetId: "demo-asset-marketing", dataCategories: ["IDENTIFIERS" as const, "BEHAVIORAL" as const], frequency: "Every 6 hours", volume: "~500K records", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "demo-flow-4", name: "E-commerce → Payment", description: "Checkout payment data sent to Stripe for transaction processing.", sourceAssetId: "demo-asset-ecommerce", destinationAssetId: "demo-asset-payment", dataCategories: ["FINANCIAL" as const, "IDENTIFIERS" as const], frequency: "Real-time", volume: "~5,000 txns/day", encryptionMethod: "TLS 1.3 + PCI DSS tokenization", isAutomated: true },
    { id: "demo-flow-5", name: "CRM → Marketing", description: "B2B contact data and campaign lists synced between HubSpot and Klaviyo.", sourceAssetId: "demo-asset-crm", destinationAssetId: "demo-asset-marketing", dataCategories: ["IDENTIFIERS" as const], frequency: "Daily", volume: "~10K contacts", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "demo-flow-6", name: "Customer DB → Loyalty", description: "Customer purchases trigger loyalty points accrual in the rewards database.", sourceAssetId: "demo-asset-customer-db", destinationAssetId: "demo-asset-loyalty", dataCategories: ["IDENTIFIERS" as const, "BEHAVIORAL" as const], frequency: "Real-time", volume: "~3,000 events/day", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "demo-flow-7", name: "Helpdesk → Customer DB", description: "Support ticket metadata and resolution status synced back to customer records.", sourceAssetId: "demo-asset-helpdesk", destinationAssetId: "demo-asset-customer-db", dataCategories: ["IDENTIFIERS" as const, "OTHER" as const], frequency: "Real-time", volume: "~200 tickets/day", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "demo-flow-8", name: "HR → File Server", description: "Employee documents (contracts, reviews) stored to Azure Blob Storage.", sourceAssetId: "demo-asset-hr", destinationAssetId: "demo-asset-fileserver", dataCategories: ["EMPLOYMENT" as const, "IDENTIFIERS" as const], frequency: "On-demand", volume: "~50 docs/month", encryptionMethod: "TLS 1.3 + AES-256 at rest", isAutomated: false },
    { id: "demo-flow-9", name: "Cookie Consent → Analytics", description: "Consent signals sent to Snowflake to ensure analytics only processes consented data.", sourceAssetId: "demo-asset-cookie", destinationAssetId: "demo-asset-analytics", dataCategories: ["OTHER" as const], frequency: "Real-time", volume: "~50K signals/day", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "demo-flow-10", name: "E-commerce → Warehouse", description: "Order details sent to SAP WMS for picking, packing, and shipping.", sourceAssetId: "demo-asset-ecommerce", destinationAssetId: "demo-asset-warehouse", dataCategories: ["IDENTIFIERS" as const, "LOCATION" as const], frequency: "Real-time", volume: "~5,000 orders/day", encryptionMethod: "TLS 1.3", isAutomated: true },
  ];
  for (const f of flows) {
    await prisma.dataFlow.create({ data: { ...f, organizationId: org.id } });
  }

  // 4 Data Transfers
  const transfers = [
    { id: "demo-transfer-1", name: "EU → US: Snowflake Analytics", description: "Customer behavior data transferred to Snowflake's US-based processing for analytics workloads not available in EU region.", destinationCountry: "US", destinationOrg: "Snowflake Inc.", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" as const, safeguards: "EU SCCs (Module 2: Controller to Processor), supplementary encryption measures, annual TIA review.", tiaCompleted: true, tiaDate: d("2025-06-15"), processingActivityId: paAnalytics.id, jurisdictionId: gdpr?.id },
    { id: "demo-transfer-2", name: "EU → US: Stripe Payments", description: "Payment data processed by Stripe Inc. in the US for fraud detection and settlement.", destinationCountry: "US", destinationOrg: "Stripe Inc.", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" as const, safeguards: "EU SCCs (Module 2), PCI DSS Level 1 compliance, tokenization of card data.", tiaCompleted: true, tiaDate: d("2025-04-20"), processingActivityId: paOrders.id, jurisdictionId: gdpr?.id },
    { id: "demo-transfer-3", name: "EU → UK: Zendesk Support", description: "Customer support data stored in Zendesk's UK data center for the support team.", destinationCountry: "GB", destinationOrg: "Zendesk Inc.", mechanism: "ADEQUACY_DECISION" as const, safeguards: "UK adequacy decision (June 2021), Zendesk UK data residency.", tiaCompleted: false, processingActivityId: paSupport.id, jurisdictionId: gdpr?.id },
    { id: "demo-transfer-4", name: "EU → India: IT Support", description: "Limited access to production systems by TechServe India offshore IT support team for L2/L3 escalations.", destinationCountry: "IN", destinationOrg: "TechServe Solutions Pvt. Ltd.", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" as const, safeguards: "EU SCCs (Module 2), VPN-only access, no data download policy, monitoring & audit logs.", tiaCompleted: true, tiaDate: d("2025-08-10"), jurisdictionId: gdpr?.id },
  ];
  for (const t of transfers) {
    await prisma.dataTransfer.create({ data: { ...t, organizationId: org.id } });
  }
  console.log("  12 assets, 28 elements, 8 activities, 21 links, 10 flows, 4 transfers\n");

  // ── Phase 3: Vendors ───────────────────────────────────────
  console.log("Phase 3: Vendors...");

  const vendorData = [
    { id: "demo-vendor-shopify", name: "Shopify", description: "E-commerce platform powering our online storefront, checkout, and order management.", website: "https://shopify.com", status: "ACTIVE" as const, riskTier: "MEDIUM" as const, riskScore: 35, primaryContact: "Shopify Partner Manager", contactEmail: "partners@shopify.com", categories: ["E-commerce Platform"], dataProcessed: ["IDENTIFIERS" as const, "FINANCIAL" as const, "BEHAVIORAL" as const], countries: ["CA", "US", "IE"], certifications: ["SOC 2 Type II", "PCI DSS Level 1", "ISO 27001"], lastAssessedAt: d("2025-07-15"), nextReviewAt: d("2026-07-15") },
    { id: "demo-vendor-stripe", name: "Stripe", description: "Payment processing platform handling credit cards, iDEAL, SEPA, and fraud detection.", website: "https://stripe.com", status: "ACTIVE" as const, riskTier: "HIGH" as const, riskScore: 28, primaryContact: "Stripe Account Manager", contactEmail: "enterprise@stripe.com", categories: ["Payment Processing", "Fraud Detection"], dataProcessed: ["FINANCIAL" as const, "IDENTIFIERS" as const], countries: ["US", "IE", "SG"], certifications: ["PCI DSS Level 1", "SOC 2 Type II", "ISO 27001"], lastAssessedAt: d("2025-09-01"), nextReviewAt: d("2026-03-01") },
    { id: "demo-vendor-klaviyo", name: "Klaviyo", description: "Email and SMS marketing automation platform for customer engagement and campaign management.", website: "https://klaviyo.com", status: "ACTIVE" as const, riskTier: "MEDIUM" as const, riskScore: 42, primaryContact: "Klaviyo CSM", contactEmail: "support@klaviyo.com", categories: ["Email Marketing", "SMS Marketing"], dataProcessed: ["IDENTIFIERS" as const, "BEHAVIORAL" as const], countries: ["US"], certifications: ["SOC 2 Type II"], lastAssessedAt: d("2025-10-15"), nextReviewAt: d("2026-04-15") },
    { id: "demo-vendor-snowflake", name: "Snowflake", description: "Cloud data warehouse for analytics, business intelligence, and data sharing.", website: "https://snowflake.com", status: "ACTIVE" as const, riskTier: "MEDIUM" as const, riskScore: 38, primaryContact: "Snowflake Account Team", contactEmail: "support@snowflake.com", categories: ["Data Analytics", "Cloud Storage"], dataProcessed: ["IDENTIFIERS" as const, "BEHAVIORAL" as const, "DEMOGRAPHICS" as const], countries: ["US", "EU"], certifications: ["ISO 27001", "SOC 2 Type II", "FedRAMP", "HIPAA"], lastAssessedAt: d("2025-08-20"), nextReviewAt: d("2026-02-20") },
    { id: "demo-vendor-bamboohr", name: "BambooHR", description: "Human resources information system for employee records, payroll, and performance management.", website: "https://bamboohr.com", status: "ACTIVE" as const, riskTier: "HIGH" as const, riskScore: 45, primaryContact: "BambooHR Support", contactEmail: "support@bamboohr.com", categories: ["HR Management", "Payroll"], dataProcessed: ["IDENTIFIERS" as const, "FINANCIAL" as const, "EMPLOYMENT" as const], countries: ["US"], certifications: ["SOC 2 Type II"], lastAssessedAt: d("2025-06-01"), nextReviewAt: d("2026-06-01") },
    { id: "demo-vendor-zendesk", name: "Zendesk", description: "Customer support platform providing ticketing, live chat, knowledge base, and customer analytics.", website: "https://zendesk.com", status: "ACTIVE" as const, riskTier: "LOW" as const, riskScore: 22, primaryContact: "Zendesk Account Executive", contactEmail: "enterprise@zendesk.com", categories: ["Customer Support", "Help Desk"], dataProcessed: ["IDENTIFIERS" as const, "OTHER" as const], countries: ["US", "GB", "AU"], certifications: ["ISO 27001", "SOC 2 Type II", "ISO 27018"], lastAssessedAt: d("2025-11-10"), nextReviewAt: d("2026-05-10") },
    { id: "demo-vendor-hubspot", name: "HubSpot", description: "CRM platform for B2B sales pipeline, partner management, and marketing automation.", website: "https://hubspot.com", status: "ACTIVE" as const, riskTier: "LOW" as const, riskScore: 25, primaryContact: "HubSpot CSM", contactEmail: "support@hubspot.com", categories: ["CRM", "Sales"], dataProcessed: ["IDENTIFIERS" as const], countries: ["US", "IE", "DE"], certifications: ["SOC 2 Type II", "ISO 27001"], lastAssessedAt: d("2025-05-20"), nextReviewAt: d("2026-05-20") },
    { id: "demo-vendor-cookiebot", name: "Cookiebot (Usercentrics)", description: "Cookie consent management platform ensuring GDPR/ePrivacy compliance for web properties.", website: "https://cookiebot.com", status: "ACTIVE" as const, riskTier: "LOW" as const, riskScore: 15, primaryContact: "Cookiebot Support", contactEmail: "support@cookiebot.com", categories: ["Consent Management", "Privacy"], dataProcessed: ["OTHER" as const, "IDENTIFIERS" as const], countries: ["DK", "DE"], certifications: ["ISO 27001"], lastAssessedAt: d("2025-12-01"), nextReviewAt: d("2026-12-01") },
    { id: "demo-vendor-sap", name: "SAP", description: "Enterprise WMS for warehouse operations, inventory management, and logistics optimization.", website: "https://sap.com", status: "UNDER_REVIEW" as const, riskTier: "MEDIUM" as const, riskScore: 48, primaryContact: "SAP Account Director", contactEmail: "enterprise@sap.com", categories: ["Warehouse Management", "ERP"], dataProcessed: ["IDENTIFIERS" as const, "LOCATION" as const], countries: ["DE", "US", "IN"], certifications: ["ISO 27001", "SOC 2 Type II", "ISO 27017"], lastAssessedAt: d("2025-03-15"), nextReviewAt: d("2026-03-15") },
    { id: "demo-vendor-techserve", name: "TechServe Solutions", description: "Offshore IT support provider handling L2/L3 infrastructure and application support.", website: "https://techservesolutions.example.com", status: "PROSPECTIVE" as const, riskTier: "HIGH" as const, riskScore: 62, primaryContact: "Rajesh Kapoor", contactEmail: "rajesh.kapoor@techserve.example.com", categories: ["IT Support", "Managed Services"], dataProcessed: ["IDENTIFIERS" as const, "EMPLOYMENT" as const], countries: ["IN"], certifications: ["ISO 27001"], lastAssessedAt: null, nextReviewAt: d("2026-04-01") },
  ];
  for (const v of vendorData) {
    await prisma.vendor.create({ data: { ...v, organizationId: org.id } });
  }

  // 8 Vendor Contracts
  const contracts = [
    { id: "demo-contract-1", vendorId: "demo-vendor-shopify", type: "DPA" as const, status: "ACTIVE" as const, name: "Shopify Data Processing Addendum", startDate: d("2024-01-15"), endDate: d("2027-01-15"), autoRenewal: true, value: 48000, currency: "EUR" },
    { id: "demo-contract-2", vendorId: "demo-vendor-stripe", type: "DPA" as const, status: "ACTIVE" as const, name: "Stripe Data Processing Agreement", startDate: d("2024-03-01"), endDate: d("2027-03-01"), autoRenewal: true },
    { id: "demo-contract-3", vendorId: "demo-vendor-klaviyo", type: "DPA" as const, status: "ACTIVE" as const, name: "Klaviyo Data Processing Agreement", startDate: d("2024-06-01"), endDate: d("2026-06-01"), autoRenewal: true, value: 24000, currency: "EUR" },
    { id: "demo-contract-4", vendorId: "demo-vendor-snowflake", type: "MSA" as const, status: "ACTIVE" as const, name: "Snowflake Enterprise Agreement", startDate: d("2024-02-01"), endDate: d("2027-02-01"), autoRenewal: false, value: 96000, currency: "EUR" },
    { id: "demo-contract-5", vendorId: "demo-vendor-bamboohr", type: "DPA" as const, status: "ACTIVE" as const, name: "BambooHR Data Processing Agreement", startDate: d("2023-09-01"), endDate: d("2026-09-01"), autoRenewal: true, value: 18000, currency: "USD" },
    { id: "demo-contract-6", vendorId: "demo-vendor-zendesk", type: "DPA" as const, status: "EXPIRED" as const, name: "Zendesk DPA v2.0", description: "Previous DPA — renewal pending with updated SCCs.", startDate: d("2023-01-01"), endDate: d("2025-12-31"), autoRenewal: false },
    { id: "demo-contract-7", vendorId: "demo-vendor-sap", type: "NDA" as const, status: "ACTIVE" as const, name: "SAP Mutual Non-Disclosure Agreement", startDate: d("2025-01-10"), endDate: d("2027-01-10"), autoRenewal: false },
    { id: "demo-contract-8", vendorId: "demo-vendor-techserve", type: "MSA" as const, status: "PENDING_SIGNATURE" as const, name: "TechServe IT Support Services Agreement", description: "Pending legal review of data access provisions and SCC annex.", startDate: d("2026-03-01"), endDate: d("2028-03-01"), autoRenewal: false, value: 120000, currency: "EUR" },
  ];
  for (const c of contracts) {
    await prisma.vendorContract.create({ data: c });
  }

  // 4 Vendor Reviews
  const reviews = [
    { id: "demo-review-1", vendorId: "demo-vendor-stripe", reviewerId: maria.id, type: "PERIODIC" as const, status: "COMPLETED" as const, scheduledAt: d("2025-09-01"), completedAt: d("2025-09-15"), findings: "Stripe maintains excellent security posture. PCI DSS Level 1 certified, SOC 2 Type II report reviewed. No material findings.", riskLevel: "LOW" as const, recommendations: "Continue current engagement. Schedule next review in 6 months.", nextReviewAt: d("2026-03-01") },
    { id: "demo-review-2", vendorId: "demo-vendor-snowflake", reviewerId: maria.id, type: "RENEWAL" as const, status: "IN_PROGRESS" as const, scheduledAt: d("2026-01-15"), findings: "Enterprise agreement renewal due Feb 2027. Reviewing updated data processing terms and EU data residency options.", riskLevel: "MEDIUM" as const },
    { id: "demo-review-3", vendorId: "demo-vendor-sap", reviewerId: sophie.id, type: "PERIODIC" as const, status: "TODO" as const, scheduledAt: d("2026-03-15") },
    { id: "demo-review-4", vendorId: "demo-vendor-techserve", reviewerId: maria.id, type: "INITIAL" as const, status: "IN_PROGRESS" as const, scheduledAt: d("2026-02-01"), findings: "Initial due diligence in progress. ISO 27001 certificate verified. Awaiting completed security questionnaire and evidence of GDPR awareness training.", riskLevel: "HIGH" as const },
  ];
  for (const r of reviews) {
    await prisma.vendorReview.create({ data: r });
  }

  // 3 Questionnaire Responses
  await prisma.vendorQuestionnaireResponse.create({
    data: {
      id: "demo-qr-stripe", vendorId: "demo-vendor-stripe", questionnaireId: vendorQ.id,
      status: "APPROVED", submittedAt: d("2025-08-20"), reviewedAt: d("2025-09-01"),
      reviewNotes: "Excellent responses across all categories. Stripe demonstrates industry-leading security practices.",
      score: 92,
      responses: {
        org1: true, org2: true, org3: "Quarterly", org4: true,
        dp1: true, dp2: true, dp3: "AES-256 at rest, TLS 1.3 in transit", dp4: true, dp5: true,
        ac1: true, ac2: true, ac3: "Monthly", ac4: true,
        ir1: true, ir2: "24 hours", ir3: false, ir4: true,
        sp1: true, sp2: true, sp3: true, sp4: true,
      },
    },
  });

  await prisma.vendorQuestionnaireResponse.create({
    data: {
      id: "demo-qr-snowflake", vendorId: "demo-vendor-snowflake", questionnaireId: vendorQ.id,
      status: "SUBMITTED", submittedAt: d("2026-01-28"),
      score: 78,
      responses: {
        org1: true, org2: true, org3: "Annually", org4: true,
        dp1: true, dp2: true, dp3: "AES-256, TLS 1.2+", dp4: true, dp5: true,
        ac1: true, ac2: true, ac3: "Quarterly", ac4: true,
        ir1: true, ir2: "72 hours", ir3: false, ir4: true,
        sp1: true, sp2: true, sp3: true, sp4: true,
      },
    },
  });

  await prisma.vendorQuestionnaireResponse.create({
    data: {
      id: "demo-qr-sap", vendorId: "demo-vendor-sap", questionnaireId: vendorQ.id,
      status: "IN_PROGRESS",
      responses: {
        org1: true, org2: true, org3: "Annually", org4: true,
        dp1: true, dp2: true,
      },
    },
  });
  console.log("  10 vendors, 8 contracts, 4 reviews, 3 questionnaire responses\n");

  // ── Phase 4: DSARs ─────────────────────────────────────────
  console.log("Phase 4: DSARs...");

  // Intake Form
  await prisma.dSARIntakeForm.create({
    data: {
      id: "demo-intake-form", organizationId: org.id,
      name: "Meridian Privacy Request Form", slug: "privacy-request",
      title: "Submit a Privacy Request",
      description: "Use this form to exercise your data protection rights. We will respond within 30 days.",
      enabledTypes: ["ACCESS", "ERASURE", "PORTABILITY", "RECTIFICATION", "OBJECTION", "RESTRICTION"],
      fields: [
        { id: "name", label: "Full Name", type: "text", required: true },
        { id: "email", label: "Email Address", type: "email", required: true },
        { id: "phone", label: "Phone Number", type: "tel", required: false },
        { id: "relationship", label: "Your Relationship to Us", type: "select", options: ["Customer", "Employee", "Job Applicant", "Website Visitor", "Other"], required: true },
        { id: "details", label: "Request Details", type: "textarea", required: true, helpText: "Please describe the data you would like us to access, delete, or correct." },
        { id: "id_upload", label: "Identity Verification Document", type: "file", required: false, helpText: "Upload a copy of your ID to help us verify your identity." },
      ],
      thankYouMessage: "Thank you for your privacy request. We have assigned reference number {{publicId}} to your request and will respond within 30 days. You will receive an acknowledgment email shortly.",
      isActive: true,
    },
  });

  // DSAR 1: COMPLETED access request
  const dsar1 = await prisma.dSARRequest.create({
    data: {
      id: "demo-dsar-1", organizationId: org.id, publicId: "DSAR-2025-0042",
      type: "ACCESS", status: "COMPLETED",
      requesterName: "Anna van der Berg", requesterEmail: "anna.vdb@example.com",
      relationship: "Customer",
      description: "I would like a complete copy of all personal data you hold about me, including my order history, loyalty points, and any marketing profiles.",
      receivedAt: d("2025-10-01"), acknowledgedAt: d("2025-10-01"),
      dueDate: d("2025-10-31"), completedAt: d("2025-10-25"),
      verificationMethod: "Email verification + order number match",
      verifiedAt: d("2025-10-02"),
      responseMethod: "Secure portal download",
      responseNotes: "Data export provided via secure download link. Customer confirmed receipt on 2025-10-26.",
    },
  });

  // DSAR 1 Tasks
  await prisma.dSARTask.create({ data: { id: "demo-dsar1-task1", dsarRequestId: dsar1.id, dataAssetId: "demo-asset-customer-db", assigneeId: alex.id, title: "Export customer account & order data", description: "Extract account profile, order history (3 years), and shipping addresses.", status: "COMPLETED", completedAt: d("2025-10-15"), notes: "Exported 234 orders, 12 addresses. File: anna-vdb-customerdb.json" } });
  await prisma.dSARTask.create({ data: { id: "demo-dsar1-task2", dsarRequestId: dsar1.id, dataAssetId: "demo-asset-marketing", assigneeId: alex.id, title: "Export marketing preferences & campaigns", description: "Extract email preferences, consent records, and campaign interaction history from Klaviyo.", status: "COMPLETED", completedAt: d("2025-10-18"), notes: "18 months of campaign engagement data exported." } });
  await prisma.dSARTask.create({ data: { id: "demo-dsar1-task3", dsarRequestId: dsar1.id, dataAssetId: "demo-asset-loyalty", assigneeId: sophie.id, title: "Export loyalty program data", description: "Extract loyalty tier, points balance, and redemption history.", status: "COMPLETED", completedAt: d("2025-10-16"), notes: "Gold tier member, 4,520 points, 8 redemptions." } });

  // DSAR 1 Communications
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar1-comm1", dsarRequestId: dsar1.id, direction: "INBOUND", channel: "Portal", subject: "Data Access Request", content: "I would like to request access to all personal data you hold about me under GDPR Article 15. My account email is anna.vdb@example.com.", sentAt: d("2025-10-01") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar1-comm2", dsarRequestId: dsar1.id, direction: "OUTBOUND", channel: "Email", subject: "RE: Your Privacy Request DSAR-2025-0042 — Acknowledgement", content: "Dear Anna, thank you for your data access request. We have received it and will respond within 30 days. For identity verification, please confirm your most recent order number.", sentById: maria.id, sentAt: d("2025-10-01") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar1-comm3", dsarRequestId: dsar1.id, direction: "INBOUND", channel: "Email", subject: "RE: Identity verification", content: "My most recent order number is MRG-2025-89421. Placed on September 15.", sentAt: d("2025-10-02") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar1-comm4", dsarRequestId: dsar1.id, direction: "OUTBOUND", channel: "Email", subject: "Your Data Export is Ready — DSAR-2025-0042", content: "Dear Anna, your personal data export is now available for download. Please use the secure link below. The link expires in 14 days.", sentById: maria.id, sentAt: d("2025-10-25") } });

  // DSAR 1 Audit Logs
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar1-log1", dsarRequestId: dsar1.id, action: "REQUEST_RECEIVED", performedBy: "SYSTEM", details: { source: "portal" }, createdAt: d("2025-10-01") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar1-log2", dsarRequestId: dsar1.id, action: "STATUS_CHANGE", performedBy: maria.id, details: { from: "SUBMITTED", to: "IDENTITY_PENDING" }, createdAt: d("2025-10-01") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar1-log3", dsarRequestId: dsar1.id, action: "IDENTITY_VERIFIED", performedBy: maria.id, details: { method: "Order number match" }, createdAt: d("2025-10-02") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar1-log4", dsarRequestId: dsar1.id, action: "STATUS_CHANGE", performedBy: "SYSTEM", details: { from: "IN_PROGRESS", to: "COMPLETED" }, createdAt: d("2025-10-25") } });

  // DSAR 2: IN_PROGRESS erasure request
  const dsar2 = await prisma.dSARRequest.create({
    data: {
      id: "demo-dsar-2", organizationId: org.id, publicId: "DSAR-2026-0003",
      type: "ERASURE", status: "IN_PROGRESS",
      requesterName: "Thomas Müller", requesterEmail: "t.muller@example.de",
      relationship: "Customer",
      description: "Please delete all my personal data. I no longer wish to be a customer and want my account and all associated data removed.",
      receivedAt: d("2026-01-20"), acknowledgedAt: d("2026-01-20"),
      dueDate: d("2026-02-19"),
      verificationMethod: "Email verification with account login",
      verifiedAt: d("2026-01-21"),
    },
  });
  await prisma.dSARTask.create({ data: { id: "demo-dsar2-task1", dsarRequestId: dsar2.id, dataAssetId: "demo-asset-customer-db", assigneeId: alex.id, title: "Delete customer account data", description: "Remove account profile, anonymize order history (retain for tax compliance).", status: "IN_PROGRESS" } });
  await prisma.dSARTask.create({ data: { id: "demo-dsar2-task2", dsarRequestId: dsar2.id, dataAssetId: "demo-asset-marketing", assigneeId: alex.id, title: "Remove from marketing lists", description: "Delete all segments, suppress email permanently.", status: "COMPLETED", completedAt: d("2026-02-01"), notes: "Removed from all Klaviyo lists and suppressed." } });
  await prisma.dSARTask.create({ data: { id: "demo-dsar2-task3", dsarRequestId: dsar2.id, dataAssetId: "demo-asset-loyalty", assigneeId: sophie.id, title: "Close loyalty account", description: "Forfeit remaining points, delete loyalty profile.", status: "PENDING" } });
  await prisma.dSARTask.create({ data: { id: "demo-dsar2-task4", dsarRequestId: dsar2.id, dataAssetId: "demo-asset-helpdesk", assigneeId: sophie.id, title: "Delete support ticket history", description: "Remove or anonymize all Zendesk tickets.", status: "PENDING" } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar2-comm1", dsarRequestId: dsar2.id, direction: "INBOUND", channel: "Email", subject: "Request to Delete My Data", content: "I want all of my personal data deleted immediately. I have closed my account and wish to exercise my right to erasure under GDPR Article 17.", sentAt: d("2026-01-20") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar2-comm2", dsarRequestId: dsar2.id, direction: "OUTBOUND", channel: "Email", subject: "RE: Your Erasure Request DSAR-2026-0003", content: "Dear Thomas, we have received your erasure request and will process it within 30 days. Please note that we may need to retain some data for legal compliance (tax records). We will inform you of any exemptions.", sentById: maria.id, sentAt: d("2026-01-20") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar2-log1", dsarRequestId: dsar2.id, action: "REQUEST_RECEIVED", performedBy: "SYSTEM", details: { source: "email" }, createdAt: d("2026-01-20") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar2-log2", dsarRequestId: dsar2.id, action: "STATUS_CHANGE", performedBy: maria.id, details: { from: "SUBMITTED", to: "IN_PROGRESS" }, createdAt: d("2026-01-21") } });

  // DSAR 3: IDENTITY_PENDING
  const dsar3 = await prisma.dSARRequest.create({
    data: {
      id: "demo-dsar-3", organizationId: org.id, publicId: "DSAR-2026-0007",
      type: "ACCESS", status: "IDENTITY_PENDING",
      requesterName: "Sarah Johnson", requesterEmail: "s.johnson.privacy@example.com",
      requesterPhone: "+44-20-7946-0958",
      relationship: "Customer",
      description: "I would like to know what personal data you process about me and who you share it with.",
      receivedAt: d("2026-02-10"), acknowledgedAt: d("2026-02-10"),
      dueDate: d("2026-03-12"),
    },
  });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar3-comm1", dsarRequestId: dsar3.id, direction: "INBOUND", channel: "Portal", subject: "Subject Access Request", content: "I want to know what data you have about me and who you share it with, per GDPR Article 15.", sentAt: d("2026-02-10") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar3-comm2", dsarRequestId: dsar3.id, direction: "OUTBOUND", channel: "Email", subject: "Identity Verification Required — DSAR-2026-0007", content: "Dear Sarah, thank you for your request. Before we can proceed, we need to verify your identity. Could you please provide your customer account email or a recent order number?", sentById: maria.id, sentAt: d("2026-02-10") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar3-log1", dsarRequestId: dsar3.id, action: "REQUEST_RECEIVED", performedBy: "SYSTEM", createdAt: d("2026-02-10") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar3-log2", dsarRequestId: dsar3.id, action: "STATUS_CHANGE", performedBy: maria.id, details: { from: "SUBMITTED", to: "IDENTITY_PENDING" }, createdAt: d("2026-02-10") } });

  // DSAR 4: SUBMITTED (brand new)
  const dsar4 = await prisma.dSARRequest.create({
    data: {
      id: "demo-dsar-4", organizationId: org.id, publicId: "DSAR-2026-0009",
      type: "PORTABILITY", status: "SUBMITTED",
      requesterName: "Marc Dubois", requesterEmail: "marc.dubois@example.fr",
      relationship: "Customer",
      description: "I am switching to a competitor and would like my data exported in a machine-readable format (JSON or CSV) so I can port it.",
      receivedAt: d("2026-02-18"),
      dueDate: d("2026-03-20"),
    },
  });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar4-comm1", dsarRequestId: dsar4.id, direction: "INBOUND", channel: "Email", subject: "Data Portability Request", content: "Under GDPR Article 20, I request my data in a structured, machine-readable format. Please provide all data I have provided to you as a customer.", sentAt: d("2026-02-18") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar4-log1", dsarRequestId: dsar4.id, action: "REQUEST_RECEIVED", performedBy: "SYSTEM", details: { source: "email" }, createdAt: d("2026-02-18") } });

  // DSAR 5: REJECTED
  const dsar5 = await prisma.dSARRequest.create({
    data: {
      id: "demo-dsar-5", organizationId: org.id, publicId: "DSAR-2025-0038",
      type: "ERASURE", status: "REJECTED",
      requesterName: "Unknown", requesterEmail: "anon123@tempmail.example",
      relationship: "Unknown",
      description: "Delete everything you have on me.",
      receivedAt: d("2025-08-05"), acknowledgedAt: d("2025-08-05"),
      dueDate: d("2025-09-04"), completedAt: d("2025-08-12"),
      responseMethod: "Email",
      responseNotes: "Unable to verify identity. No matching customer account found. Request rejected per GDPR Article 12(6).",
    },
  });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar5-comm1", dsarRequestId: dsar5.id, direction: "INBOUND", channel: "Email", subject: "Delete my data", content: "Delete everything you have on me right now.", sentAt: d("2025-08-05") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar5-comm2", dsarRequestId: dsar5.id, direction: "OUTBOUND", channel: "Email", subject: "RE: Your Privacy Request — Identity Verification Required", content: "We received your erasure request but cannot verify your identity. Please provide the email address associated with your account.", sentById: maria.id, sentAt: d("2025-08-05") } });
  await prisma.dSARCommunication.create({ data: { id: "demo-dsar5-comm3", dsarRequestId: dsar5.id, direction: "OUTBOUND", channel: "Email", subject: "Request DSAR-2025-0038 — Closed", content: "We were unable to verify your identity after multiple attempts. No matching account was found. Per GDPR Article 12(6), we are unable to process this request. You may resubmit with verifiable information.", sentById: maria.id, sentAt: d("2025-08-12") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar5-log1", dsarRequestId: dsar5.id, action: "REQUEST_RECEIVED", performedBy: "SYSTEM", createdAt: d("2025-08-05") } });
  await prisma.dSARAuditLog.create({ data: { id: "demo-dsar5-log2", dsarRequestId: dsar5.id, action: "STATUS_CHANGE", performedBy: maria.id, details: { from: "SUBMITTED", to: "REJECTED", reason: "Identity verification failed" }, createdAt: d("2025-08-12") } });

  console.log("  1 intake form, 5 DSARs, 15 tasks, 12 comms, 11 audit logs\n");

  // ── Phase 5: Assessments ───────────────────────────────────
  console.log("Phase 5: Assessments...");

  // Assessment 1: LIA Analytics — APPROVED
  const assess1 = await prisma.assessment.create({
    data: {
      id: "demo-assess-lia-analytics", organizationId: org.id,
      templateId: liaTemplate.id, processingActivityId: paAnalytics.id,
      name: "LIA: Customer Analytics & BI",
      description: "Legitimate Interest Assessment for customer behavior analytics used to improve products and optimize the shopping experience.",
      status: "APPROVED", riskLevel: "LOW", riskScore: 22,
      startedAt: d("2025-08-01"), submittedAt: d("2025-08-20"), completedAt: d("2025-08-25"),
      dueDate: d("2025-09-01"),
    },
  });
  const assess1Responses = [
    { questionId: "lia1_1", sectionId: "lia1", response: "Understanding customer browsing and purchase patterns to improve product recommendations, optimize website UX, and inform inventory decisions." },
    { questionId: "lia1_2", sectionId: "lia1", response: "Yes, explicitly recognized" },
    { questionId: "lia1_3", sectionId: "lia1", response: "Enables data-driven product development, reduces unsold inventory, and improves the customer experience through better recommendations." },
    { questionId: "lia2_1", sectionId: "lia2", response: "Essential" },
    { questionId: "lia2_2", sectionId: "lia2", response: "No alternatives exist" },
    { questionId: "lia3_1", sectionId: "lia3", response: "Non-sensitive only" },
    { questionId: "lia3_2", sectionId: "lia3", response: "Definitely expected" },
    { questionId: "lia3_3", sectionId: "lia3", response: "Positive/Neutral" },
    { questionId: "lia3_4", sectionId: "lia3", response: false },
    { questionId: "lia4_1", sectionId: "lia4", response: ["Data minimization", "Retention limits", "Access controls", "Transparency measures"] },
    { questionId: "lia4_2", sectionId: "lia4", response: true },
  ];
  for (const r of assess1Responses) {
    await prisma.assessmentResponse.create({
      data: { assessmentId: assess1.id, ...r, responderId: maria.id },
    });
  }
  await prisma.assessmentApproval.create({
    data: { id: "demo-assess1-approval", assessmentId: assess1.id, approverId: maria.id, level: 1, status: "APPROVED", comments: "LIA demonstrates clear legitimate interest with minimal impact on data subjects. Appropriate safeguards in place.", decidedAt: d("2025-08-25") },
  });
  await prisma.assessmentMitigation.create({
    data: { id: "demo-assess1-mit1", assessmentId: assess1.id, riskId: "risk-data-retention", title: "Implement automated data purge", description: "Set up automated deletion of raw analytics data older than 2 years. Aggregated data may be retained longer.", status: "IMPLEMENTED", priority: 2, owner: "Data Team", completedAt: d("2025-09-15"), evidence: "Snowflake retention policy configured. Automated purge job runs weekly." },
  });
  await prisma.assessmentMitigation.create({
    data: { id: "demo-assess1-mit2", assessmentId: assess1.id, riskId: "risk-opt-out", title: "Add analytics opt-out to privacy center", description: "Provide customers with a clear opt-out mechanism for behavioral analytics.", status: "VERIFIED", priority: 1, owner: "Engineering", completedAt: d("2025-10-01"), evidence: "Opt-out toggle added to customer privacy center. Tested and verified working with Cookiebot integration." },
  });

  // Assessment 2: LIA Fraud — IN_PROGRESS
  const assess2 = await prisma.assessment.create({
    data: {
      id: "demo-assess-lia-fraud", organizationId: org.id,
      templateId: liaTemplate.id, processingActivityId: paFraud.id,
      name: "LIA: Fraud Detection & Prevention",
      description: "Legitimate Interest Assessment for automated fraud screening of e-commerce transactions.",
      status: "IN_PROGRESS", riskLevel: "MEDIUM",
      startedAt: d("2026-01-15"),
      dueDate: d("2026-03-01"),
    },
  });
  const assess2Responses = [
    { questionId: "lia1_1", sectionId: "lia1", response: "Detecting and preventing fraudulent transactions to protect both the company and customers from financial crime." },
    { questionId: "lia1_2", sectionId: "lia1", response: "Yes, explicitly recognized" },
    { questionId: "lia1_3", sectionId: "lia1", response: "Prevents financial losses (~€1.2M annually), protects customers from unauthorized transactions, and ensures PSD2 compliance." },
    { questionId: "lia2_1", sectionId: "lia2", response: "Essential" },
  ];
  for (const r of assess2Responses) {
    await prisma.assessmentResponse.create({
      data: { assessmentId: assess2.id, ...r, responderId: maria.id },
    });
  }

  // Assessment 3: Custom Loyalty — PENDING_REVIEW
  const assess3 = await prisma.assessment.create({
    data: {
      id: "demo-assess-custom-loyalty", organizationId: org.id,
      templateId: customTemplate.id, processingActivityId: paLoyalty.id,
      name: "Privacy Review: Meridian Rewards Loyalty Program",
      description: "Custom privacy assessment reviewing data practices for the loyalty program ahead of planned expansion to UK market.",
      status: "PENDING_REVIEW", riskLevel: "MEDIUM", riskScore: 45,
      startedAt: d("2026-01-05"), submittedAt: d("2026-02-10"),
      dueDate: d("2026-03-05"),
    },
  });
  const assess3Responses = [
    { questionId: "custom1_1", sectionId: "custom1", response: "Evaluate the privacy implications of the Meridian Rewards loyalty program, with focus on the planned UK market expansion and new personalized offers feature." },
    { questionId: "custom1_2", sectionId: "custom1", response: "Covers loyalty points accrual, tier management, reward redemptions, personalized offers based on purchase history, and cross-border data sharing with UK entity." },
    { questionId: "custom2_1", sectionId: "custom2", response: "1. Cross-border data transfer to UK subsidiary for local program management\n2. Profiling customers for personalized offers may cross into automated decision-making\n3. Retention of purchase history for points calculation may exceed necessity\n4. Third-party reward partners receive customer identifiers" },
    { questionId: "custom2_2", sectionId: "custom2", response: "Medium" },
    { questionId: "custom3_1", sectionId: "custom3", response: "1. UK adequacy decision provides legal basis for transfer\n2. Implement opt-out for personalized offers profiling\n3. Limit purchase history retention to 5 years\n4. Minimize data shared with reward partners to pseudonymized IDs" },
  ];
  for (const r of assess3Responses) {
    await prisma.assessmentResponse.create({
      data: { assessmentId: assess3.id, ...r, responderId: sophie.id },
    });
  }
  await prisma.assessmentApproval.create({
    data: { id: "demo-assess3-approval", assessmentId: assess3.id, approverId: maria.id, level: 1, status: "PENDING", comments: null },
  });
  await prisma.assessmentMitigation.create({
    data: { id: "demo-assess3-mit1", assessmentId: assess3.id, riskId: "risk-uk-transfer", title: "Document UK adequacy basis", description: "Prepare documentation confirming UK adequacy decision applicability for the loyalty program data transfer.", status: "IDENTIFIED", priority: 2, owner: "Legal / Privacy" },
  });
  await prisma.assessmentMitigation.create({
    data: { id: "demo-assess3-mit2", assessmentId: assess3.id, riskId: "risk-profiling", title: "Implement opt-out for personalized offers", description: "Add preference toggle allowing members to opt out of purchase-history-based personalized offers.", status: "PLANNED", priority: 1, owner: "Engineering", dueDate: d("2026-04-01") },
  });

  // Assessment 4: Custom Marketing — DRAFT
  await prisma.assessment.create({
    data: {
      id: "demo-assess-custom-marketing", organizationId: org.id,
      templateId: customTemplate.id, processingActivityId: paMarketing.id,
      name: "Privacy Review: New SMS Marketing Campaign",
      description: "Assessment of a proposed SMS marketing campaign targeting loyalty program members with personalized offers.",
      status: "DRAFT",
      startedAt: d("2026-02-15"),
      dueDate: d("2026-04-01"),
    },
  });
  await prisma.assessmentResponse.create({
    data: { assessmentId: "demo-assess-custom-marketing", questionId: "custom1_1", sectionId: "custom1", response: "Evaluate privacy and consent requirements for a new SMS marketing campaign targeting Meridian Rewards members.", responderId: sophie.id },
  });

  console.log("  4 assessments, 21 responses, 2 approvals, 4 mitigations\n");

  // ── Phase 6: Incidents ─────────────────────────────────────
  console.log("Phase 6: Incidents...");

  // Incident 1: Phishing — CLOSED
  const inc1 = await prisma.incident.create({
    data: {
      id: "demo-incident-phishing", organizationId: org.id, publicId: "INC-2025-0012",
      title: "Phishing Attack Targeting Finance Team",
      description: "Sophisticated spear-phishing emails sent to 5 finance team members impersonating the CEO, requesting urgent wire transfers. Two employees clicked the link but did not enter credentials. No data breach occurred.",
      type: "PHISHING", severity: "MEDIUM", status: "CLOSED",
      discoveredAt: d("2025-09-15T09:30:00Z"), discoveredBy: "IT Security Team",
      discoveryMethod: "Employee reported suspicious email to IT helpdesk",
      affectedRecords: 0, affectedSubjects: ["Employees"], dataCategories: [],
      jurisdictionId: gdpr?.id,
      containedAt: d("2025-09-15T10:15:00Z"),
      containmentActions: "Blocked sender domain, quarantined all related emails, forced password reset for affected accounts, revoked active sessions.",
      rootCause: "Attacker used publicly available LinkedIn data to craft targeted phishing emails. Email security gateway did not flag the domain (newly registered).",
      rootCauseCategory: "Social Engineering",
      resolvedAt: d("2025-09-20T14:00:00Z"),
      resolutionNotes: "No credentials were compromised. Enhanced email filtering rules deployed. Mandatory phishing awareness training scheduled.",
      lessonsLearned: "1. Implement DMARC enforcement on all company domains\n2. Deploy email link scanning/sandboxing\n3. Conduct quarterly phishing simulations\n4. Add finance-specific wire transfer verification procedures",
      notificationRequired: false,
    },
  });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc1-tl1", incidentId: inc1.id, timestamp: d("2025-09-15T09:30:00Z"), title: "Incident Reported", description: "Finance team member reported suspicious email requesting urgent wire transfer to IT helpdesk.", entryType: "DETECTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc1-tl2", incidentId: inc1.id, timestamp: d("2025-09-15T09:45:00Z"), title: "Investigation Started", description: "IT Security identified 5 similar emails targeting finance team. Analysis of email headers and links initiated.", entryType: "ACTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc1-tl3", incidentId: inc1.id, timestamp: d("2025-09-15T10:15:00Z"), title: "Incident Contained", description: "Sender domain blocked, malicious emails quarantined across all mailboxes. Affected accounts password-reset.", entryType: "STATUS_CHANGE", createdById: james.id, metadata: { from: "INVESTIGATING", to: "CONTAINED" } } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc1-tl4", incidentId: inc1.id, timestamp: d("2025-09-20T14:00:00Z"), title: "Incident Closed", description: "No data breach confirmed. Remediation complete. Phishing training scheduled for all staff.", entryType: "STATUS_CHANGE", createdById: james.id, metadata: { from: "CONTAINED", to: "CLOSED" } } });
  await prisma.incidentTask.create({ data: { id: "demo-inc1-task1", incidentId: inc1.id, assigneeId: james.id, title: "Deploy DMARC enforcement", priority: "HIGH", status: "COMPLETED", completedAt: d("2025-10-01"), notes: "DMARC policy set to reject for all company domains." } });
  await prisma.incidentTask.create({ data: { id: "demo-inc1-task2", incidentId: inc1.id, assigneeId: james.id, title: "Schedule company-wide phishing training", priority: "MEDIUM", status: "COMPLETED", completedAt: d("2025-10-15"), notes: "Training completed by 95% of staff." } });

  // Incident 2: Unauthorized DB access — INVESTIGATING
  const inc2 = await prisma.incident.create({
    data: {
      id: "demo-incident-db-access", organizationId: org.id, publicId: "INC-2026-0002",
      title: "Unauthorized Database Query — Customer DB",
      description: "Audit logs revealed an unauthorized SELECT query against the customer database from a developer staging environment. The query returned ~15,000 customer email addresses. Investigation ongoing to determine if data was exfiltrated.",
      type: "UNAUTHORIZED_ACCESS", severity: "HIGH", status: "INVESTIGATING",
      discoveredAt: d("2026-02-12T16:20:00Z"), discoveredBy: "Database Administrator",
      discoveryMethod: "Routine audit log review flagged unusual query pattern",
      affectedRecords: 15000, affectedSubjects: ["Customers"],
      dataCategories: ["IDENTIFIERS"],
      jurisdictionId: gdpr?.id,
      notificationRequired: true,
      notificationDeadline: d("2026-02-15T16:20:00Z"),
    },
  });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc2-tl1", incidentId: inc2.id, timestamp: d("2026-02-12T16:20:00Z"), title: "Suspicious Query Detected", description: "DBA identified unusual SELECT * query on customer_emails table from staging environment IP.", entryType: "DETECTION", createdById: alex.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc2-tl2", incidentId: inc2.id, timestamp: d("2026-02-12T17:00:00Z"), title: "Incident Escalated to Privacy Team", description: "Query returned 15,000 records. Escalated to DPO for breach assessment.", entryType: "ACTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc2-tl3", incidentId: inc2.id, timestamp: d("2026-02-12T18:30:00Z"), title: "Developer Account Suspended", description: "Staging environment access revoked. Developer's corporate account temporarily suspended pending investigation.", entryType: "ACTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc2-tl4", incidentId: inc2.id, timestamp: d("2026-02-13T10:00:00Z"), title: "Forensic Analysis Started", description: "IT Security reviewing network logs, endpoint activity, and cloud storage for signs of data exfiltration.", entryType: "ACTION", createdById: james.id } });
  await prisma.incidentTask.create({ data: { id: "demo-inc2-task1", incidentId: inc2.id, assigneeId: james.id, title: "Complete forensic analysis of developer workstation", priority: "URGENT", status: "IN_PROGRESS" } });
  await prisma.incidentTask.create({ data: { id: "demo-inc2-task2", incidentId: inc2.id, assigneeId: maria.id, title: "Prepare DPA notification draft", description: "Draft notification to Dutch DPA (AP) in case forensics confirm data exfiltration.", priority: "HIGH", status: "IN_PROGRESS" } });
  await prisma.incidentTask.create({ data: { id: "demo-inc2-task3", incidentId: inc2.id, assigneeId: james.id, title: "Revoke staging → production DB access", description: "Implement network segmentation to prevent staging environments from querying production databases.", priority: "HIGH", status: "TODO" } });
  await prisma.incidentAffectedAsset.create({ data: { id: "demo-inc2-aa1", incidentId: inc2.id, dataAssetId: "demo-asset-customer-db", impactLevel: "15,000 email addresses potentially exposed", compromised: true } });
  await prisma.incidentNotification.create({ data: { id: "demo-inc2-notif1", incidentId: inc2.id, jurisdictionId: gdpr!.id, recipientType: "DPA", recipientName: "Autoriteit Persoonsgegevens (Dutch DPA)", status: "DRAFTED", deadline: d("2026-02-15T16:20:00Z"), content: "Draft notification prepared. Awaiting forensic analysis results before submission." } });

  // Incident 3: Vendor data violation — CONTAINED
  const inc3 = await prisma.incident.create({
    data: {
      id: "demo-incident-vendor", organizationId: org.id, publicId: "INC-2026-0001",
      title: "Vendor Data Processing Violation — Klaviyo",
      description: "Discovered that Klaviyo was processing customer data for their own product improvement purposes beyond the scope authorized in our DPA. Identified during annual vendor review when Klaviyo disclosed updated terms.",
      type: "VENDOR_INCIDENT", severity: "MEDIUM", status: "CONTAINED",
      discoveredAt: d("2026-01-08T11:00:00Z"), discoveredBy: "Privacy Officer (Maria Torres)",
      discoveryMethod: "Annual vendor review identified scope creep in data processing",
      affectedRecords: 850000, affectedSubjects: ["Customers", "Newsletter subscribers"],
      dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
      jurisdictionId: gdpr?.id,
      containedAt: d("2026-01-15T09:00:00Z"),
      containmentActions: "1. Formally objected to Klaviyo's additional processing\n2. Disabled analytics sharing features in Klaviyo settings\n3. Requested written confirmation of data deletion for unauthorized purposes",
      notificationRequired: false,
    },
  });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc3-tl1", incidentId: inc3.id, timestamp: d("2026-01-08T11:00:00Z"), title: "Violation Discovered", description: "During annual vendor review, discovered Klaviyo's updated terms include processing customer data for product improvement — beyond DPA scope.", entryType: "DETECTION", createdById: maria.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc3-tl2", incidentId: inc3.id, timestamp: d("2026-01-10T14:00:00Z"), title: "Formal Objection Sent", description: "Sent formal letter to Klaviyo objecting to unauthorized processing and requesting immediate cessation.", entryType: "COMMUNICATION", createdById: maria.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc3-tl3", incidentId: inc3.id, timestamp: d("2026-01-15T09:00:00Z"), title: "Klaviyo Confirms Compliance", description: "Klaviyo confirmed they have disabled analytics processing for our data and will delete any derived datasets within 30 days.", entryType: "STATUS_CHANGE", createdById: maria.id, metadata: { from: "INVESTIGATING", to: "CONTAINED" } } });
  await prisma.incidentTask.create({ data: { id: "demo-inc3-task1", incidentId: inc3.id, assigneeId: maria.id, title: "Verify Klaviyo data deletion", description: "Request and review evidence that Klaviyo has deleted data processed for unauthorized purposes.", priority: "HIGH", status: "IN_PROGRESS", dueDate: d("2026-02-15") } });
  await prisma.incidentTask.create({ data: { id: "demo-inc3-task2", incidentId: inc3.id, assigneeId: sophie.id, title: "Update Klaviyo DPA", description: "Negotiate updated DPA with explicit restrictions on data use for Klaviyo's own purposes.", priority: "MEDIUM", status: "TODO", dueDate: d("2026-03-01") } });
  await prisma.incidentAffectedAsset.create({ data: { id: "demo-inc3-aa1", incidentId: inc3.id, dataAssetId: "demo-asset-marketing", impactLevel: "Customer email and behavioral data processed beyond DPA scope", compromised: false, notes: "No unauthorized third-party access. Data used internally by Klaviyo." } });

  // Incident 4: Lost laptop — CLOSED
  const inc4 = await prisma.incident.create({
    data: {
      id: "demo-incident-laptop", organizationId: org.id, publicId: "INC-2025-0015",
      title: "Lost Employee Laptop — Amsterdam Office",
      description: "HR manager's laptop lost during train commute between Amsterdam and Rotterdam. Laptop contained local copies of employee performance reviews and compensation data. Device was encrypted with BitLocker and had remote wipe capability.",
      type: "DATA_LOSS", severity: "LOW", status: "CLOSED",
      discoveredAt: d("2025-11-28T18:00:00Z"), discoveredBy: "HR Manager (self-reported)",
      discoveryMethod: "Employee reported lost device to IT helpdesk",
      affectedRecords: 45, affectedSubjects: ["Employees"],
      dataCategories: ["EMPLOYMENT", "FINANCIAL"],
      jurisdictionId: gdpr?.id,
      containedAt: d("2025-11-28T19:00:00Z"),
      containmentActions: "Remote wipe initiated via Intune MDM. Corporate account credentials reset. VPN certificate revoked.",
      rootCause: "Employee left laptop bag on train. No policy violation — device was encrypted and protected.",
      rootCauseCategory: "Physical Security",
      resolvedAt: d("2025-12-02T10:00:00Z"),
      resolutionNotes: "Remote wipe confirmed successful. BitLocker encryption would prevent data access even if wipe failed. Risk to data subjects assessed as negligible.",
      lessonsLearned: "1. Remind employees of secure transport policies\n2. Consider reducing local data storage — migrate to cloud-only workflows\n3. Track policy was already in place and effective",
      notificationRequired: false,
    },
  });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc4-tl1", incidentId: inc4.id, timestamp: d("2025-11-28T18:00:00Z"), title: "Lost Device Reported", description: "HR manager reported losing laptop bag on NS Intercity train.", entryType: "DETECTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc4-tl2", incidentId: inc4.id, timestamp: d("2025-11-28T19:00:00Z"), title: "Remote Wipe Initiated", description: "IT triggered remote wipe via Microsoft Intune. Device pinged and wipe command acknowledged.", entryType: "ACTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc4-tl3", incidentId: inc4.id, timestamp: d("2025-11-29T08:30:00Z"), title: "Remote Wipe Confirmed", description: "Intune dashboard shows wipe completed successfully. BitLocker recovery key rotated.", entryType: "ACTION", createdById: james.id } });
  await prisma.incidentTimelineEntry.create({ data: { id: "demo-inc4-tl4", incidentId: inc4.id, timestamp: d("2025-12-02T10:00:00Z"), title: "Incident Closed", description: "No data breach determined. Encryption + successful remote wipe means negligible risk to data subjects. No DPA notification required.", entryType: "STATUS_CHANGE", createdById: maria.id, metadata: { from: "INVESTIGATING", to: "CLOSED" } } });
  await prisma.incidentTask.create({ data: { id: "demo-inc4-task1", incidentId: inc4.id, assigneeId: james.id, title: "Provision replacement laptop", priority: "MEDIUM", status: "COMPLETED", completedAt: d("2025-12-01"), notes: "New laptop provisioned and delivered to employee." } });
  await prisma.incidentTask.create({ data: { id: "demo-inc4-task2", incidentId: inc4.id, assigneeId: james.id, title: "Review local storage policy", priority: "LOW", status: "COMPLETED", completedAt: d("2025-12-10"), notes: "Policy reviewed — BitLocker + Intune MDM provides adequate protection. Added reminder about secure transport." } });
  await prisma.incidentAffectedAsset.create({ data: { id: "demo-inc4-aa1", incidentId: inc4.id, dataAssetId: "demo-asset-hr", impactLevel: "Local copies of 45 employee performance reviews", compromised: false, notes: "Device encrypted with BitLocker. Remote wipe successful." } });
  await prisma.incidentAffectedAsset.create({ data: { id: "demo-inc4-aa2", incidentId: inc4.id, dataAssetId: "demo-asset-fileserver", impactLevel: "Cached copies of HR documents", compromised: false, notes: "Azure Files sync cache — encrypted at rest." } });
  await prisma.incidentNotification.create({ data: { id: "demo-inc4-notif1", incidentId: inc4.id, jurisdictionId: gdpr!.id, recipientType: "DPA", recipientName: "Autoriteit Persoonsgegevens (Dutch DPA)", status: "NOT_REQUIRED", deadline: d("2025-12-01T18:00:00Z"), notes: "DPA notification not required — encryption + remote wipe means negligible risk per GDPR Article 33." } });

  console.log("  4 incidents, 16 timeline entries, 10 tasks, 4 affected assets, 2 notifications\n");

  // ── Phase 7: Audit Trail ───────────────────────────────────
  console.log("Phase 7: Audit Trail...");

  const auditLogs = [
    { id: "demo-audit-01", userId: demoUser.id, entityType: "Organization", entityId: org.id, action: "UPDATE", changes: { name: { from: "Acme Corporation (Demo)", to: "Meridian Retail Group" } }, createdAt: d("2025-03-01T09:00:00Z") },
    { id: "demo-audit-02", userId: maria.id, entityType: "ProcessingActivity", entityId: paOrders.id, action: "CREATE", changes: { name: "Order Processing & Fulfillment" }, createdAt: d("2025-04-10T14:30:00Z") },
    { id: "demo-audit-03", userId: alex.id, entityType: "DataAsset", entityId: "demo-asset-customer-db", action: "CREATE", changes: { name: "Customer Database" }, createdAt: d("2025-04-15T10:00:00Z") },
    { id: "demo-audit-04", userId: alex.id, entityType: "DataAsset", entityId: "demo-asset-ecommerce", action: "CREATE", changes: { name: "E-commerce Platform" }, createdAt: d("2025-04-15T10:30:00Z") },
    { id: "demo-audit-05", userId: sophie.id, entityType: "Vendor", entityId: "demo-vendor-stripe", action: "CREATE", changes: { name: "Stripe" }, createdAt: d("2025-05-01T11:00:00Z") },
    { id: "demo-audit-06", userId: sophie.id, entityType: "Vendor", entityId: "demo-vendor-shopify", action: "CREATE", changes: { name: "Shopify" }, createdAt: d("2025-05-01T11:15:00Z") },
    { id: "demo-audit-07", userId: maria.id, entityType: "DSARRequest", entityId: dsar5.id, action: "UPDATE", changes: { status: { from: "SUBMITTED", to: "REJECTED" } }, createdAt: d("2025-08-12T15:00:00Z") },
    { id: "demo-audit-08", userId: maria.id, entityType: "Assessment", entityId: assess1.id, action: "CREATE", changes: { name: "LIA: Customer Analytics & BI" }, createdAt: d("2025-08-01T09:00:00Z") },
    { id: "demo-audit-09", userId: maria.id, entityType: "Assessment", entityId: assess1.id, action: "UPDATE", changes: { status: { from: "IN_PROGRESS", to: "APPROVED" } }, createdAt: d("2025-08-25T16:00:00Z") },
    { id: "demo-audit-10", userId: james.id, entityType: "Incident", entityId: inc1.id, action: "CREATE", changes: { title: "Phishing Attack Targeting Finance Team" }, createdAt: d("2025-09-15T10:00:00Z") },
    { id: "demo-audit-11", userId: james.id, entityType: "Incident", entityId: inc1.id, action: "UPDATE", changes: { status: { from: "INVESTIGATING", to: "CLOSED" } }, createdAt: d("2025-09-20T14:00:00Z") },
    { id: "demo-audit-12", userId: maria.id, entityType: "DSARRequest", entityId: dsar1.id, action: "UPDATE", changes: { status: { from: "IN_PROGRESS", to: "COMPLETED" } }, createdAt: d("2025-10-25T17:00:00Z") },
    { id: "demo-audit-13", userId: maria.id, entityType: "Incident", entityId: inc4.id, action: "UPDATE", changes: { status: { from: "INVESTIGATING", to: "CLOSED" } }, createdAt: d("2025-12-02T10:00:00Z") },
    { id: "demo-audit-14", userId: maria.id, entityType: "Incident", entityId: inc3.id, action: "CREATE", changes: { title: "Vendor Data Processing Violation — Klaviyo" }, createdAt: d("2026-01-08T11:30:00Z") },
    { id: "demo-audit-15", userId: maria.id, entityType: "Assessment", entityId: assess2.id, action: "CREATE", changes: { name: "LIA: Fraud Detection & Prevention" }, createdAt: d("2026-01-15T09:00:00Z") },
    { id: "demo-audit-16", userId: maria.id, entityType: "DSARRequest", entityId: dsar2.id, action: "UPDATE", changes: { status: { from: "SUBMITTED", to: "IN_PROGRESS" } }, createdAt: d("2026-01-21T10:00:00Z") },
    { id: "demo-audit-17", userId: james.id, entityType: "Incident", entityId: inc2.id, action: "CREATE", changes: { title: "Unauthorized Database Query — Customer DB" }, createdAt: d("2026-02-12T17:00:00Z") },
    { id: "demo-audit-18", userId: sophie.id, entityType: "Assessment", entityId: assess3.id, action: "UPDATE", changes: { status: { from: "IN_PROGRESS", to: "PENDING_REVIEW" } }, createdAt: d("2026-02-10T16:00:00Z") },
  ];
  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: { ...log, organizationId: org.id },
    });
  }
  console.log("  18 audit log entries\n");

  // ── Summary ────────────────────────────────────────────────
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Seed Complete!                                 ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  Organization:  Meridian Retail Group           ║");
  console.log("║  Users:         5 (Owner, DPO, Admin, 2 Members)║");
  console.log("║  Jurisdictions: 3 (GDPR, UK-GDPR, CCPA)        ║");
  console.log("║  Data Assets:   12                              ║");
  console.log("║  Data Elements: 28                              ║");
  console.log("║  Activities:    8 (+ 21 asset links)            ║");
  console.log("║  Data Flows:    10                              ║");
  console.log("║  Data Transfers:4                               ║");
  console.log("║  Vendors:       10 (+ 8 contracts, 4 reviews)  ║");
  console.log("║  DSARs:         5 (+ 15 tasks, 12 comms)       ║");
  console.log("║  Assessments:   4 (+ 21 responses, 4 mits)     ║");
  console.log("║  Incidents:     4 (+ 16 timeline, 10 tasks)    ║");
  console.log("║  Audit Logs:    18                              ║");
  console.log("║──────────────────────────────────────────────────║");
  console.log("║  Total:         ~240 records                    ║");
  console.log("╚══════════════════════════════════════════════════╝");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
