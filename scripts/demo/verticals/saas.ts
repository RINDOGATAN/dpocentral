import type { VerticalScenario } from "../types";

export const scenario: VerticalScenario = {
  key: "saas",
  orgName: "CloudForge Labs",
  orgSlug: "demo-saas",
  domain: "cloudforgelabs.eu",
  jurisdictionCodes: ["GDPR"],

  // ── Users ───────────────────────────────────────────────────
  users: [
    { id: "saas-user-owner", ref: "owner", name: "Demo User", email: "demo-saas@privacysuite.example", role: "OWNER" },
    { id: "saas-user-dpo", ref: "dpo", name: "Katrine Holm", email: "katrine.holm@cloudforgelabs.eu", role: "PRIVACY_OFFICER" },
    { id: "saas-user-admin", ref: "admin", name: "Erik Lindstr\u00f6m", email: "erik.lindstrom@cloudforgelabs.eu", role: "ADMIN" },
    { id: "saas-user-member1", ref: "member1", name: "Lucia Fern\u00e1ndez", email: "lucia.fernandez@cloudforgelabs.eu", role: "MEMBER" },
    { id: "saas-user-member2", ref: "member2", name: "Tom\u00e1\u0161 Nov\u00e1k", email: "tomas.novak@cloudforgelabs.eu", role: "MEMBER" },
  ],

  // ── Data Assets ─────────────────────────────────────────────
  assets: [
    { id: "saas-asset-user-db", name: "User Database", description: "PostgreSQL on AWS eu-west-1 storing workspace accounts, user profiles, preferences, and authentication metadata for all 50K workspace users.", type: "DATABASE", owner: "Engineering", location: "AWS eu-west-1 (Ireland)", hostingType: "Cloud (AWS RDS)", vendor: "Amazon Web Services", isProduction: true },
    { id: "saas-asset-project-platform", name: "Project Management Platform", description: "Core SaaS application handling workspace data, projects, tasks, boards, Gantt charts, and team collaboration features.", type: "APPLICATION", owner: "Product", location: "AWS eu-west-1 (Ireland)", hostingType: "Cloud (AWS ECS)", vendor: "CloudForge Labs (internal)", isProduction: true },
    { id: "saas-asset-billing", name: "Billing & Subscription Engine", description: "Stripe-powered subscription billing handling plan management, invoicing, payment processing, and revenue recognition for B2B customers.", type: "CLOUD_SERVICE", owner: "Finance", location: "EU (Stripe EU entity)", hostingType: "SaaS", vendor: "Stripe", isProduction: true },
    { id: "saas-asset-analytics", name: "Product Analytics Platform", description: "Mixpanel instance tracking user behavior events, feature adoption funnels, session metadata, and cohort analyses across all workspaces. Primary subject of DPIA assessment.", type: "CLOUD_SERVICE", owner: "Product", location: "US (Mixpanel US region)", hostingType: "SaaS", vendor: "Mixpanel", isProduction: true },
    { id: "saas-asset-helpdesk", name: "Customer Support Platform", description: "Intercom workspace for live chat, ticketing, knowledge base, and product tours serving B2B customers and their end-users.", type: "CLOUD_SERVICE", owner: "Customer Success", location: "US (Intercom)", hostingType: "SaaS", vendor: "Intercom", isProduction: true },
    { id: "saas-asset-hr-system", name: "HR & People Platform", description: "Personio HRIS managing employee records, payroll, absence tracking, and recruitment for the 85-person CloudForge team.", type: "CLOUD_SERVICE", owner: "People Operations", location: "EU (Germany)", hostingType: "SaaS", vendor: "Personio", isProduction: true },
    { id: "saas-asset-monitoring", name: "Infrastructure Monitoring", description: "Datadog APM, logging, and infrastructure monitoring with error traces that may contain user context and request metadata.", type: "CLOUD_SERVICE", owner: "Engineering", location: "EU (Datadog EU)", hostingType: "SaaS", vendor: "Datadog", isProduction: true },
    { id: "saas-asset-crm", name: "CRM & Sales Pipeline", description: "Salesforce instance for enterprise sales pipeline, lead management, and account data for B2B prospects and customers.", type: "CLOUD_SERVICE", owner: "Sales", location: "EU (Salesforce EU)", hostingType: "SaaS", vendor: "Salesforce", isProduction: true },
    { id: "saas-asset-auth", name: "Authentication Service", description: "Auth0-based authentication with SSO, SAML federation, MFA, and session management for enterprise workspace access.", type: "APPLICATION", owner: "Engineering", location: "EU (Auth0 EU tenant)", hostingType: "SaaS", vendor: "Auth0 (Okta)", isProduction: true },
    { id: "saas-asset-consent", name: "Cookie Consent Platform", description: "Cookiebot consent management for marketing site and in-app cookie preferences, storing granular consent records.", type: "CLOUD_SERVICE", owner: "Marketing", location: "EU (Denmark)", hostingType: "SaaS", vendor: "Cookiebot (Usercentrics)", isProduction: true },
  ],

  // ── Data Elements ───────────────────────────────────────────
  elements: [
    // User DB
    { id: "saas-elem-user-db-name", dataAssetId: "saas-asset-user-db", name: "Workspace Admin Name", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 1095, legalBasis: "Contract performance" },
    { id: "saas-elem-user-db-email", dataAssetId: "saas-asset-user-db", name: "User Email Address", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 1095, legalBasis: "Contract performance" },
    { id: "saas-elem-user-db-avatar", dataAssetId: "saas-asset-user-db", name: "Avatar URL", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 1095, legalBasis: "Contract performance" },
    { id: "saas-elem-user-db-settings", dataAssetId: "saas-asset-user-db", name: "Account Settings & Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 1095, legalBasis: "Contract performance" },
    // Project Platform
    { id: "saas-elem-project-tasks", dataAssetId: "saas-asset-project-platform", name: "Task Content & Descriptions", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: false, retentionDays: 1825, legalBasis: "Contract performance" },
    { id: "saas-elem-project-files", dataAssetId: "saas-asset-project-platform", name: "File Attachments Metadata", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: false, retentionDays: 1825, legalBasis: "Contract performance" },
    { id: "saas-elem-project-members", dataAssetId: "saas-asset-project-platform", name: "Team Member Assignments", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 1825, legalBasis: "Contract performance" },
    { id: "saas-elem-project-logs", dataAssetId: "saas-asset-project-platform", name: "Activity Logs", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 365, legalBasis: "Legitimate interests" },
    // Billing
    { id: "saas-elem-billing-company", dataAssetId: "saas-asset-billing", name: "Company Name & VAT ID", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: false, retentionDays: 3650, legalBasis: "Legal obligation (tax)" },
    { id: "saas-elem-billing-address", dataAssetId: "saas-asset-billing", name: "Billing Address", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 3650, legalBasis: "Legal obligation (tax)" },
    { id: "saas-elem-billing-payment", dataAssetId: "saas-asset-billing", name: "Payment Method (Tokenized)", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, retentionDays: 3650, legalBasis: "Contract performance" },
    { id: "saas-elem-billing-invoices", dataAssetId: "saas-asset-billing", name: "Invoice History", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: false, retentionDays: 3650, legalBasis: "Legal obligation (tax)" },
    // Analytics
    { id: "saas-elem-analytics-events", dataAssetId: "saas-asset-analytics", name: "User Behavior Events", category: "BEHAVIORAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 365, legalBasis: "Legitimate interests" },
    { id: "saas-elem-analytics-usage", dataAssetId: "saas-asset-analytics", name: "Feature Usage Metrics", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 365, legalBasis: "Legitimate interests" },
    { id: "saas-elem-analytics-sessions", dataAssetId: "saas-asset-analytics", name: "Session Recordings Metadata", category: "BEHAVIORAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 90, legalBasis: "Legitimate interests" },
    // Helpdesk
    { id: "saas-elem-helpdesk-tickets", dataAssetId: "saas-asset-helpdesk", name: "Support Tickets", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 730, legalBasis: "Contract performance" },
    { id: "saas-elem-helpdesk-contact", dataAssetId: "saas-asset-helpdesk", name: "Contact Information", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 730, legalBasis: "Contract performance" },
    { id: "saas-elem-helpdesk-chats", dataAssetId: "saas-asset-helpdesk", name: "Chat Transcripts", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 730, legalBasis: "Contract performance" },
    // HR
    { id: "saas-elem-hr-name", dataAssetId: "saas-asset-hr-system", name: "Employee Full Name", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 2555, legalBasis: "Employment contract" },
    { id: "saas-elem-hr-salary", dataAssetId: "saas-asset-hr-system", name: "Salary & Compensation", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, retentionDays: 2555, legalBasis: "Employment contract" },
    { id: "saas-elem-hr-national-id", dataAssetId: "saas-asset-hr-system", name: "National ID / Tax Number", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false, retentionDays: 2555, legalBasis: "Legal obligation" },
    { id: "saas-elem-hr-contracts", dataAssetId: "saas-asset-hr-system", name: "Employment Contracts", category: "EMPLOYMENT", sensitivity: "RESTRICTED", isPersonalData: true, retentionDays: 2555, legalBasis: "Employment contract" },
    // Monitoring
    { id: "saas-elem-monitor-traces", dataAssetId: "saas-asset-monitoring", name: "Error Traces with User Context", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 30, legalBasis: "Legitimate interests" },
    { id: "saas-elem-monitor-ips", dataAssetId: "saas-asset-monitoring", name: "IP Addresses", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 30, legalBasis: "Legitimate interests" },
    // CRM
    { id: "saas-elem-crm-contacts", dataAssetId: "saas-asset-crm", name: "B2B Contact Records", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, retentionDays: 1095, legalBasis: "Legitimate interests" },
    // Auth
    { id: "saas-elem-auth-creds", dataAssetId: "saas-asset-auth", name: "Login Credentials (Hashed)", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, retentionDays: 1095, legalBasis: "Contract performance" },
    { id: "saas-elem-auth-mfa", dataAssetId: "saas-asset-auth", name: "MFA Tokens & SSO Assertions", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, retentionDays: 1095, legalBasis: "Contract performance" },
    // Consent
    { id: "saas-elem-consent-records", dataAssetId: "saas-asset-consent", name: "Consent Records", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 1825, legalBasis: "Legal obligation (GDPR Art. 7)" },
    { id: "saas-elem-consent-cookies", dataAssetId: "saas-asset-consent", name: "Cookie Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, retentionDays: 365, legalBasis: "Consent" },
  ],

  // ── Processing Activities ───────────────────────────────────
  activities: [
    { id: "saas-pa-workspace-ops", name: "Workspace & Task Management", description: "Processing of workspace data including projects, tasks, boards, and collaboration features for B2B customers and their team members.", purpose: "Enable project management and team collaboration as the core contracted service", legalBasis: "CONTRACT", legalBasisDetail: "Article 6(1)(b) — processing necessary for performance of the SaaS subscription contract between CloudForge Labs and customer organizations", dataSubjects: ["B2B customers", "Workspace users", "Team members"], categories: ["IDENTIFIERS", "OTHER"], recipients: ["CloudForge Labs (controller)", "AWS (processor)"], retentionPeriod: "Duration of contract + 90 days", retentionDays: 1825, isActive: true, lastReviewedAt: "2025-09-15", nextReviewAt: "2026-03-15", assetIds: ["saas-asset-user-db", "saas-asset-project-platform", "saas-asset-auth"] },
    { id: "saas-pa-billing-sub", name: "Subscription Billing & Invoicing", description: "Processing of billing data for SaaS subscription management, payment collection, invoice generation, and tax compliance.", purpose: "Manage subscription lifecycle, process payments, and comply with EU tax obligations", legalBasis: "CONTRACT", legalBasisDetail: "Article 6(1)(b) for billing; Article 6(1)(c) for tax record retention", dataSubjects: ["Account owners", "Billing contacts"], categories: ["IDENTIFIERS", "FINANCIAL"], recipients: ["Stripe (processor)", "Tax authorities (legal obligation)"], retentionPeriod: "10 years (EU tax compliance)", retentionDays: 3650, isActive: true, lastReviewedAt: "2025-08-01", nextReviewAt: "2026-02-01", assetIds: ["saas-asset-billing", "saas-asset-user-db"] },
    { id: "saas-pa-product-analytics", name: "Product Analytics & Feature Optimization", description: "Collection and analysis of user behavior events, feature usage metrics, and session metadata to improve product UX, prioritize the roadmap, and optimize onboarding funnels. Involves EU-to-US transfer to Mixpanel. Subject of DPIA.", purpose: "Improve product experience and inform roadmap decisions through behavioral analytics", legalBasis: "LEGITIMATE_INTERESTS", legalBasisDetail: "Article 6(1)(f) — legitimate interest in improving the product. LIA completed. Balanced against user expectations; pseudonymized user IDs, opt-out available.", dataSubjects: ["Workspace users", "Trial users"], categories: ["BEHAVIORAL", "IDENTIFIERS"], recipients: ["Mixpanel (processor, US)", "Product team (internal)"], retentionPeriod: "12 months rolling", retentionDays: 365, automatedDecisionMaking: false, isActive: true, lastReviewedAt: "2025-10-01", nextReviewAt: "2026-04-01", assetIds: ["saas-asset-analytics", "saas-asset-project-platform", "saas-asset-user-db"] },
    { id: "saas-pa-support", name: "Customer Support & Communication", description: "Handling support tickets, live chat, and customer communications through Intercom for issue resolution and service delivery.", purpose: "Provide customer support as part of the contracted SaaS service", legalBasis: "CONTRACT", legalBasisDetail: "Article 6(1)(b) — support is integral to service delivery under the subscription agreement", dataSubjects: ["Workspace users", "Account admins"], categories: ["IDENTIFIERS", "OTHER"], recipients: ["Intercom (processor, US)", "Support team (internal)"], retentionPeriod: "2 years after ticket closure", retentionDays: 730, isActive: true, lastReviewedAt: "2025-07-20", nextReviewAt: "2026-01-20", assetIds: ["saas-asset-helpdesk", "saas-asset-user-db"] },
    { id: "saas-pa-employment", name: "Employment Records Management", description: "Processing of employee personal data for HR administration, payroll, benefits, absence management, and statutory reporting.", purpose: "Manage employment relationship and comply with labor law obligations", legalBasis: "CONTRACT", legalBasisDetail: "Article 6(1)(b) for employment contract; Article 6(1)(c) for payroll tax and social security", dataSubjects: ["Employees", "Job applicants"], categories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"], recipients: ["Personio (processor)", "Tax authorities", "Social security institutions"], retentionPeriod: "7 years post-employment (statutory)", retentionDays: 2555, isActive: true, lastReviewedAt: "2025-06-15", nextReviewAt: "2025-12-15", assetIds: ["saas-asset-hr-system"] },
    { id: "saas-pa-security-monitoring", name: "Security & Infrastructure Monitoring", description: "Continuous monitoring of application infrastructure, error tracking, and security event logging via Datadog. Traces may contain user context for debugging.", purpose: "Ensure service availability, detect security incidents, and debug production issues", legalBasis: "LEGITIMATE_INTERESTS", legalBasisDetail: "Article 6(1)(f) — legitimate interest in security and service reliability; balanced against minimal data exposure (IPs, user IDs in error context)", dataSubjects: ["Workspace users (indirectly)", "Employees"], categories: ["IDENTIFIERS", "BEHAVIORAL"], recipients: ["Datadog (processor, EU)", "Engineering team (internal)"], retentionPeriod: "30 days (log retention)", retentionDays: 30, isActive: true, lastReviewedAt: "2025-11-01", nextReviewAt: "2026-05-01", assetIds: ["saas-asset-monitoring", "saas-asset-project-platform"] },
    { id: "saas-pa-sales", name: "Enterprise Sales & Account Management", description: "Management of B2B sales pipeline, enterprise leads, deal tracking, and account management in Salesforce.", purpose: "Manage enterprise sales pipeline and customer relationships", legalBasis: "LEGITIMATE_INTERESTS", legalBasisDetail: "Article 6(1)(f) — legitimate interest in B2B sales. Processing limited to business contact details of professional contacts.", dataSubjects: ["Business contacts", "Enterprise prospects"], categories: ["IDENTIFIERS", "OTHER"], recipients: ["Salesforce (processor, EU)", "Sales team (internal)"], retentionPeriod: "3 years after last interaction", retentionDays: 1095, isActive: true, lastReviewedAt: "2025-08-10", nextReviewAt: "2026-02-10", assetIds: ["saas-asset-crm"] },
  ],

  // ── Data Flows ──────────────────────────────────────────────
  flows: [
    { id: "saas-flow-1", name: "User DB to Analytics", description: "Pseudonymized user identifiers and workspace metadata sent to Mixpanel for product analytics event correlation.", sourceAssetId: "saas-asset-user-db", destinationAssetId: "saas-asset-analytics", dataCategories: ["IDENTIFIERS", "BEHAVIORAL"], frequency: "Real-time", volume: "~2M events/day", encryptionMethod: "TLS 1.3 in transit", isAutomated: true },
    { id: "saas-flow-2", name: "Platform to Monitoring", description: "Application traces, error logs, and performance metrics sent to Datadog. User context may be included in error payloads.", sourceAssetId: "saas-asset-project-platform", destinationAssetId: "saas-asset-monitoring", dataCategories: ["IDENTIFIERS"], frequency: "Real-time", volume: "~500K spans/day", encryptionMethod: "TLS 1.3 in transit", isAutomated: true },
    { id: "saas-flow-3", name: "User DB to Helpdesk", description: "User profile and account data synced to Intercom for contextual customer support.", sourceAssetId: "saas-asset-user-db", destinationAssetId: "saas-asset-helpdesk", dataCategories: ["IDENTIFIERS"], frequency: "Near real-time (webhook)", volume: "~1K updates/day", encryptionMethod: "TLS 1.3 + API key auth", isAutomated: true },
    { id: "saas-flow-4", name: "User DB to Billing", description: "Account owner details and organization metadata synced to Stripe for subscription and invoice management.", sourceAssetId: "saas-asset-user-db", destinationAssetId: "saas-asset-billing", dataCategories: ["IDENTIFIERS", "FINANCIAL"], frequency: "On account creation/update", volume: "~200 events/day", encryptionMethod: "TLS 1.3 + Stripe API", isAutomated: true },
    { id: "saas-flow-5", name: "Auth to User DB", description: "Authentication events, SSO assertions, and session tokens flow from Auth0 to the user database upon login.", sourceAssetId: "saas-asset-auth", destinationAssetId: "saas-asset-user-db", dataCategories: ["IDENTIFIERS"], frequency: "On every login", volume: "~10K logins/day", encryptionMethod: "TLS 1.3 + JWT signing", isAutomated: true },
    { id: "saas-flow-6", name: "Platform to Analytics", description: "In-app behavior events (clicks, navigation, feature usage) streamed from the SaaS platform to Mixpanel.", sourceAssetId: "saas-asset-project-platform", destinationAssetId: "saas-asset-analytics", dataCategories: ["BEHAVIORAL"], frequency: "Real-time", volume: "~2M events/day", encryptionMethod: "TLS 1.3", isAutomated: true },
    { id: "saas-flow-7", name: "CRM to Billing", description: "Enterprise deal data and contract terms synced from Salesforce to Stripe for custom invoicing.", sourceAssetId: "saas-asset-crm", destinationAssetId: "saas-asset-billing", dataCategories: ["IDENTIFIERS", "FINANCIAL"], frequency: "On deal close", volume: "~20 events/week", encryptionMethod: "TLS 1.3 + OAuth", isAutomated: true },
    { id: "saas-flow-8", name: "Helpdesk to CRM", description: "Customer health signals and support escalation data synced from Intercom to Salesforce for account management.", sourceAssetId: "saas-asset-helpdesk", destinationAssetId: "saas-asset-crm", dataCategories: ["IDENTIFIERS", "OTHER"], frequency: "On escalation", volume: "~50 events/week", encryptionMethod: "TLS 1.3 + API key", isAutomated: true },
  ],

  // ── International Transfers ─────────────────────────────────
  transfers: [
    { id: "saas-transfer-1", name: "EU to US: Mixpanel Analytics", description: "Transfer of pseudonymized behavioral event data from EU workspace users to Mixpanel servers in the US for product analytics processing.", destinationCountry: "US", destinationOrg: "Mixpanel Inc.", mechanism: "STANDARD_CONTRACTUAL_CLAUSES", safeguards: "EU SCCs (2021 module controller-to-processor), supplementary measures including pseudonymization of user IDs, encryption in transit and at rest, Mixpanel SOC 2 Type II. TIA conducted per Schrems II requirements.", tiaCompleted: true, tiaDate: "2025-06-15", activityId: "saas-pa-product-analytics" },
    { id: "saas-transfer-2", name: "EU to US: Salesforce CRM", description: "Transfer of B2B contact records and deal data to Salesforce infrastructure in the US for enterprise sales pipeline management.", destinationCountry: "US", destinationOrg: "Salesforce Inc.", mechanism: "STANDARD_CONTRACTUAL_CLAUSES", safeguards: "EU SCCs (2021), Salesforce BCRs, encryption at rest (AES-256) and in transit (TLS 1.3), Salesforce Hyperforce EU data residency option evaluated but US instance retained for sales team performance.", tiaCompleted: true, tiaDate: "2025-05-20", activityId: "saas-pa-sales" },
    { id: "saas-transfer-3", name: "EU to US: Intercom Support", description: "Transfer of customer support interactions, contact details, and chat transcripts to Intercom US infrastructure.", destinationCountry: "US", destinationOrg: "Intercom Inc.", mechanism: "STANDARD_CONTRACTUAL_CLAUSES", safeguards: "EU SCCs (2021 module controller-to-processor), Intercom SOC 2, data encrypted in transit and at rest. Customer PII limited to name, email, and workspace context.", tiaCompleted: true, tiaDate: "2025-07-10", activityId: "saas-pa-support" },
  ],

  // ── Vendors ─────────────────────────────────────────────────
  vendors: [
    { id: "saas-vendor-aws", name: "Amazon Web Services (AWS)", description: "Primary cloud infrastructure provider hosting the core SaaS platform, user database, and all EU-region services.", website: "https://aws.amazon.com", status: "ACTIVE", riskTier: "MEDIUM", riskScore: 32, primaryContact: "AWS Enterprise Support", contactEmail: "enterprise-support@aws.amazon.com", categories: ["Cloud Infrastructure", "Database Hosting"], dataProcessed: ["IDENTIFIERS", "BEHAVIORAL", "FINANCIAL"], countries: ["IE"], certifications: ["ISO 27001", "SOC 2 Type II", "C5", "GDPR DPA"], lastAssessedAt: "2025-04-10", nextReviewAt: "2026-04-10" },
    { id: "saas-vendor-stripe", name: "Stripe", description: "Payment processing and subscription billing platform handling all B2B SaaS billing via EU entity.", website: "https://stripe.com", status: "ACTIVE", riskTier: "MEDIUM", riskScore: 28, primaryContact: "Stripe Account Management", contactEmail: "privacy@stripe.com", categories: ["Payment Processing", "Billing"], dataProcessed: ["IDENTIFIERS", "FINANCIAL"], countries: ["IE", "US"], certifications: ["PCI DSS Level 1", "SOC 2 Type II", "ISO 27001", "GDPR DPA"], lastAssessedAt: "2025-03-15", nextReviewAt: "2026-03-15" },
    { id: "saas-vendor-datadog", name: "Datadog", description: "Infrastructure monitoring, APM, and log management platform used for operational observability.", website: "https://www.datadoghq.com", status: "ACTIVE", riskTier: "LOW", riskScore: 22, primaryContact: "Datadog Customer Success", contactEmail: "privacy@datadoghq.com", categories: ["Monitoring", "DevOps"], dataProcessed: ["IDENTIFIERS"], countries: ["EU"], certifications: ["SOC 2 Type II", "ISO 27001", "GDPR DPA"], lastAssessedAt: "2025-05-20", nextReviewAt: "2026-05-20" },
    { id: "saas-vendor-intercom", name: "Intercom", description: "Customer messaging and support platform providing live chat, ticketing, and product tours.", website: "https://www.intercom.com", status: "ACTIVE", riskTier: "MEDIUM", riskScore: 42, primaryContact: "Intercom Privacy Team", contactEmail: "privacy@intercom.com", categories: ["Customer Support", "Messaging"], dataProcessed: ["IDENTIFIERS", "OTHER"], countries: ["US", "IE"], certifications: ["SOC 2 Type II", "GDPR DPA"], lastAssessedAt: "2025-06-10", nextReviewAt: "2026-06-10" },
    { id: "saas-vendor-mixpanel", name: "Mixpanel", description: "Product analytics platform used for behavioral event tracking, funnel analysis, and feature adoption measurement. Primary focus of DPIA.", website: "https://mixpanel.com", status: "UNDER_REVIEW", riskTier: "HIGH", riskScore: 55, primaryContact: "Mixpanel DPO", contactEmail: "privacy@mixpanel.com", categories: ["Analytics", "Product Intelligence"], dataProcessed: ["BEHAVIORAL", "IDENTIFIERS"], countries: ["US"], certifications: ["SOC 2 Type II", "GDPR DPA", "CCPA Compliant"], lastAssessedAt: "2025-10-01", nextReviewAt: "2026-04-01" },
    { id: "saas-vendor-personio", name: "Personio", description: "All-in-one HR platform for employee management, payroll, and recruitment in the EU.", website: "https://www.personio.com", status: "ACTIVE", riskTier: "MEDIUM", riskScore: 35, primaryContact: "Personio Customer Success", contactEmail: "privacy@personio.de", categories: ["HR Management", "Payroll"], dataProcessed: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"], countries: ["DE"], certifications: ["ISO 27001", "SOC 2 Type II", "GDPR DPA", "C5"], lastAssessedAt: "2025-02-20", nextReviewAt: "2026-02-20" },
    { id: "saas-vendor-salesforce", name: "Salesforce", description: "Enterprise CRM platform for B2B sales pipeline management and customer account data.", website: "https://www.salesforce.com", status: "UNDER_REVIEW", riskTier: "MEDIUM", riskScore: 38, primaryContact: "Salesforce Privacy Team", contactEmail: "privacy@salesforce.com", categories: ["CRM", "Sales"], dataProcessed: ["IDENTIFIERS", "OTHER"], countries: ["US", "DE"], certifications: ["ISO 27001", "SOC 2 Type II", "GDPR DPA", "BCR"], lastAssessedAt: "2025-05-15", nextReviewAt: "2025-11-15" },
    { id: "saas-vendor-cookiebot", name: "Cookiebot (Usercentrics)", description: "Cookie consent management platform for GDPR-compliant consent collection on marketing site and in-app.", website: "https://www.cookiebot.com", status: "ACTIVE", riskTier: "LOW", riskScore: 15, primaryContact: "Cookiebot Support", contactEmail: "support@cookiebot.com", categories: ["Consent Management", "Privacy"], dataProcessed: ["BEHAVIORAL", "IDENTIFIERS"], countries: ["DK"], certifications: ["ISO 27001", "GDPR DPA"], lastAssessedAt: "2025-01-10", nextReviewAt: "2026-01-10" },
  ],

  // ── Contracts ───────────────────────────────────────────────
  contracts: [
    { id: "saas-contract-1", vendorId: "saas-vendor-aws", type: "DPA", status: "ACTIVE", name: "AWS Data Processing Addendum", description: "GDPR-compliant DPA covering all AWS services used in eu-west-1 region", startDate: "2024-01-15", endDate: "2026-01-15", autoRenewal: true, value: 48000, currency: "EUR" },
    { id: "saas-contract-2", vendorId: "saas-vendor-stripe", type: "DPA", status: "ACTIVE", name: "Stripe Data Processing Agreement", description: "DPA covering payment data processing through Stripe EU entity", startDate: "2024-03-01", endDate: "2026-03-01", autoRenewal: true },
    { id: "saas-contract-3", vendorId: "saas-vendor-mixpanel", type: "DPA", status: "ACTIVE", name: "Mixpanel Data Processing Agreement", description: "DPA with EU SCCs annex for behavioral analytics data transferred to US", startDate: "2025-01-01", endDate: "2026-12-31", autoRenewal: false, value: 18000, currency: "EUR" },
    { id: "saas-contract-4", vendorId: "saas-vendor-mixpanel", type: "SCC", status: "ACTIVE", name: "Mixpanel Standard Contractual Clauses", description: "EU 2021 SCCs (Module 2: controller-to-processor) supplementing the DPA for EU-US transfers", startDate: "2025-01-01", endDate: "2026-12-31", autoRenewal: false },
    { id: "saas-contract-5", vendorId: "saas-vendor-personio", type: "MSA", status: "ACTIVE", name: "Personio Master Subscription Agreement", description: "Enterprise HR platform subscription including DPA addendum", startDate: "2024-06-01", endDate: "2026-06-01", autoRenewal: true, value: 24000, currency: "EUR" },
    { id: "saas-contract-6", vendorId: "saas-vendor-salesforce", type: "DPA", status: "ACTIVE", name: "Salesforce Data Processing Addendum", description: "DPA covering CRM data processing with BCR and SCC annexes", startDate: "2024-04-01", endDate: "2026-04-01", autoRenewal: true, value: 36000, currency: "EUR" },
  ],

  // ── DSAR Intake Form ────────────────────────────────────────
  intakeForm: {
    name: "CloudForge Privacy Request Form",
    slug: "privacy-request-saas",
    title: "Submit a Privacy Request",
    description: "Use this form to exercise your data protection rights under GDPR. CloudForge Labs will respond within 30 days of verifying your identity.",
  },

  // ── DSARs ───────────────────────────────────────────────────
  dsars: [
    {
      id: "saas-dsar-1", publicId: "CF-DSAR-2025-001", type: "ACCESS", status: "COMPLETED",
      requesterName: "Henrik Johansson", requesterEmail: "henrik.johansson@enterprise-client.eu",
      relationship: "Customer", description: "As the workspace administrator for our organization (Enterprise Client GmbH, 200+ users), I am requesting a full export of all personal data processed by CloudForge Labs in connection with our workspace. This includes user profiles, activity logs, project data, billing records, and any analytics data collected about our team members. We need this for our own internal GDPR compliance audit.",
      receivedAt: "2025-06-01T09:00:00Z", acknowledgedAt: "2025-06-01T14:30:00Z",
      dueDate: "2025-07-01", completedAt: "2025-06-25T16:00:00Z",
      verificationMethod: "Verified as workspace admin via SSO domain match and account role check",
      verifiedAt: "2025-06-02T10:00:00Z", responseMethod: "Secure download link via encrypted email",
      responseNotes: "Comprehensive data export delivered including workspace user directory, activity logs (12 months), billing history, and analytics events. Session recording metadata excluded per data minimization.",
      tasks: [
        { id: "saas-dsar-1-t1", dataAssetId: "saas-asset-user-db", assignee: "member1", title: "Export user profiles and workspace directory", description: "Export all user profiles, roles, and preferences for the Enterprise Client workspace.", status: "COMPLETED", completedAt: "2025-06-10T12:00:00Z", notes: "Exported 214 user profiles with role assignments." },
        { id: "saas-dsar-1-t2", dataAssetId: "saas-asset-project-platform", assignee: "member1", title: "Export project and activity data", description: "Export all projects, tasks, and activity logs for the workspace.", status: "COMPLETED", completedAt: "2025-06-15T14:00:00Z", notes: "47 projects, 2,340 tasks, 12 months of activity logs exported." },
        { id: "saas-dsar-1-t3", dataAssetId: "saas-asset-analytics", assignee: "member2", title: "Extract analytics events for workspace users", description: "Query Mixpanel for all behavioral events attributed to Enterprise Client workspace user IDs.", status: "COMPLETED", completedAt: "2025-06-18T11:00:00Z", notes: "Pseudonymized user IDs mapped back and 890K events exported." },
        { id: "saas-dsar-1-t4", dataAssetId: "saas-asset-billing", assignee: "dpo", title: "Compile billing records", description: "Export all invoices, payment records, and subscription history.", status: "COMPLETED", completedAt: "2025-06-12T09:00:00Z", notes: "24 invoices and subscription change log exported." },
      ],
      communications: [
        { id: "saas-dsar-1-c1", direction: "INBOUND", channel: "Web Form", subject: "Data Access Request — Enterprise Client GmbH", content: "Submitted via CloudForge Privacy Request Form.", sentAt: "2025-06-01T09:00:00Z" },
        { id: "saas-dsar-1-c2", direction: "OUTBOUND", channel: "Email", subject: "RE: Your Data Access Request (CF-DSAR-2025-001)", content: "Dear Henrik, we acknowledge your request and have verified your identity as workspace admin. We will provide the data export within 30 days. Reference: CF-DSAR-2025-001.", sentAt: "2025-06-02T10:30:00Z", sentBy: "dpo" },
        { id: "saas-dsar-1-c3", direction: "OUTBOUND", channel: "Email", subject: "Data Export Ready — CF-DSAR-2025-001", content: "Your data export is ready. Please use the secure download link (valid 7 days) to access the encrypted ZIP archive. Password sent separately.", sentAt: "2025-06-25T16:00:00Z", sentBy: "dpo" },
      ],
    },
    {
      id: "saas-dsar-2", publicId: "CF-DSAR-2025-002", type: "ERASURE", status: "IN_PROGRESS",
      requesterName: "Maria Petrova", requesterEmail: "maria.petrova@former-client.com",
      relationship: "Customer", description: "I was a user in a CloudForge workspace managed by my former employer. I have since left the company and want all my personal data deleted from CloudForge systems. This includes my user profile, any tasks assigned to me, my activity history, and analytics data. My former employer's workspace admin should not retain access to my personal information after my departure.",
      receivedAt: "2025-11-15T11:00:00Z", acknowledgedAt: "2025-11-15T15:00:00Z",
      dueDate: "2025-12-15", verificationMethod: "Email verification via original account email",
      verifiedAt: "2025-11-17T09:00:00Z",
      tasks: [
        { id: "saas-dsar-2-t1", dataAssetId: "saas-asset-user-db", assignee: "member1", title: "Anonymize user profile", description: "Replace personal identifiers with anonymized placeholders. Workspace admin notified of pending anonymization.", status: "IN_PROGRESS", notes: "Coordinating with workspace admin — org data retention policy conflict under review." },
        { id: "saas-dsar-2-t2", dataAssetId: "saas-asset-analytics", assignee: "member2", title: "Delete analytics events linked to user", description: "Remove or anonymize all Mixpanel events tied to the user's pseudonymized ID.", status: "PENDING" },
        { id: "saas-dsar-2-t3", dataAssetId: "saas-asset-helpdesk", assignee: "member2", title: "Remove support ticket PII", description: "Redact personal data from support ticket history in Intercom.", status: "PENDING" },
      ],
      communications: [
        { id: "saas-dsar-2-c1", direction: "INBOUND", channel: "Email", subject: "Request to Delete My Data", content: "Submitted directly via email to privacy@cloudforgelabs.eu.", sentAt: "2025-11-15T11:00:00Z" },
        { id: "saas-dsar-2-c2", direction: "OUTBOUND", channel: "Email", subject: "RE: Erasure Request — CF-DSAR-2025-002", content: "Dear Maria, we have received your erasure request. We are reviewing the scope, particularly regarding the intersection of your individual rights and the workspace organization's legitimate data retention interests. We will update you within 30 days.", sentAt: "2025-11-17T10:00:00Z", sentBy: "dpo" },
      ],
    },
    {
      id: "saas-dsar-3", publicId: "CF-DSAR-2025-003", type: "ACCESS", status: "IDENTITY_PENDING",
      requesterName: "Alex Chen", requesterEmail: "alex.chen@gmail.com",
      relationship: "User", description: "I use CloudForge through my company's workspace. I want to know what personal data CloudForge has about me. I'm using my personal email because I don't want my employer to know I'm making this request.",
      receivedAt: "2025-12-01T08:00:00Z", dueDate: "2025-12-31",
      tasks: [
        { id: "saas-dsar-3-t1", dataAssetId: "saas-asset-user-db", assignee: "dpo", title: "Verify requester identity", description: "Requester used personal email, not their workspace email. Need to verify they are a genuine CloudForge user without alerting their workspace admin.", status: "IN_PROGRESS", notes: "Sent identity verification email requesting workspace email confirmation via separate secure channel." },
        { id: "saas-dsar-3-t2", dataAssetId: "saas-asset-auth", assignee: "member1", title: "Cross-reference authentication records", description: "Check if alex.chen@gmail.com is linked to any CloudForge workspace account.", status: "PENDING" },
      ],
      communications: [
        { id: "saas-dsar-3-c1", direction: "INBOUND", channel: "Web Form", subject: "Data Access Request", content: "Submitted via public privacy request form.", sentAt: "2025-12-01T08:00:00Z" },
        { id: "saas-dsar-3-c2", direction: "OUTBOUND", channel: "Email", subject: "Identity Verification Required — CF-DSAR-2025-003", content: "Dear Alex, to process your request we need to verify your identity. Please confirm your CloudForge workspace email address via the secure verification link. Your request will be handled confidentially.", sentAt: "2025-12-02T09:00:00Z", sentBy: "dpo" },
      ],
    },
    {
      id: "saas-dsar-4", publicId: "CF-DSAR-2025-004", type: "PORTABILITY", status: "SUBMITTED",
      requesterName: "Sophie Laurent", requesterEmail: "sophie.laurent@startup-co.fr",
      relationship: "Customer", description: "Our company is migrating from CloudForge to a competitor. Under GDPR Article 20, we request a machine-readable export of all our workspace data including projects, tasks, user profiles, and any structured data that can be ported to our new project management tool.",
      receivedAt: "2025-12-10T14:00:00Z", dueDate: "2026-01-09",
      tasks: [
        { id: "saas-dsar-4-t1", dataAssetId: "saas-asset-project-platform", assignee: "member1", title: "Prepare machine-readable workspace export", description: "Generate JSON/CSV export of all projects, tasks, boards, and team data in portable format.", status: "PENDING" },
        { id: "saas-dsar-4-t2", dataAssetId: "saas-asset-user-db", assignee: "member2", title: "Export user profiles in structured format", description: "Export workspace user directory with roles and preferences in JSON format.", status: "PENDING" },
      ],
      communications: [
        { id: "saas-dsar-4-c1", direction: "INBOUND", channel: "Email", subject: "Data Portability Request — Migrating Away", content: "Formal portability request from workspace admin at startup-co.fr.", sentAt: "2025-12-10T14:00:00Z" },
        { id: "saas-dsar-4-c2", direction: "OUTBOUND", channel: "Email", subject: "Acknowledgment — CF-DSAR-2025-004", content: "Dear Sophie, we have received your data portability request. We will prepare a machine-readable export of your workspace data. Please note that Article 20 covers data provided by you and processed by automated means; we will include all qualifying data.", sentAt: "2025-12-11T10:00:00Z", sentBy: "dpo" },
        { id: "saas-dsar-4-c3", direction: "INBOUND", channel: "Email", subject: "RE: Acknowledgment — CF-DSAR-2025-004", content: "Thank you. Please include all project data, attachments metadata, and team assignments. We need JSON format if possible.", sentAt: "2025-12-11T14:00:00Z" },
      ],
    },
    {
      id: "saas-dsar-5", publicId: "CF-DSAR-2025-005", type: "ERASURE", status: "REJECTED",
      requesterName: "Unknown", requesterEmail: "throwaway89231@protonmail.com",
      relationship: "User", description: "Delete all my data immediately. I know you have my information.",
      receivedAt: "2025-10-20T03:00:00Z", dueDate: "2025-11-19",
      responseNotes: "Unable to verify identity. No CloudForge account associated with the provided email. Request rejected under GDPR Art. 12(6) — unable to identify the data subject.",
      tasks: [
        { id: "saas-dsar-5-t1", dataAssetId: "saas-asset-user-db", assignee: "dpo", title: "Attempt to identify requester", description: "Search all systems for any account linked to the provided email address.", status: "COMPLETED", completedAt: "2025-10-22T10:00:00Z", notes: "No account found. No match in auth, helpdesk, or CRM systems." },
        { id: "saas-dsar-5-t2", dataAssetId: "saas-asset-auth", assignee: "member1", title: "Search authentication logs", description: "Check Auth0 for any login attempts or account registrations with this email.", status: "COMPLETED", completedAt: "2025-10-22T11:00:00Z", notes: "No records found." },
      ],
      communications: [
        { id: "saas-dsar-5-c1", direction: "INBOUND", channel: "Email", subject: "Delete My Data", content: "Received via direct email to privacy@cloudforgelabs.eu from anonymous protonmail address.", sentAt: "2025-10-20T03:00:00Z" },
        { id: "saas-dsar-5-c2", direction: "OUTBOUND", channel: "Email", subject: "RE: Erasure Request — CF-DSAR-2025-005", content: "We have been unable to identify any personal data associated with your email address in our systems. Under GDPR Article 12(6), we are unable to process your request without being able to verify your identity. If you believe this is in error, please provide additional identifying information such as your CloudForge workspace email.", sentAt: "2025-10-25T09:00:00Z", sentBy: "dpo" },
      ],
    },
  ],

  // ── Assessments ─────────────────────────────────────────────
  assessments: [
    // 1. LIA: Product Analytics — APPROVED
    {
      id: "saas-assess-lia-analytics", templateType: "lia", activityId: "saas-pa-product-analytics",
      name: "LIA: Product Analytics & Feature Optimization", description: "Legitimate Interest Assessment for the collection and analysis of user behavioral data via Mixpanel for product improvement purposes.",
      status: "APPROVED", riskLevel: "MEDIUM", startedAt: "2025-07-01", submittedAt: "2025-07-20", completedAt: "2025-07-25", dueDate: "2025-08-01",
      responses: [
        { questionId: "purpose", sectionId: "purpose", response: "CloudForge Labs has a legitimate interest in understanding how users interact with the product to improve UX, prioritize features, and optimize onboarding. This directly supports product-market fit and reduces churn for B2B customers.", responder: "dpo" },
        { questionId: "necessity", sectionId: "necessity", response: "Behavioral analytics is necessary to make data-driven product decisions. Without usage data, feature prioritization would be based on anecdotal feedback rather than actual user behavior patterns across 50K users.", responder: "dpo" },
        { questionId: "balancing", sectionId: "balancing", response: "User IDs are pseudonymized before transmission to Mixpanel. Users can opt out of analytics tracking via workspace settings. Session recordings capture metadata only, not screen content. The data is not used for individual profiling or automated decisions. The legitimate interest outweighs the limited impact on user privacy given these safeguards.", responder: "dpo" },
      ],
      mitigations: [
        { id: "saas-assess-lia-analytics-m1", riskId: "lia-risk-1", title: "Pseudonymize user identifiers before Mixpanel ingestion", description: "Replace direct user IDs with hashed pseudonyms using SHA-256 with per-org salt before events are sent to Mixpanel.", status: "IMPLEMENTED", priority: 1, owner: "member2", completedAt: "2025-07-15", evidence: "Code review PR #847 merged — pseudonymization middleware verified." },
        { id: "saas-assess-lia-analytics-m2", riskId: "lia-risk-2", title: "Implement user-level analytics opt-out", description: "Add opt-out toggle in workspace user settings to disable behavioral event tracking for individual users.", status: "IMPLEMENTED", priority: 2, owner: "member1", completedAt: "2025-07-18", evidence: "Feature deployed in v2.14.0. Opt-out rate: 2.3% of users." },
      ],
      approvals: [
        { id: "saas-assess-lia-analytics-a1", approver: "dpo", level: 1, status: "APPROVED", comments: "LIA demonstrates clear legitimate interest with adequate safeguards. Recommend proceeding with annual review.", decidedAt: "2025-07-25" },
      ],
    },
    // 2. LIA: Security Monitoring — IN_PROGRESS
    {
      id: "saas-assess-lia-security", templateType: "lia", activityId: "saas-pa-security-monitoring",
      name: "LIA: Security & Infrastructure Monitoring", description: "Legitimate Interest Assessment for processing user context data within infrastructure monitoring and error traces via Datadog.",
      status: "IN_PROGRESS", startedAt: "2025-11-01", dueDate: "2025-12-15",
      responses: [
        { questionId: "purpose", sectionId: "purpose", response: "CloudForge Labs has a legitimate interest in maintaining service security, availability, and rapid incident response. Monitoring error traces with user context enables faster debugging and security threat detection.", responder: "dpo" },
        { questionId: "necessity", sectionId: "necessity", response: "User context in error traces (user ID, IP address, request path) is necessary for root cause analysis. Without this context, debugging production issues affecting specific users would require manual correlation, delaying resolution by hours.", responder: "dpo" },
      ],
      mitigations: [],
      approvals: [],
    },
    // 3. Custom: Enterprise SSO Privacy Review — PENDING_REVIEW
    {
      id: "saas-assess-sso-review", templateType: "custom",
      name: "Enterprise SSO Privacy Review", description: "Privacy review of the enterprise SSO/SAML integration feature, assessing data flows between customer identity providers and CloudForge Auth0 tenant.",
      status: "PENDING_REVIEW", startedAt: "2025-10-15", submittedAt: "2025-11-10", dueDate: "2025-12-01",
      responses: [
        { questionId: "scope", sectionId: "scope", response: "This review covers the SAML/OIDC federation between enterprise customer IdPs and the CloudForge Auth0 tenant. Data elements include: SAML assertions (name, email, groups), session tokens, and audit logs of authentication events.", responder: "dpo" },
        { questionId: "findings", sectionId: "findings", response: "SSO assertions contain only necessary attributes (email, name, group memberships). No special category data is included. Session tokens have 8-hour expiry. Auth0 EU tenant ensures no US data transfer for authentication. SAML assertions are validated and not stored beyond session duration.", responder: "dpo" },
        { questionId: "recommendation", sectionId: "recommendation", response: "The SSO integration follows privacy by design principles. Recommend: (1) document minimum attribute requirements in customer onboarding guide, (2) add IdP configuration validation to reject over-provisioned SAML attributes, (3) schedule annual review.", responder: "dpo" },
      ],
      mitigations: [],
      approvals: [],
    },
    // 4. Custom: New SMS Notification Feature — DRAFT
    {
      id: "saas-assess-sms-feature", templateType: "custom",
      name: "Privacy Review: SMS Notification Feature", description: "Draft privacy assessment for a proposed SMS notification feature allowing workspace admins to send task deadline reminders via SMS to team members.",
      status: "DRAFT", startedAt: "2025-12-01", dueDate: "2026-01-15",
      responses: [
        { questionId: "scope", sectionId: "scope", response: "Proposed feature: workspace admins can enable SMS notifications for task deadline reminders. Requires collecting mobile phone numbers from workspace users. SMS delivery via Twilio (US-based processor).", responder: "member1" },
      ],
      mitigations: [],
      approvals: [],
    },
    // 5. DPIA: Product Analytics Platform — APPROVED (showcase)
    {
      id: "saas-assess-dpia-analytics", templateType: "dpia", activityId: "saas-pa-product-analytics",
      vendorId: "saas-vendor-mixpanel",
      name: "DPIA: Product Analytics Platform (Mixpanel)", description: "Comprehensive Data Protection Impact Assessment for the Mixpanel-based product analytics system processing behavioral data from 50K EU workspace users, including EU-to-US data transfers.",
      status: "APPROVED", riskLevel: "MEDIUM", riskScore: 45,
      startedAt: "2025-08-01", submittedAt: "2025-09-15", completedAt: "2025-09-25", dueDate: "2025-10-01",
      responses: [
        // S1: Processing Description
        { questionId: "q1_1", sectionId: "s1", response: "The processing involves the following categories of personal data:\n\n1. **Pseudonymized user identifiers**: SHA-256 hashed user IDs with per-organization salt, enabling behavioral event correlation without direct identification.\n2. **Behavioral event data**: Page views, feature clicks, navigation paths, time-on-task metrics, and funnel progression events.\n3. **Session metadata**: Session duration, browser type, OS version, screen resolution, and general geographic region (country-level, derived from IP which is then discarded).\n4. **Feature usage metrics**: Aggregated adoption rates, activation milestones, and feature-specific interaction counts.\n5. **Workspace context**: Organization tier (free/pro/enterprise), workspace size bucket (1-10, 11-50, 51-200, 200+), and industry vertical.\n\nNo special category data (Art. 9) is processed. Direct identifiers (name, email) are stripped before transmission to Mixpanel. IP addresses are used transiently for geolocation and immediately discarded by the Mixpanel ingestion pipeline.", responder: "dpo" },
        { questionId: "q1_2", sectionId: "s1", response: "The primary purpose is to improve the CloudForge product experience through data-driven insights:\n\n1. **Product optimization**: Understanding how users interact with features to identify UX friction points and prioritize improvements. For example, analyzing task creation funnels revealed a 34% drop-off at the assignee selection step, leading to a redesign that improved completion by 18%.\n2. **Onboarding effectiveness**: Measuring activation milestones (first project created, first team member invited, first task completed) to optimize the new user journey and reduce time-to-value.\n3. **Feature adoption**: Tracking adoption rates of new features post-launch to validate product hypotheses and inform the roadmap. Features below 5% adoption after 90 days are evaluated for deprecation.\n4. **Cohort analysis**: Comparing usage patterns across customer segments (SMB vs. enterprise, industry verticals) to tailor the product experience.\n\nNo secondary purposes such as advertising, individual profiling for automated decisions, or third-party data sharing are pursued.", responder: "dpo" },
        { questionId: "q1_3", sectionId: "s1", response: "Legitimate interests (Art. 6(1)(f))", responder: "dpo" },
        { questionId: "q1_4", sectionId: "s1", response: ["Customers", "Business contacts"], responder: "dpo" },
        { questionId: "q1_5", sectionId: "s1", response: "10,000 \u2013 100,000", responder: "dpo" },
        { questionId: "q1_6", sectionId: "s1", response: "Data flows through the following stages:\n\n**Collection**: The CloudForge web application (hosted on AWS eu-west-1) captures behavioral events via a client-side JavaScript SDK. Before any event leaves the browser, the user ID is replaced with a pseudonymized hash computed using SHA-256 with a per-organization salt stored server-side.\n\n**Transmission**: Events are sent via TLS 1.3-encrypted HTTPS to the Mixpanel ingestion endpoint. IP addresses are included in the request headers but Mixpanel is configured with the `ip=0` parameter to discard them after geolocation lookup.\n\n**Processing**: Mixpanel processes events in their US data center (primary processing region). Events are stored in Mixpanel's analytics database with a 12-month rolling retention window.\n\n**Access & recipients**:\n- CloudForge Product team (5 members): Full dashboard access with RBAC controls in Mixpanel.\n- CloudForge Engineering team (3 members): Read-only access for debugging product metrics.\n- Mixpanel Inc. (processor): Has access to raw event data for service delivery. Governed by DPA with EU SCCs.\n\n**Deletion**: Events older than 12 months are automatically purged. User-level deletion is supported via Mixpanel's GDPR deletion API within 30 days of request.", responder: "dpo" },
        // S2: Scope & Context
        { questionId: "q2_1", sectionId: "s2", response: "Non-sensitive personal data only", responder: "dpo" },
        { questionId: "q2_2", sectionId: "s2", response: "Retention periods are differentiated by data category:\n\n1. **Behavioral events** (page views, clicks, navigation): 12 months rolling retention in Mixpanel. Justified by the need to analyze year-over-year trends and seasonal usage patterns. Events older than 12 months are automatically purged via Mixpanel's data governance settings.\n\n2. **Session metadata** (duration, browser, OS): 90 days. Shorter retention is sufficient for debugging and UX optimization; historical device/browser data has diminishing analytical value.\n\n3. **Aggregated reports and dashboards**: Indefinite, but these contain only aggregate statistics with no individual-level data. Counts, percentages, and averages are not personal data.\n\n4. **Pseudonymized user mappings** (hash-to-user lookup): Retained in CloudForge's internal database for the duration of the user's account. Deleted within 30 days of account closure or DSAR erasure request. These mappings are never shared with Mixpanel.\n\nRetention periods were reviewed against the principle of storage limitation and reduced from the previous 24-month default to 12 months following the initial LIA in July 2025.", responder: "dpo" },
        { questionId: "q2_3", sectionId: "s2", response: "**Geographic scope**: Data subjects are workspace users across the EU/EEA, with the majority located in Germany (28%), France (19%), Netherlands (14%), Sweden (12%), and other EU member states.\n\n**International transfers**:\n- **EU \u2192 US (Mixpanel)**: Behavioral event data is transferred to Mixpanel's US data center for processing and storage. This is the primary cross-border transfer of concern.\n  - **Transfer mechanism**: EU 2021 Standard Contractual Clauses (Module 2: controller-to-processor), executed January 2025.\n  - **Supplementary measures**: (a) Pseudonymization of user IDs before transfer, (b) TLS 1.3 encryption in transit, (c) AES-256 encryption at rest in Mixpanel, (d) Mixpanel SOC 2 Type II certification.\n  - **Schrems II assessment**: Transfer Impact Assessment (TIA) completed June 2025. Concluded that the pseudonymized behavioral data is unlikely to be of interest to US intelligence services under FISA 702/EO 12333, and the supplementary measures effectively prevent re-identification by Mixpanel or third parties.\n  - **EU-US Data Privacy Framework**: Mixpanel is not currently DPF-certified; SCCs remain the primary transfer mechanism.\n\n- **EU data residency**: All other processing (user database, authentication, monitoring) remains within the EU (AWS eu-west-1, Auth0 EU, Datadog EU).", responder: "dpo" },
        { questionId: "q2_4", sectionId: "s2", response: "Probably expected \u2014 a reasonable extension of the service", responder: "dpo" },
        // S3: Necessity & Proportionality
        { questionId: "q3_1", sectionId: "s3", response: "Highly beneficial \u2014 significantly more effective than alternatives", responder: "dpo" },
        { questionId: "q3_2", sectionId: "s3", response: "The following alternatives were evaluated:\n\n1. **No analytics / feature-request surveys only**: Rejected because surveys capture stated preferences but miss actual behavior. With 50K users, survey response rates are typically 3-5%, creating significant sampling bias. Behavioral analytics captures usage from 100% of non-opted-out users.\n\n2. **Server-side log analysis only**: Rejected because server logs provide page-level data but miss client-side interactions (clicks, scroll depth, time-on-task) that are critical for UX optimization. Would require significant engineering investment to approximate Mixpanel's capabilities.\n\n3. **Self-hosted analytics (Plausible/Matomo)**: Evaluated seriously. Rejected for this phase because: (a) Mixpanel's funnel analysis and cohort features are significantly more mature, (b) self-hosting would require dedicated infrastructure and engineering resources, (c) Mixpanel's pseudonymization + SCC framework provides adequate GDPR compliance. Noted as a future option if Mixpanel's data practices change.\n\n4. **Fully anonymized/aggregated analytics only**: Partially adopted — aggregate dashboards are used for high-level metrics. However, cohort analysis and funnel debugging require pseudonymized individual-level event streams to identify where specific user segments experience friction.", responder: "dpo" },
        { questionId: "q3_3", sectionId: "s3", response: "The following data minimization measures are implemented:\n\n1. **Pseudonymization**: User IDs are replaced with SHA-256 hashes using per-organization salts before any data leaves the CloudForge application. The salt-to-org mapping is stored exclusively in CloudForge's EU-hosted database and is never shared with Mixpanel.\n\n2. **IP address discarding**: Mixpanel's `ip=0` configuration parameter ensures IP addresses are used only for country-level geolocation and immediately discarded — never stored.\n\n3. **Attribute allow-listing**: Only pre-approved event properties are sent to Mixpanel. A server-side middleware strips any properties not on the allow-list, preventing accidental PII leakage (e.g., if a developer adds a user's email to an event payload).\n\n4. **k-Anonymity threshold**: Reports and exports from Mixpanel enforce a minimum group size of k=5. Any cohort or segment with fewer than 5 users is suppressed in dashboards and API responses.\n\n5. **No session recordings**: Unlike some analytics platforms, we do not record screen sessions or DOM snapshots. Session metadata (duration, page count) is captured but not visual content.\n\n6. **RBAC in Mixpanel**: Access is restricted to 8 team members (5 product, 3 engineering) with role-based permissions. No raw data export without DPO approval.", responder: "dpo" },
        // S4: Consultation
        { questionId: "q4_1", sectionId: "s4", response: ["Data Protection Officer", "IT / Information Security", "Legal counsel", "Processor / vendor"], responder: "dpo" },
        { questionId: "q4_2", sectionId: "s4", response: "**DPO (Katrine Holm)**: Led the assessment. Recommended reducing retention from 24 to 12 months and implementing the k-anonymity threshold. Both recommendations were adopted.\n\n**IT/Information Security (Erik Lindstr\u00f6m)**: Reviewed the pseudonymization implementation and confirmed SHA-256 with per-org salt meets the EDPB's pseudonymization guidelines. Recommended adding the attribute allow-list middleware to prevent accidental PII leakage — implemented in sprint 34.\n\n**Legal counsel (external, DLA Piper)**: Reviewed the SCCs and TIA documentation. Confirmed the transfer mechanism is adequate given the pseudonymized nature of the data and Mixpanel's SOC 2 certification. Recommended documenting the Schrems II analysis as a standalone artifact — completed.\n\n**Mixpanel (processor)**: Confirmed their technical capabilities for GDPR deletion requests (30-day SLA), IP discarding configuration, and SOC 2 Type II audit scope. Provided updated sub-processor list (reviewed, no concerns).\n\n**Data subjects**: Not directly consulted for this specific assessment. However, the analytics opt-out feature was informed by feedback from 12 enterprise customers during quarterly business reviews who requested granular control over analytics data collection.", responder: "dpo" },
        // S5: Risk Identification
        { questionId: "q5_1", sectionId: "s5", response: false, responder: "dpo" },
        { questionId: "q5_2", sectionId: "s5", response: false, responder: "dpo" },
        { questionId: "q5_3", sectionId: "s5", response: false, responder: "dpo" },
        { questionId: "q5_4", sectionId: "s5", response: true, responder: "dpo" },
        { questionId: "q5_5", sectionId: "s5", response: false, responder: "dpo" },
        { questionId: "q5_6", sectionId: "s5", response: "**Risk 1 — Re-identification through behavioral patterns**: Despite pseudonymization, unique behavioral patterns (e.g., a user who is the only person accessing a specific niche feature at unusual hours) could theoretically enable re-identification by an adversary with auxiliary knowledge. Likelihood: Remote. Severity: Significant.\n\n**Risk 2 — US government access to transferred data**: Under FISA 702, US authorities could compel Mixpanel to disclose data. Given that the data is pseudonymized behavioral events (not communications content), the intelligence value is minimal. Likelihood: Remote. Severity: Minimal.\n\n**Risk 3 — Mixpanel data breach**: A security breach at Mixpanel could expose pseudonymized behavioral data. Without the salt-to-org mapping (held only by CloudForge in the EU), re-identification would be extremely difficult. Likelihood: Possible. Severity: Minimal (due to pseudonymization).\n\n**Risk 4 — Scope creep / purpose limitation violation**: Risk that product teams begin using analytics data for purposes beyond product improvement, such as individual performance monitoring or pricing discrimination. Likelihood: Possible. Severity: Significant.\n\n**Risk 5 — Inadequate opt-out implementation**: Risk that the user opt-out mechanism fails silently, continuing to track users who have opted out. Likelihood: Remote. Severity: Significant.", responder: "dpo" },
        // S6: Mitigation Measures
        { questionId: "q6_1", sectionId: "s6", response: ["Encryption at rest", "Encryption in transit", "Pseudonymization", "Access controls / RBAC", "Audit logging", "Anonymization / aggregation"], responder: "dpo" },
        { questionId: "q6_2", sectionId: "s6", response: ["Staff training / awareness", "Data processing agreements (DPAs)", "Privacy policies & procedures", "Regular audits / reviews", "Vendor management program", "Privacy by design process"], responder: "dpo" },
        { questionId: "q6_3", sectionId: "s6", response: "**Transparency**: CloudForge's privacy policy (updated August 2025) explicitly describes the use of Mixpanel for product analytics, the pseudonymization approach, the EU-to-US transfer, and the legal basis (legitimate interests). The privacy policy is linked from the application footer and the workspace settings page.\n\n**Opt-out mechanism**: Users can disable analytics tracking via Settings > Privacy > Analytics Preferences. This sets a `do_not_track` flag that is checked by the client-side SDK before sending any events. Workspace admins can also disable analytics org-wide.\n\n**Data portability**: Users can request an export of their analytics events (mapped back from pseudonymized IDs) via the DSAR process. The export includes all event types, timestamps, and properties in JSON format.\n\n**Erasure**: The GDPR deletion workflow triggers Mixpanel's deletion API to purge all events associated with the user's pseudonymized ID. Deletion is confirmed within 30 days per Mixpanel's SLA.\n\n**Right to object**: Users can object to analytics processing at any time via the opt-out mechanism or by contacting privacy@cloudforgelabs.eu. Objections are processed within 48 hours.", responder: "dpo" },
        // S7: Residual Risk & Conclusion
        { questionId: "q7_1", sectionId: "s7", response: "Medium", responder: "dpo" },
        { questionId: "q7_2", sectionId: "s7", response: "No \u2014 residual risk has been sufficiently mitigated", responder: "dpo" },
        { questionId: "q7_3", sectionId: "s7", response: "**DPO Recommendation**: The processing may proceed subject to the following conditions:\n\n1. All six identified mitigations must reach at least IMPLEMENTED status before expanding analytics to any new data categories.\n2. The k-anonymity threshold (k=5) must be maintained and verified quarterly via automated testing.\n3. The Mixpanel DPA and SCCs must be reviewed upon renewal (December 2026) or earlier if Mixpanel's sub-processor list changes materially.\n4. An annual review of this DPIA is required, with the next review scheduled for September 2026.\n5. If Mixpanel achieves EU-US Data Privacy Framework certification, the transfer mechanism section should be updated to reflect the additional safeguard.\n6. The opt-out adoption rate should be monitored; if it exceeds 15%, this may indicate that users find the processing unexpected and the legitimate interest balance should be reassessed.\n\n**Conclusion**: The residual risk is MEDIUM, which is acceptable given the robust pseudonymization, data minimization, and transparency measures in place. Prior consultation with the supervisory authority under Article 36 is not required.", responder: "dpo" },
      ],
      mitigations: [
        { id: "saas-assess-dpia-m1", riskId: "dpia-risk-1", title: "Pseudonymization of user identifiers", description: "SHA-256 hashing of user IDs with per-organization salt before Mixpanel ingestion, preventing direct identification by the processor.", status: "VERIFIED", priority: 1, owner: "member2", completedAt: "2025-08-20", evidence: "Security team code review (PR #847), penetration test report confirming no PII in Mixpanel payloads.", dueDate: "2025-08-15" },
        { id: "saas-assess-dpia-m2", riskId: "dpia-risk-1", title: "k-Anonymity enforcement (k=5)", description: "Enforce minimum group size of 5 in all Mixpanel reports and API exports to prevent singling out individuals through behavioral patterns.", status: "IMPLEMENTED", priority: 2, owner: "member2", completedAt: "2025-09-01", evidence: "Mixpanel project settings configured; verified via test queries.", dueDate: "2025-09-01" },
        { id: "saas-assess-dpia-m3", riskId: "dpia-risk-2", title: "Transfer Impact Assessment for EU-US transfer", description: "Comprehensive TIA evaluating US surveillance law risks for pseudonymized behavioral data transferred to Mixpanel under SCCs.", status: "VERIFIED", priority: 1, owner: "dpo", completedAt: "2025-06-30", evidence: "TIA document signed by DPO and external counsel (DLA Piper). Filed with compliance records.", dueDate: "2025-07-01" },
        { id: "saas-assess-dpia-m4", riskId: "dpia-risk-4", title: "Purpose limitation policy and access controls", description: "Written policy restricting analytics data use to product improvement only. RBAC in Mixpanel limits access to authorized product and engineering staff.", status: "IN_PROGRESS", priority: 2, owner: "dpo", dueDate: "2025-10-15" },
        { id: "saas-assess-dpia-m5", riskId: "dpia-risk-5", title: "Automated opt-out verification tests", description: "CI/CD pipeline integration tests verifying that the analytics opt-out flag correctly suppresses event transmission to Mixpanel.", status: "PLANNED", priority: 3, owner: "member1", dueDate: "2025-11-01" },
        { id: "saas-assess-dpia-m6", riskId: "dpia-risk-3", title: "Mixpanel breach notification procedure", description: "Documented procedure for responding to a Mixpanel security incident, including re-identification risk assessment and DPA notification timeline.", status: "IDENTIFIED", priority: 3, owner: "dpo", dueDate: "2025-12-01" },
      ],
      approvals: [
        { id: "saas-assess-dpia-a1", approver: "dpo", level: 1, status: "APPROVED", comments: "DPIA demonstrates thorough risk analysis and proportionate mitigations. Pseudonymization and k-anonymity measures effectively reduce re-identification risk. EU-US transfer adequately addressed via SCCs + TIA. Recommend proceeding with annual review cycle.", decidedAt: "2025-09-20" },
        { id: "saas-assess-dpia-a2", approver: "admin", level: 2, status: "APPROVED", comments: "Approved. Engineering team confirms all technical mitigations are feasible and aligned with the current architecture. Budget allocated for Mixpanel EU data residency evaluation in Q1 2026.", decidedAt: "2025-09-25" },
      ],
    },
  ],

  // ── Incidents ───────────────────────────────────────────────
  incidents: [
    // 1. CLOSED — Datadog Logging PII
    {
      id: "saas-incident-datadog-pii", publicId: "CF-INC-2025-001",
      title: "Datadog Logging PII in Error Traces", description: "Datadog APM error traces were found to contain unmasked user email addresses and workspace names in exception payloads. The PII was present in error context attached by the application's global error handler, which serialized the full user session object into Datadog spans.",
      type: "DATA_BREACH", severity: "MEDIUM", status: "CLOSED",
      discoveredAt: "2025-05-10T14:30:00Z", discoveredBy: "member2", discoveryMethod: "Internal audit of Datadog log queries",
      affectedRecords: 1200, affectedSubjects: ["Workspace users"], dataCategories: ["IDENTIFIERS"],
      containedAt: "2025-05-10T18:00:00Z", containmentActions: "Deployed hotfix to mask user session data in error handler. Purged affected Datadog logs via API.",
      rootCause: "Global error handler serialized the full user session object (including email and name) into Datadog error span metadata without field-level filtering.",
      rootCauseCategory: "Software defect",
      resolvedAt: "2025-05-15T12:00:00Z", resolutionNotes: "Hotfix deployed. Error handler now uses an allow-list of safe fields. Retroactive purge completed. No evidence of external access to the PII in Datadog.",
      lessonsLearned: "Implement automated PII scanning in CI/CD pipeline for log and trace payloads. Add Datadog sensitive data scanner rules.",
      notificationRequired: false,
      timeline: [
        { id: "saas-inc1-tl1", timestamp: "2025-05-10T14:30:00Z", title: "PII discovered in Datadog traces", description: "Engineer noticed email addresses appearing in Datadog error span metadata during routine log review.", entryType: "DISCOVERY", createdBy: "member2" },
        { id: "saas-inc1-tl2", timestamp: "2025-05-10T15:00:00Z", title: "Incident escalated to DPO", description: "Engineering lead escalated to DPO after confirming ~1,200 unique email addresses in 30 days of error traces.", entryType: "ESCALATION", createdBy: "admin" },
        { id: "saas-inc1-tl3", timestamp: "2025-05-10T18:00:00Z", title: "Hotfix deployed and logs purged", description: "Hotfix PR merged and deployed. Datadog API used to purge all affected log entries and error spans from the last 30 days.", entryType: "CONTAINMENT", createdBy: "member2" },
        { id: "saas-inc1-tl4", timestamp: "2025-05-15T12:00:00Z", title: "Incident resolved", description: "Post-mortem completed. Datadog sensitive data scanner rules configured. No DPA notification required per DPO assessment.", entryType: "RESOLUTION", createdBy: "dpo" },
      ],
      tasks: [
        { id: "saas-inc1-tk1", assignee: "member2", title: "Deploy error handler hotfix", priority: "URGENT", status: "COMPLETED", completedAt: "2025-05-10T17:30:00Z" },
        { id: "saas-inc1-tk2", assignee: "admin", title: "Configure Datadog sensitive data scanner", priority: "HIGH", status: "COMPLETED", completedAt: "2025-05-14T10:00:00Z" },
      ],
      affectedAssets: [
        { id: "saas-inc1-aa1", dataAssetId: "saas-asset-monitoring", impactLevel: "MEDIUM", compromised: false, notes: "PII was stored in Datadog but access was limited to internal engineering team." },
      ],
      notifications: [],
    },
    // 2. INVESTIGATING — Unauthorized API Key Access
    {
      id: "saas-incident-api-key", publicId: "CF-INC-2025-002",
      title: "Unauthorized API Key Access", description: "Security monitoring detected suspicious API requests using a valid API key belonging to a terminated employee's integration. The key was used to query the project management API from an unrecognized IP address, accessing workspace metadata and task listings.",
      type: "UNAUTHORIZED_ACCESS", severity: "HIGH", status: "INVESTIGATING",
      discoveredAt: "2025-12-01T22:15:00Z", discoveredBy: "admin", discoveryMethod: "Automated security alert from anomaly detection system",
      affectedRecords: 350, affectedSubjects: ["Workspace users", "Business contacts"], dataCategories: ["IDENTIFIERS", "OTHER"],
      containedAt: "2025-12-02T01:00:00Z", containmentActions: "API key revoked immediately. All active sessions for the associated service account terminated. IP address blocked at WAF level.",
      notificationRequired: true, notificationDeadline: "2025-12-04T22:15:00Z",
      timeline: [
        { id: "saas-inc2-tl1", timestamp: "2025-12-01T22:15:00Z", title: "Anomalous API access detected", description: "Security alert triggered: API key CF-KEY-0847 used from unrecognized IP 203.0.113.42 to query /api/v2/workspaces and /api/v2/tasks endpoints.", entryType: "DISCOVERY", createdBy: "admin" },
        { id: "saas-inc2-tl2", timestamp: "2025-12-02T01:00:00Z", title: "API key revoked and IP blocked", description: "Compromised API key revoked. Service account sessions terminated. Source IP blocked at Cloudflare WAF.", entryType: "CONTAINMENT", createdBy: "admin" },
        { id: "saas-inc2-tl3", timestamp: "2025-12-02T09:00:00Z", title: "Forensic investigation initiated", description: "Reviewing API access logs to determine full scope of data accessed. Cross-referencing with terminated employee offboarding checklist.", entryType: "INVESTIGATION", createdBy: "dpo" },
      ],
      tasks: [
        { id: "saas-inc2-tk1", assignee: "admin", title: "Complete API access log forensics", description: "Review all API calls made with the compromised key in the last 90 days.", priority: "URGENT", status: "IN_PROGRESS", dueDate: "2025-12-05" },
        { id: "saas-inc2-tk2", assignee: "dpo", title: "Assess DPA notification requirement", description: "Determine if the accessed data triggers the 72-hour notification obligation under GDPR Art. 33.", priority: "URGENT", status: "IN_PROGRESS", dueDate: "2025-12-03" },
      ],
      affectedAssets: [
        { id: "saas-inc2-aa1", dataAssetId: "saas-asset-project-platform", impactLevel: "HIGH", compromised: true, notes: "Task listings and workspace metadata accessed via API." },
        { id: "saas-inc2-aa2", dataAssetId: "saas-asset-auth", impactLevel: "MEDIUM", compromised: false, notes: "API key was issued by auth service; auth service itself not compromised." },
      ],
      notifications: [
        { id: "saas-inc2-n1", jurisdictionCode: "GDPR", recipientType: "DPA", recipientName: "Swedish Authority for Privacy Protection (IMY)", status: "PENDING", deadline: "2025-12-04T22:15:00Z", content: "Draft notification pending forensic investigation outcome." },
      ],
    },
    // 3. CONTAINED — Third-party Analytics SDK Vulnerability
    {
      id: "saas-incident-sdk-vuln", publicId: "CF-INC-2025-003",
      title: "Third-party Analytics SDK Vulnerability", description: "A critical vulnerability (CVE-2025-XXXX) was disclosed in the Mixpanel JavaScript SDK version used by CloudForge, potentially allowing cross-site scripting (XSS) attacks that could exfiltrate analytics event data including pseudonymized user IDs.",
      type: "VENDOR_INCIDENT", severity: "MEDIUM", status: "CONTAINED",
      discoveredAt: "2025-11-20T08:00:00Z", discoveredBy: "member2", discoveryMethod: "Vendor security advisory",
      affectedRecords: 0, affectedSubjects: ["Workspace users"], dataCategories: ["BEHAVIORAL", "IDENTIFIERS"],
      containedAt: "2025-11-20T14:00:00Z", containmentActions: "Upgraded Mixpanel SDK to patched version 2.48.1. Deployed emergency release to production. No evidence of exploitation found in security logs.",
      notificationRequired: false,
      timeline: [
        { id: "saas-inc3-tl1", timestamp: "2025-11-20T08:00:00Z", title: "Vendor security advisory received", description: "Mixpanel published security advisory for CVE-2025-XXXX affecting SDK versions < 2.48.1.", entryType: "DISCOVERY", createdBy: "member2" },
        { id: "saas-inc3-tl2", timestamp: "2025-11-20T10:00:00Z", title: "Impact assessment completed", description: "Confirmed CloudForge uses affected SDK version 2.47.3. Reviewed CSP headers — existing policy would have limited XSS impact but not fully prevented it.", entryType: "INVESTIGATION", createdBy: "member2" },
        { id: "saas-inc3-tl3", timestamp: "2025-11-20T14:00:00Z", title: "SDK upgraded and deployed", description: "Emergency release v2.18.3 deployed with Mixpanel SDK 2.48.1. CSP headers tightened.", entryType: "CONTAINMENT", createdBy: "admin" },
      ],
      tasks: [
        { id: "saas-inc3-tk1", assignee: "member2", title: "Upgrade Mixpanel SDK", priority: "URGENT", status: "COMPLETED", completedAt: "2025-11-20T13:00:00Z" },
        { id: "saas-inc3-tk2", assignee: "admin", title: "Review and tighten CSP headers", priority: "HIGH", status: "COMPLETED", completedAt: "2025-11-21T10:00:00Z" },
      ],
      affectedAssets: [
        { id: "saas-inc3-aa1", dataAssetId: "saas-asset-analytics", impactLevel: "MEDIUM", compromised: false, notes: "Vulnerability existed but no evidence of exploitation." },
        { id: "saas-inc3-aa2", dataAssetId: "saas-asset-project-platform", impactLevel: "LOW", compromised: false, notes: "SDK loaded in the SaaS application context." },
      ],
      notifications: [],
    },
    // 4. CLOSED — Employee Laptop Theft
    {
      id: "saas-incident-laptop", publicId: "CF-INC-2025-004",
      title: "Employee Laptop Theft", description: "A developer's laptop was stolen from a coworking space in Stockholm. The laptop had full-disk encryption (FileVault) enabled and the employee confirmed they were logged out of all CloudForge systems at the time. No customer data was stored locally.",
      type: "DATA_LOSS", severity: "LOW", status: "CLOSED",
      discoveredAt: "2025-09-05T19:00:00Z", discoveredBy: "member1", discoveryMethod: "Employee self-report",
      affectedRecords: 0, affectedSubjects: ["Employees"], dataCategories: ["IDENTIFIERS"],
      containedAt: "2025-09-05T20:00:00Z", containmentActions: "Remote wipe initiated via MDM (Jamf). All cloud service sessions revoked. Employee credentials rotated.",
      rootCause: "Physical theft of company equipment from unsecured coworking space.",
      rootCauseCategory: "Physical security",
      resolvedAt: "2025-09-08T10:00:00Z", resolutionNotes: "Remote wipe confirmed successful. No evidence of data access. Insurance claim filed. Coworking space security policy updated.",
      lessonsLearned: "Reinforce policy requiring screen lock and physical cable locks when working in public spaces. Evaluate MDM geo-fencing alerts.",
      notificationRequired: false,
      timeline: [
        { id: "saas-inc4-tl1", timestamp: "2025-09-05T19:00:00Z", title: "Laptop theft reported", description: "Developer reported laptop stolen from coworking space. Police report filed.", entryType: "DISCOVERY", createdBy: "member1" },
        { id: "saas-inc4-tl2", timestamp: "2025-09-05T20:00:00Z", title: "Remote wipe and credential rotation", description: "IT initiated Jamf remote wipe. All cloud credentials rotated. VPN certificate revoked.", entryType: "CONTAINMENT", createdBy: "admin" },
        { id: "saas-inc4-tl3", timestamp: "2025-09-06T09:00:00Z", title: "Risk assessment completed", description: "DPO confirmed: FileVault enabled, no local customer data, all sessions were logged out. Risk of data breach: negligible.", entryType: "INVESTIGATION", createdBy: "dpo" },
        { id: "saas-inc4-tl4", timestamp: "2025-09-08T10:00:00Z", title: "Incident closed", description: "Remote wipe confirmed. No DPA notification required. Policy update communicated to all staff.", entryType: "RESOLUTION", createdBy: "dpo" },
      ],
      tasks: [
        { id: "saas-inc4-tk1", assignee: "admin", title: "Initiate remote wipe and credential rotation", priority: "URGENT", status: "COMPLETED", completedAt: "2025-09-05T20:00:00Z" },
        { id: "saas-inc4-tk2", assignee: "dpo", title: "Complete risk assessment and DPA notification decision", priority: "HIGH", status: "COMPLETED", completedAt: "2025-09-06T09:00:00Z" },
      ],
      affectedAssets: [
        { id: "saas-inc4-aa1", dataAssetId: "saas-asset-hr-system", impactLevel: "LOW", compromised: false, notes: "Employee's own HR data potentially on device, but FileVault encryption prevents access." },
      ],
      notifications: [],
    },
  ],

  // ── Audit Logs ──────────────────────────────────────────────
  auditLogs: [
    { id: "saas-audit-01", user: "owner", entityType: "Organization", entityId: "saas-organization", action: "CREATE", changes: { name: "CloudForge Labs", slug: "demo-saas" }, createdAt: "2025-01-10T10:00:00Z" },
    { id: "saas-audit-02", user: "owner", entityType: "User", entityId: "saas-user-dpo", action: "CREATE", changes: { role: "PRIVACY_OFFICER", email: "katrine.holm@cloudforgelabs.eu" }, createdAt: "2025-01-12T09:00:00Z" },
    { id: "saas-audit-03", user: "dpo", entityType: "DataAsset", entityId: "saas-asset-user-db", action: "CREATE", changes: { name: "User Database", type: "DATABASE" }, createdAt: "2025-02-01T11:00:00Z" },
    { id: "saas-audit-04", user: "dpo", entityType: "DataAsset", entityId: "saas-asset-analytics", action: "CREATE", changes: { name: "Product Analytics Platform", type: "CLOUD_SERVICE" }, createdAt: "2025-02-01T11:30:00Z" },
    { id: "saas-audit-05", user: "dpo", entityType: "ProcessingActivity", entityId: "saas-pa-product-analytics", action: "CREATE", changes: { name: "Product Analytics & Feature Optimization", legalBasis: "LEGITIMATE_INTERESTS" }, createdAt: "2025-02-15T14:00:00Z" },
    { id: "saas-audit-06", user: "admin", entityType: "Vendor", entityId: "saas-vendor-aws", action: "CREATE", changes: { name: "Amazon Web Services (AWS)", status: "ACTIVE" }, createdAt: "2025-03-01T10:00:00Z" },
    { id: "saas-audit-07", user: "admin", entityType: "Vendor", entityId: "saas-vendor-mixpanel", action: "CREATE", changes: { name: "Mixpanel", status: "PROSPECTIVE" }, createdAt: "2025-03-01T10:30:00Z" },
    { id: "saas-audit-08", user: "dpo", entityType: "Vendor", entityId: "saas-vendor-mixpanel", action: "UPDATE", changes: { status: { from: "PROSPECTIVE", to: "UNDER_REVIEW" } }, createdAt: "2025-04-15T09:00:00Z" },
    { id: "saas-audit-09", user: "dpo", entityType: "DataTransfer", entityId: "saas-transfer-1", action: "CREATE", changes: { name: "EU to US: Mixpanel Analytics", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" }, createdAt: "2025-05-01T13:00:00Z" },
    { id: "saas-audit-10", user: "dpo", entityType: "Incident", entityId: "saas-incident-datadog-pii", action: "CREATE", changes: { title: "Datadog Logging PII in Error Traces", severity: "MEDIUM" }, createdAt: "2025-05-10T15:00:00Z" },
    { id: "saas-audit-11", user: "dpo", entityType: "Incident", entityId: "saas-incident-datadog-pii", action: "UPDATE", changes: { status: { from: "INVESTIGATING", to: "CLOSED" } }, createdAt: "2025-05-15T12:00:00Z" },
    { id: "saas-audit-12", user: "dpo", entityType: "Assessment", entityId: "saas-assess-lia-analytics", action: "CREATE", changes: { name: "LIA: Product Analytics & Feature Optimization", templateType: "lia" }, createdAt: "2025-07-01T09:00:00Z" },
    { id: "saas-audit-13", user: "dpo", entityType: "Assessment", entityId: "saas-assess-lia-analytics", action: "UPDATE", changes: { status: { from: "IN_PROGRESS", to: "APPROVED" } }, createdAt: "2025-07-25T10:00:00Z" },
    { id: "saas-audit-14", user: "dpo", entityType: "Assessment", entityId: "saas-assess-dpia-analytics", action: "CREATE", changes: { name: "DPIA: Product Analytics Platform (Mixpanel)", templateType: "dpia" }, createdAt: "2025-08-01T09:00:00Z" },
    { id: "saas-audit-15", user: "dpo", entityType: "Assessment", entityId: "saas-assess-dpia-analytics", action: "UPDATE", changes: { status: { from: "IN_PROGRESS", to: "APPROVED" }, riskScore: 45 }, createdAt: "2025-09-25T10:00:00Z" },
    { id: "saas-audit-16", user: "dpo", entityType: "Incident", entityId: "saas-incident-laptop", action: "CREATE", changes: { title: "Employee Laptop Theft", severity: "LOW" }, createdAt: "2025-09-05T19:30:00Z" },
    { id: "saas-audit-17", user: "dpo", entityType: "Assessment", entityId: "saas-assess-sso-review", action: "CREATE", changes: { name: "Enterprise SSO Privacy Review", templateType: "custom" }, createdAt: "2025-10-15T10:00:00Z" },
    { id: "saas-audit-18", user: "dpo", entityType: "Incident", entityId: "saas-incident-sdk-vuln", action: "CREATE", changes: { title: "Third-party Analytics SDK Vulnerability", severity: "MEDIUM" }, createdAt: "2025-11-20T08:30:00Z" },
    { id: "saas-audit-19", user: "admin", entityType: "Incident", entityId: "saas-incident-api-key", action: "CREATE", changes: { title: "Unauthorized API Key Access", severity: "HIGH" }, createdAt: "2025-12-01T22:30:00Z" },
    { id: "saas-audit-20", user: "dpo", entityType: "Assessment", entityId: "saas-assess-lia-security", action: "CREATE", changes: { name: "LIA: Security & Infrastructure Monitoring", templateType: "lia" }, createdAt: "2025-11-01T09:00:00Z" },
  ],
};
