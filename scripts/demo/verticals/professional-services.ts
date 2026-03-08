// scripts/demo/verticals/professional-services.ts
// Vertical demo scenario: Alder & Stone Consulting — EU consulting/legal firm (120 staff, 500 clients)

import type { VerticalScenario } from "../types";

export const scenario: VerticalScenario = {
  key: "proserv",
  orgName: "Alder & Stone Consulting",
  orgSlug: "demo-proserv",
  domain: "alderstone.eu",
  jurisdictionCodes: ["GDPR"],

  // ── Users ──────────────────────────────────────────────────
  users: [
    {
      id: "proserv-user-owner",
      ref: "owner",
      name: "Demo User",
      email: "demo-proserv@privacysuite.example",
      role: "OWNER",
    },
    {
      id: "proserv-user-dpo",
      ref: "dpo",
      name: "Elise M\u00fcller",
      email: "elise.muller@alderstone.eu",
      role: "PRIVACY_OFFICER",
    },
    {
      id: "proserv-user-admin",
      ref: "admin",
      name: "Henrik Larsen",
      email: "henrik.larsen@alderstone.eu",
      role: "ADMIN",
    },
    {
      id: "proserv-user-member1",
      ref: "member1",
      name: "Giulia Romano",
      email: "giulia.romano@alderstone.eu",
      role: "MEMBER",
    },
    {
      id: "proserv-user-member2",
      ref: "member2",
      name: "Patrick O'Brien",
      email: "patrick.obrien@alderstone.eu",
      role: "MEMBER",
    },
  ],

  // ── Data Inventory: Assets ─────────────────────────────────
  assets: [
    {
      id: "proserv-asset-client-db",
      name: "Client Management Database",
      description:
        "Central database storing client records, engagement history, billing contacts, and relationship management data for 500+ active clients.",
      type: "DATABASE",
      owner: "Henrik Larsen",
      location: "EU (Frankfurt)",
      hostingType: "Cloud — Azure EU",
      vendor: "Microsoft",
      isProduction: true,
    },
    {
      id: "proserv-asset-document-mgmt",
      name: "Document Management System",
      description:
        "Secure repository for confidential client documents including contracts, legal opinions, M&A due diligence files, and NDA-protected materials.",
      type: "APPLICATION",
      owner: "Henrik Larsen",
      location: "EU (Amsterdam)",
      hostingType: "Cloud — Azure EU",
      vendor: "Microsoft",
      isProduction: true,
    },
    {
      id: "proserv-asset-ai-review",
      name: "AI Document Review Platform",
      description:
        "LLM-powered document analysis platform for automated contract review, PII extraction, redaction assistance, and due diligence acceleration. Processes confidential client materials.",
      type: "CLOUD_SERVICE",
      owner: "Giulia Romano",
      location: "EU (Frankfurt) + US (processing)",
      hostingType: "Cloud — SaaS",
      vendor: "Luminance",
      isProduction: true,
    },
    {
      id: "proserv-asset-crm",
      name: "CRM (Salesforce)",
      description:
        "Salesforce instance managing business development pipeline, client relationships, engagement proposals, and partner referral tracking.",
      type: "CLOUD_SERVICE",
      owner: "Patrick O'Brien",
      location: "EU (Frankfurt)",
      hostingType: "Cloud — Salesforce EU",
      vendor: "Salesforce",
      isProduction: true,
    },
    {
      id: "proserv-asset-project-mgmt",
      name: "Project Management (Monday.com)",
      description:
        "Engagement tracking including project timelines, resource allocation, timesheets, deliverables, and client milestone reporting.",
      type: "CLOUD_SERVICE",
      owner: "Giulia Romano",
      location: "EU (Frankfurt)",
      hostingType: "Cloud — SaaS",
      vendor: "Monday.com",
      isProduction: true,
    },
    {
      id: "proserv-asset-hr-system",
      name: "HR System (Personio)",
      description:
        "Employee records management including contracts, compensation, performance reviews, leave management, and recruitment pipeline for 120 staff.",
      type: "CLOUD_SERVICE",
      owner: "Henrik Larsen",
      location: "EU (Munich)",
      hostingType: "Cloud — SaaS",
      vendor: "Personio",
      isProduction: true,
    },
    {
      id: "proserv-asset-accounting",
      name: "Accounting System (Xero)",
      description:
        "Financial management including client invoicing, expense tracking, accounts receivable/payable, and regulatory financial reporting.",
      type: "CLOUD_SERVICE",
      owner: "Henrik Larsen",
      location: "EU (London)",
      hostingType: "Cloud — SaaS",
      vendor: "Xero",
      isProduction: true,
    },
    {
      id: "proserv-asset-esignature",
      name: "Electronic Signatures (DocuSign)",
      description:
        "Electronic signature platform for engagement letters, NDAs, client contracts, and internal approval workflows.",
      type: "CLOUD_SERVICE",
      owner: "Patrick O'Brien",
      location: "EU (Frankfurt) + US",
      hostingType: "Cloud — SaaS",
      vendor: "DocuSign",
      isProduction: true,
    },
    {
      id: "proserv-asset-collaboration",
      name: "Collaboration Suite (Atlassian)",
      description:
        "Confluence for knowledge management and internal documentation; Jira for internal task tracking and IT service management.",
      type: "CLOUD_SERVICE",
      owner: "Giulia Romano",
      location: "EU (Frankfurt)",
      hostingType: "Cloud — SaaS",
      vendor: "Atlassian",
      isProduction: true,
    },
    {
      id: "proserv-asset-video-conf",
      name: "Video Conferencing (Zoom)",
      description:
        "Client meeting platform with recording capabilities, used for advisory sessions, depositions, and internal team collaboration.",
      type: "CLOUD_SERVICE",
      owner: "Patrick O'Brien",
      location: "EU (Amsterdam) + US",
      hostingType: "Cloud — SaaS",
      vendor: "Zoom",
      isProduction: true,
    },
  ],

  // ── Data Inventory: Elements ───────────────────────────────
  elements: [
    // Client DB elements
    {
      id: "proserv-elem-client-db-names",
      dataAssetId: "proserv-asset-client-db",
      name: "Client Contact Names",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 2555, // ~7 years
      legalBasis: "Contract performance",
    },
    {
      id: "proserv-elem-client-db-emails",
      dataAssetId: "proserv-asset-client-db",
      name: "Client Email Addresses",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 2555,
      legalBasis: "Contract performance",
    },
    {
      id: "proserv-elem-client-db-engagement",
      dataAssetId: "proserv-asset-client-db",
      name: "Engagement History & Billing Records",
      category: "FINANCIAL",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 3650, // 10 years — legal retention
      legalBasis: "Legal obligation (tax/audit)",
    },
    // Document Management elements
    {
      id: "proserv-elem-document-mgmt-contracts",
      dataAssetId: "proserv-asset-document-mgmt",
      name: "Client Contracts & Engagement Letters",
      category: "IDENTIFIERS",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 3650,
      legalBasis: "Contract performance",
    },
    {
      id: "proserv-elem-document-mgmt-legal-opinions",
      dataAssetId: "proserv-asset-document-mgmt",
      name: "Legal Opinions & Advisory Notes",
      category: "OTHER",
      sensitivity: "RESTRICTED",
      isPersonalData: false,
      retentionDays: 3650,
      legalBasis: "Legitimate interests (professional records)",
    },
    {
      id: "proserv-elem-document-mgmt-ma-files",
      dataAssetId: "proserv-asset-document-mgmt",
      name: "M&A Due Diligence Files",
      category: "FINANCIAL",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 2555,
      legalBasis: "Legitimate interests",
    },
    {
      id: "proserv-elem-document-mgmt-nda",
      dataAssetId: "proserv-asset-document-mgmt",
      name: "NDA-Protected Confidential Materials",
      category: "OTHER",
      sensitivity: "RESTRICTED",
      isPersonalData: false,
      retentionDays: 3650,
      legalBasis: "Contract performance",
    },
    {
      id: "proserv-elem-document-mgmt-financial",
      dataAssetId: "proserv-asset-document-mgmt",
      name: "Client Financial Statements",
      category: "FINANCIAL",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 2555,
      legalBasis: "Legitimate interests",
    },
    // AI Review Platform elements
    {
      id: "proserv-elem-ai-review-embeddings",
      dataAssetId: "proserv-asset-ai-review",
      name: "Document Embeddings & Vector Store",
      category: "OTHER",
      sensitivity: "RESTRICTED",
      isPersonalData: false,
      retentionDays: 365,
      legalBasis: "Legitimate interests",
    },
    {
      id: "proserv-elem-ai-review-extracted-pii",
      dataAssetId: "proserv-asset-ai-review",
      name: "Extracted PII from Documents",
      category: "IDENTIFIERS",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 90,
      legalBasis: "Legitimate interests",
    },
    {
      id: "proserv-elem-ai-review-training",
      dataAssetId: "proserv-asset-ai-review",
      name: "Model Training / Fine-Tuning Data",
      category: "OTHER",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      isSpecialCategory: false,
      retentionDays: 180,
      legalBasis: "Legitimate interests (opt-out available)",
    },
    {
      id: "proserv-elem-ai-review-audit-log",
      dataAssetId: "proserv-asset-ai-review",
      name: "AI Processing Audit Trail",
      category: "BEHAVIORAL",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 730,
      legalBasis: "Legitimate interests",
    },
    // CRM elements
    {
      id: "proserv-elem-crm-contacts",
      dataAssetId: "proserv-asset-crm",
      name: "Business Development Contacts",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 1825,
      legalBasis: "Legitimate interests",
    },
    {
      id: "proserv-elem-crm-pipeline",
      dataAssetId: "proserv-asset-crm",
      name: "Sales Pipeline & Opportunity Data",
      category: "FINANCIAL",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: false,
      retentionDays: 1825,
      legalBasis: "Legitimate interests",
    },
    // Project Management elements
    {
      id: "proserv-elem-project-mgmt-timesheets",
      dataAssetId: "proserv-asset-project-mgmt",
      name: "Employee Timesheets & Utilization",
      category: "EMPLOYMENT",
      sensitivity: "INTERNAL",
      isPersonalData: true,
      retentionDays: 2555,
      legalBasis: "Contract performance",
    },
    {
      id: "proserv-elem-project-mgmt-deliverables",
      dataAssetId: "proserv-asset-project-mgmt",
      name: "Project Milestones & Deliverables",
      category: "OTHER",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: false,
      retentionDays: 1825,
      legalBasis: "Legitimate interests",
    },
    // HR System elements
    {
      id: "proserv-elem-hr-system-employee-records",
      dataAssetId: "proserv-asset-hr-system",
      name: "Employee Personal Records",
      category: "EMPLOYMENT",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 3650,
      legalBasis: "Contract performance / legal obligation",
    },
    {
      id: "proserv-elem-hr-system-compensation",
      dataAssetId: "proserv-asset-hr-system",
      name: "Compensation & Benefits Data",
      category: "FINANCIAL",
      sensitivity: "RESTRICTED",
      isPersonalData: true,
      retentionDays: 3650,
      legalBasis: "Contract performance / legal obligation",
    },
    {
      id: "proserv-elem-hr-system-performance",
      dataAssetId: "proserv-asset-hr-system",
      name: "Performance Reviews & Objectives",
      category: "EMPLOYMENT",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 1825,
      legalBasis: "Legitimate interests",
    },
    // Accounting elements
    {
      id: "proserv-elem-accounting-invoices",
      dataAssetId: "proserv-asset-accounting",
      name: "Client Invoices & Payment Records",
      category: "FINANCIAL",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 3650,
      legalBasis: "Legal obligation (tax/audit)",
    },
    // eSignature elements
    {
      id: "proserv-elem-esignature-signatures",
      dataAssetId: "proserv-asset-esignature",
      name: "Digital Signatures & Signing Metadata",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 3650,
      legalBasis: "Contract performance",
    },
    // Collaboration elements
    {
      id: "proserv-elem-collaboration-wiki",
      dataAssetId: "proserv-asset-collaboration",
      name: "Internal Knowledge Base Articles",
      category: "OTHER",
      sensitivity: "INTERNAL",
      isPersonalData: false,
      retentionDays: 1825,
      legalBasis: "Legitimate interests",
    },
    {
      id: "proserv-elem-collaboration-tasks",
      dataAssetId: "proserv-asset-collaboration",
      name: "Internal Task & Issue Tracking",
      category: "EMPLOYMENT",
      sensitivity: "INTERNAL",
      isPersonalData: true,
      retentionDays: 1095,
      legalBasis: "Legitimate interests",
    },
    // Video Conferencing elements
    {
      id: "proserv-elem-video-conf-recordings",
      dataAssetId: "proserv-asset-video-conf",
      name: "Meeting Recordings & Transcripts",
      category: "IDENTIFIERS",
      sensitivity: "CONFIDENTIAL",
      isPersonalData: true,
      retentionDays: 365,
      legalBasis: "Consent / legitimate interests",
    },
    {
      id: "proserv-elem-video-conf-metadata",
      dataAssetId: "proserv-asset-video-conf",
      name: "Meeting Participant Metadata",
      category: "BEHAVIORAL",
      sensitivity: "INTERNAL",
      isPersonalData: true,
      retentionDays: 365,
      legalBasis: "Legitimate interests",
    },
  ],

  // ── Data Inventory: Processing Activities ──────────────────
  activities: [
    {
      id: "proserv-pa-client-engagement",
      name: "Client Engagement Management",
      description:
        "Processing client personal data to manage consulting and legal advisory engagements, including onboarding, matter tracking, deliverable management, and billing.",
      purpose:
        "Deliver consulting and legal advisory services under client engagement agreements",
      legalBasis: "CONTRACT",
      legalBasisDetail:
        "Processing necessary for the performance of consulting/advisory service contracts with clients (Art. 6(1)(b))",
      dataSubjects: ["Clients", "Client employees", "Authorized representatives"],
      categories: ["IDENTIFIERS", "FINANCIAL", "OTHER"],
      recipients: [
        "Engagement team members",
        "Billing department",
        "Document management system",
      ],
      retentionPeriod: "7 years after engagement closure",
      retentionDays: 2555,
      isActive: true,
      lastReviewedAt: "2025-11-15",
      nextReviewAt: "2026-11-15",
      assetIds: [
        "proserv-asset-client-db",
        "proserv-asset-document-mgmt",
        "proserv-asset-accounting",
      ],
    },
    {
      id: "proserv-pa-ai-document-review",
      name: "AI-Powered Document Review",
      description:
        "Automated analysis of client documents using LLM technology for contract review, PII extraction, redaction assistance, and due diligence acceleration. Processes confidential and NDA-protected materials containing personal data of clients and third parties.",
      purpose:
        "Accelerate document review and due diligence through AI-powered analysis while maintaining accuracy and consistency",
      legalBasis: "LEGITIMATE_INTERESTS",
      legalBasisDetail:
        "Legitimate interest in efficient document analysis balanced against data subject rights. LIA completed. Opt-out mechanism available for model training data.",
      dataSubjects: [
        "Clients",
        "Third parties named in documents",
        "Counterparties",
        "Employees of target companies (M&A)",
      ],
      categories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT", "OTHER"],
      recipients: [
        "AI platform provider (processor)",
        "Engagement team members",
        "Quality assurance reviewers",
      ],
      retentionPeriod:
        "Extracted PII: 90 days; Embeddings: 1 year; Training data: 6 months (opt-out available)",
      retentionDays: 365,
      automatedDecisionMaking: true,
      automatedDecisionDetail:
        "Automated PII detection and classification, automated contract clause extraction, AI-assisted risk scoring of document content. Human oversight required for all final decisions.",
      isActive: true,
      lastReviewedAt: "2026-01-20",
      nextReviewAt: "2026-07-20",
      assetIds: [
        "proserv-asset-ai-review",
        "proserv-asset-document-mgmt",
      ],
    },
    {
      id: "proserv-pa-business-development",
      name: "Business Development & CRM",
      description:
        "Managing prospective and existing client relationships, tracking business development opportunities, event invitations, and referral partner programs.",
      purpose:
        "Grow and maintain the firm's client base through targeted business development activities",
      legalBasis: "LEGITIMATE_INTERESTS",
      legalBasisDetail:
        "Legitimate interest in developing business relationships and growing the practice. Opt-out available for marketing communications.",
      dataSubjects: [
        "Prospective clients",
        "Existing clients",
        "Referral partners",
        "Event attendees",
      ],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: [
        "Business development team",
        "Partners and practice leads",
        "Marketing communications platform",
      ],
      retentionPeriod: "5 years from last interaction",
      retentionDays: 1825,
      isActive: true,
      lastReviewedAt: "2025-09-10",
      nextReviewAt: "2026-09-10",
      assetIds: ["proserv-asset-crm"],
    },
    {
      id: "proserv-pa-employment",
      name: "Employment Records",
      description:
        "Processing employee data for HR administration, payroll, performance management, professional development, and compliance with employment law obligations.",
      purpose:
        "Manage employment relationships and comply with statutory employment obligations",
      legalBasis: "CONTRACT",
      legalBasisDetail:
        "Processing necessary for the performance of employment contracts (Art. 6(1)(b)) and compliance with employment law obligations (Art. 6(1)(c))",
      dataSubjects: ["Employees", "Contractors", "Job applicants"],
      categories: ["IDENTIFIERS", "EMPLOYMENT", "FINANCIAL", "DEMOGRAPHICS"],
      recipients: [
        "HR department",
        "Line managers",
        "Payroll provider",
        "Tax authorities",
      ],
      retentionPeriod: "10 years after employment ends (statutory)",
      retentionDays: 3650,
      isActive: true,
      lastReviewedAt: "2025-10-01",
      nextReviewAt: "2026-10-01",
      assetIds: [
        "proserv-asset-hr-system",
        "proserv-asset-project-mgmt",
      ],
    },
    {
      id: "proserv-pa-financial-mgmt",
      name: "Financial Management & Billing",
      description:
        "Client invoicing, time tracking, expense management, accounts receivable, and statutory financial reporting.",
      purpose:
        "Financial administration, tax compliance, and statutory reporting obligations",
      legalBasis: "LEGAL_OBLIGATION",
      legalBasisDetail:
        "Legal obligation to maintain financial records for tax and audit purposes (Art. 6(1)(c)) and contract performance for billing (Art. 6(1)(b))",
      dataSubjects: [
        "Clients",
        "Employees",
        "Vendors/suppliers",
      ],
      categories: ["IDENTIFIERS", "FINANCIAL"],
      recipients: [
        "Finance team",
        "External auditors",
        "Tax authorities",
        "Banking institutions",
      ],
      retentionPeriod: "10 years (statutory requirement)",
      retentionDays: 3650,
      isActive: true,
      lastReviewedAt: "2025-12-01",
      nextReviewAt: "2026-12-01",
      assetIds: [
        "proserv-asset-accounting",
        "proserv-asset-project-mgmt",
      ],
    },
    {
      id: "proserv-pa-knowledge-mgmt",
      name: "Knowledge Management & Collaboration",
      description:
        "Internal knowledge sharing, case study development (anonymized), methodology documentation, and team collaboration.",
      purpose:
        "Maintain institutional knowledge and enable effective internal collaboration",
      legalBasis: "LEGITIMATE_INTERESTS",
      legalBasisDetail:
        "Legitimate interest in preserving institutional knowledge and enabling collaboration. Client data anonymized before inclusion in knowledge base.",
      dataSubjects: ["Employees", "Contractors"],
      categories: ["EMPLOYMENT", "OTHER"],
      recipients: [
        "All staff members",
        "Knowledge management team",
      ],
      retentionPeriod: "5 years, reviewed annually",
      retentionDays: 1825,
      isActive: true,
      lastReviewedAt: "2025-08-15",
      nextReviewAt: "2026-08-15",
      assetIds: [
        "proserv-asset-collaboration",
        "proserv-asset-video-conf",
      ],
    },
    {
      id: "proserv-pa-client-comms",
      name: "Client Communications",
      description:
        "Managing client communications including email, video meetings, document sharing, and electronic signatures for engagement execution.",
      purpose:
        "Facilitate effective communication with clients in the course of service delivery",
      legalBasis: "CONTRACT",
      legalBasisDetail:
        "Processing necessary for the performance of client service contracts (Art. 6(1)(b))",
      dataSubjects: ["Clients", "Client employees", "Counterparties"],
      categories: ["IDENTIFIERS", "OTHER"],
      recipients: [
        "Engagement team",
        "Video conferencing platform",
        "eSignature platform",
      ],
      retentionPeriod: "Duration of engagement + 3 years",
      retentionDays: 1095,
      isActive: true,
      lastReviewedAt: "2025-10-20",
      nextReviewAt: "2026-10-20",
      assetIds: [
        "proserv-asset-video-conf",
        "proserv-asset-esignature",
      ],
    },
  ],

  // ── Data Inventory: Flows ──────────────────────────────────
  flows: [
    {
      id: "proserv-flow-clientdb-ai",
      name: "Client DB to AI Review",
      description:
        "Client metadata and document references sent from Client DB to AI Document Review Platform for analysis context.",
      sourceAssetId: "proserv-asset-client-db",
      destinationAssetId: "proserv-asset-ai-review",
      dataCategories: ["IDENTIFIERS", "FINANCIAL"],
      frequency: "On-demand",
      volume: "~200 documents/month",
      encryptionMethod: "TLS 1.3 in transit, AES-256 at rest",
      isAutomated: true,
    },
    {
      id: "proserv-flow-docs-ai",
      name: "Document Mgmt to AI Review",
      description:
        "Confidential client documents transferred to AI platform for automated review and PII extraction.",
      sourceAssetId: "proserv-asset-document-mgmt",
      destinationAssetId: "proserv-asset-ai-review",
      dataCategories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
      frequency: "On-demand",
      volume: "~500 documents/month",
      encryptionMethod: "TLS 1.3 in transit, AES-256 at rest",
      isAutomated: true,
    },
    {
      id: "proserv-flow-docs-esign",
      name: "Document Mgmt to eSignature",
      description:
        "Final contracts and engagement letters sent to DocuSign for client signature collection.",
      sourceAssetId: "proserv-asset-document-mgmt",
      destinationAssetId: "proserv-asset-esignature",
      dataCategories: ["IDENTIFIERS"],
      frequency: "Daily",
      volume: "~50 envelopes/month",
      encryptionMethod: "TLS 1.3, DocuSign encryption",
      isAutomated: false,
    },
    {
      id: "proserv-flow-crm-accounting",
      name: "CRM to Accounting",
      description:
        "Won opportunity data synced from Salesforce to Xero for invoice generation and revenue tracking.",
      sourceAssetId: "proserv-asset-crm",
      destinationAssetId: "proserv-asset-accounting",
      dataCategories: ["IDENTIFIERS", "FINANCIAL"],
      frequency: "Daily sync",
      volume: "~30 records/month",
      encryptionMethod: "TLS 1.3, API-level encryption",
      isAutomated: true,
    },
    {
      id: "proserv-flow-hr-accounting",
      name: "HR System to Accounting",
      description:
        "Payroll data exported from Personio to Xero for salary processing and tax compliance.",
      sourceAssetId: "proserv-asset-hr-system",
      destinationAssetId: "proserv-asset-accounting",
      dataCategories: ["FINANCIAL", "EMPLOYMENT"],
      frequency: "Monthly",
      volume: "120 employee records",
      encryptionMethod: "TLS 1.3, SFTP encrypted",
      isAutomated: true,
    },
    {
      id: "proserv-flow-project-hr",
      name: "Project Mgmt to HR System",
      description:
        "Timesheet and utilization data synced from Monday.com to Personio for attendance and performance tracking.",
      sourceAssetId: "proserv-asset-project-mgmt",
      destinationAssetId: "proserv-asset-hr-system",
      dataCategories: ["EMPLOYMENT"],
      frequency: "Weekly",
      volume: "120 employee records",
      encryptionMethod: "TLS 1.3, API authentication",
      isAutomated: true,
    },
    {
      id: "proserv-flow-crm-clientdb",
      name: "CRM to Client Database",
      description:
        "New client records and contact updates synced from Salesforce to the central Client Management Database.",
      sourceAssetId: "proserv-asset-crm",
      destinationAssetId: "proserv-asset-client-db",
      dataCategories: ["IDENTIFIERS"],
      frequency: "Real-time",
      volume: "~100 records/month",
      encryptionMethod: "TLS 1.3, database-level encryption",
      isAutomated: true,
    },
    {
      id: "proserv-flow-video-docs",
      name: "Video Conferencing to Document Mgmt",
      description:
        "Meeting recordings and auto-generated transcripts saved to Document Management System for engagement records.",
      sourceAssetId: "proserv-asset-video-conf",
      destinationAssetId: "proserv-asset-document-mgmt",
      dataCategories: ["IDENTIFIERS", "OTHER"],
      frequency: "Per-meeting (opt-in)",
      volume: "~80 recordings/month",
      encryptionMethod: "TLS 1.3, AES-256 at rest",
      isAutomated: false,
    },
  ],

  // ── Data Inventory: Transfers ──────────────────────────────
  transfers: [
    {
      id: "proserv-transfer-crm-us",
      name: "Salesforce CRM — EU to US Transfer",
      description:
        "Client relationship data processed by Salesforce, which may involve data routing through US infrastructure for certain platform features. SCCs executed with supplementary measures.",
      destinationCountry: "US",
      destinationOrg: "Salesforce, Inc.",
      mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
      safeguards:
        "EU-US Data Privacy Framework, SCCs (2021 version), TLS encryption in transit, data residency set to EU where available, annual TIA review.",
      tiaCompleted: true,
      tiaDate: "2025-06-15",
      activityId: "proserv-pa-business-development",
    },
    {
      id: "proserv-transfer-esign-us",
      name: "DocuSign eSignature — EU to US Transfer",
      description:
        "Contract signing data processed by DocuSign with US-based infrastructure involvement. SCCs and supplementary measures in place.",
      destinationCountry: "US",
      destinationOrg: "DocuSign, Inc.",
      mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
      safeguards:
        "EU-US Data Privacy Framework, SCCs (2021 version), encryption at rest and in transit, DocuSign EU data residency option enabled where possible.",
      tiaCompleted: true,
      tiaDate: "2025-08-20",
      activityId: "proserv-pa-client-comms",
    },
  ],

  // ── Vendors ────────────────────────────────────────────────
  vendors: [
    {
      id: "proserv-vendor-microsoft",
      name: "Microsoft 365",
      description:
        "Enterprise productivity suite including SharePoint (document management), Exchange (email), Teams, and Azure cloud hosting.",
      website: "https://www.microsoft.com",
      status: "ACTIVE",
      riskTier: "LOW",
      riskScore: 18,
      primaryContact: "Enterprise Account Manager",
      contactEmail: "enterprise@microsoft.com",
      categories: ["Cloud Platform", "Productivity", "Document Management"],
      dataProcessed: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT", "OTHER"],
      countries: ["EU", "US"],
      certifications: ["ISO 27001", "SOC 2 Type II", "C5", "ENS High"],
      lastAssessedAt: "2025-09-01",
      nextReviewAt: "2026-09-01",
    },
    {
      id: "proserv-vendor-salesforce",
      name: "Salesforce",
      description:
        "CRM platform for managing client relationships, business development pipeline, and partner referral programs.",
      website: "https://www.salesforce.com",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      riskScore: 35,
      primaryContact: "Account Executive",
      contactEmail: "privacy@salesforce.com",
      categories: ["CRM", "Sales Automation"],
      dataProcessed: ["IDENTIFIERS", "BEHAVIORAL", "FINANCIAL"],
      countries: ["EU", "US"],
      certifications: ["ISO 27001", "SOC 2 Type II", "BSI C5"],
      lastAssessedAt: "2025-06-15",
      nextReviewAt: "2026-06-15",
    },
    {
      id: "proserv-vendor-monday",
      name: "Monday.com",
      description:
        "Project management platform for engagement tracking, timesheets, resource allocation, and deliverable management.",
      website: "https://monday.com",
      status: "ACTIVE",
      riskTier: "LOW",
      riskScore: 22,
      primaryContact: "Customer Success Manager",
      contactEmail: "privacy@monday.com",
      categories: ["Project Management", "Collaboration"],
      dataProcessed: ["IDENTIFIERS", "EMPLOYMENT"],
      countries: ["EU", "US"],
      certifications: ["ISO 27001", "SOC 2 Type II"],
      lastAssessedAt: "2025-07-20",
      nextReviewAt: "2026-07-20",
    },
    {
      id: "proserv-vendor-personio",
      name: "Personio",
      description:
        "HR management platform for employee records, payroll integration, recruiting, and performance management.",
      website: "https://www.personio.com",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      riskScore: 30,
      primaryContact: "Customer Success",
      contactEmail: "privacy@personio.de",
      categories: ["HR Management", "Payroll"],
      dataProcessed: ["IDENTIFIERS", "EMPLOYMENT", "FINANCIAL", "DEMOGRAPHICS"],
      countries: ["EU"],
      certifications: ["ISO 27001", "SOC 2 Type II"],
      lastAssessedAt: "2025-10-01",
      nextReviewAt: "2026-10-01",
    },
    {
      id: "proserv-vendor-xero",
      name: "Xero",
      description:
        "Cloud accounting platform for invoicing, expense management, accounts payable/receivable, and financial reporting.",
      website: "https://www.xero.com",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      riskScore: 28,
      primaryContact: "Partner Manager",
      contactEmail: "privacy@xero.com",
      categories: ["Accounting", "Financial Management"],
      dataProcessed: ["IDENTIFIERS", "FINANCIAL"],
      countries: ["EU", "UK"],
      certifications: ["ISO 27001", "SOC 2 Type II"],
      lastAssessedAt: "2025-08-10",
      nextReviewAt: "2026-08-10",
    },
    {
      id: "proserv-vendor-docusign",
      name: "DocuSign",
      description:
        "Electronic signature and agreement management platform for client contracts, engagement letters, and NDAs.",
      website: "https://www.docusign.com",
      status: "ACTIVE",
      riskTier: "MEDIUM",
      riskScore: 32,
      primaryContact: "Account Manager",
      contactEmail: "privacy@docusign.com",
      categories: ["eSignature", "Contract Management"],
      dataProcessed: ["IDENTIFIERS"],
      countries: ["EU", "US"],
      certifications: ["ISO 27001", "SOC 2 Type II", "eIDAS compliant"],
      lastAssessedAt: "2025-08-20",
      nextReviewAt: "2026-08-20",
    },
    {
      id: "proserv-vendor-atlassian",
      name: "Atlassian",
      description:
        "Collaboration platform including Confluence for knowledge management and Jira for internal task and IT service management.",
      website: "https://www.atlassian.com",
      status: "ACTIVE",
      riskTier: "LOW",
      riskScore: 20,
      primaryContact: "Enterprise Support",
      contactEmail: "privacy@atlassian.com",
      categories: ["Collaboration", "Knowledge Management", "ITSM"],
      dataProcessed: ["IDENTIFIERS", "EMPLOYMENT"],
      countries: ["EU", "US"],
      certifications: ["ISO 27001", "SOC 2 Type II", "FedRAMP"],
      lastAssessedAt: "2025-05-15",
      nextReviewAt: "2026-05-15",
    },
    {
      id: "proserv-vendor-zoom",
      name: "Zoom",
      description:
        "Video conferencing platform for client advisory sessions, internal meetings, and recorded depositions.",
      website: "https://zoom.us",
      status: "UNDER_REVIEW",
      riskTier: "MEDIUM",
      riskScore: 38,
      primaryContact: "Enterprise Account Manager",
      contactEmail: "privacy@zoom.us",
      categories: ["Video Conferencing", "Communications"],
      dataProcessed: ["IDENTIFIERS", "BEHAVIORAL"],
      countries: ["EU", "US"],
      certifications: ["ISO 27001", "SOC 2 Type II"],
      lastAssessedAt: "2025-04-01",
      nextReviewAt: "2026-04-01",
    },
  ],

  // ── Vendor Contracts ───────────────────────────────────────
  contracts: [
    {
      id: "proserv-contract-microsoft-dpa",
      vendorId: "proserv-vendor-microsoft",
      type: "DPA",
      status: "ACTIVE",
      name: "Microsoft Online Services DPA",
      description:
        "Data Processing Addendum covering Microsoft 365 services including SharePoint, Exchange, Teams, and Azure hosting.",
      startDate: "2024-01-15",
      endDate: "2027-01-14",
      autoRenewal: true,
      value: 48000,
      currency: "EUR",
    },
    {
      id: "proserv-contract-salesforce-msa",
      vendorId: "proserv-vendor-salesforce",
      type: "MSA",
      status: "ACTIVE",
      name: "Salesforce Enterprise License Agreement",
      description:
        "Master Service Agreement with DPA addendum for Salesforce CRM Enterprise Edition.",
      startDate: "2024-03-01",
      endDate: "2027-02-28",
      autoRenewal: true,
      value: 36000,
      currency: "EUR",
    },
    {
      id: "proserv-contract-personio-dpa",
      vendorId: "proserv-vendor-personio",
      type: "DPA",
      status: "ACTIVE",
      name: "Personio Data Processing Agreement",
      description:
        "DPA covering HR data processing including employee records, payroll, and recruitment data.",
      startDate: "2024-06-01",
      endDate: "2026-05-31",
      autoRenewal: true,
      value: 18000,
      currency: "EUR",
    },
    {
      id: "proserv-contract-docusign-dpa",
      vendorId: "proserv-vendor-docusign",
      type: "DPA",
      status: "ACTIVE",
      name: "DocuSign Data Processing Agreement",
      description:
        "DPA and SCCs for electronic signature services, covering cross-border data transfers to US infrastructure.",
      startDate: "2024-04-01",
      endDate: "2026-03-31",
      autoRenewal: false,
      value: 8400,
      currency: "EUR",
    },
    {
      id: "proserv-contract-zoom-msa",
      vendorId: "proserv-vendor-zoom",
      type: "MSA",
      status: "ACTIVE",
      name: "Zoom Enterprise License Agreement",
      description:
        "Enterprise license with DPA covering video conferencing, recording storage, and AI transcription features.",
      startDate: "2024-02-01",
      endDate: "2026-01-31",
      autoRenewal: true,
      value: 14400,
      currency: "EUR",
    },
  ],

  // ── DSAR Intake Form ───────────────────────────────────────
  intakeForm: {
    name: "Alder & Stone Privacy Request Form",
    slug: "privacy-request-proserv",
    title: "Privacy Request — Alder & Stone Consulting",
    description:
      "Submit a data subject access request to Alder & Stone Consulting. We will respond within 30 days in accordance with GDPR requirements. Please note that requests involving legally privileged materials may be subject to additional review.",
  },

  // ── DSARs ──────────────────────────────────────────────────
  dsars: [
    // 1. COMPLETED ACCESS — Former client requesting engagement records
    {
      id: "proserv-dsar-1",
      publicId: "DSAR-PS-2025-001",
      type: "ACCESS",
      status: "COMPLETED",
      requesterName: "Dr. Friedrich Weber",
      requesterEmail: "f.weber@webergruppe.de",
      relationship: "Client",
      description:
        "Former client requesting copies of all personal data held, including engagement records, correspondence, and billing history from the 2023-2024 advisory engagement.",
      receivedAt: "2025-09-10",
      acknowledgedAt: "2025-09-11",
      dueDate: "2025-10-10",
      completedAt: "2025-10-02",
      verificationMethod: "Email verification + client ID match",
      verifiedAt: "2025-09-12",
      responseMethod: "Encrypted email with secure download link",
      responseNotes:
        "Provided engagement records, billing history, and correspondence. Legal opinions excluded under professional privilege exemption (Art. 15(4) GDPR, national professional secrecy rules).",
      tasks: [
        {
          id: "proserv-dsar-1-task-1",
          dataAssetId: "proserv-asset-client-db",
          assignee: "member1",
          title: "Extract client records from Client DB",
          description: "Export all personal data for Dr. Weber from the Client Management Database.",
          status: "COMPLETED",
          completedAt: "2025-09-18",
          notes: "Exported 47 records including contact details and engagement history.",
        },
        {
          id: "proserv-dsar-1-task-2",
          dataAssetId: "proserv-asset-document-mgmt",
          assignee: "dpo",
          title: "Review documents for privilege assessment",
          description:
            "Review Document Management System for privileged materials that may be exempt from disclosure.",
          status: "COMPLETED",
          completedAt: "2025-09-25",
          notes:
            "12 legal opinions identified as privileged under Art. 15(4) — excluded from response with explanation. 34 documents cleared for disclosure.",
        },
        {
          id: "proserv-dsar-1-task-3",
          dataAssetId: "proserv-asset-accounting",
          assignee: "admin",
          title: "Extract billing records from Xero",
          description: "Export invoicing and payment history for Dr. Weber / Weber Gruppe.",
          status: "COMPLETED",
          completedAt: "2025-09-20",
          notes: "23 invoices exported, personal data fields included.",
        },
      ],
      communications: [
        {
          id: "proserv-dsar-1-comm-1",
          direction: "INBOUND",
          channel: "Email",
          subject: "Access Request — My Personal Data",
          content:
            "Dear Alder & Stone, under Article 15 GDPR I request access to all personal data you hold about me, including engagement files, emails, and billing records from our 2023-2024 advisory relationship.",
          sentAt: "2025-09-10",
        },
        {
          id: "proserv-dsar-1-comm-2",
          direction: "OUTBOUND",
          channel: "Email",
          subject: "RE: Access Request — Acknowledgement",
          content:
            "Dear Dr. Weber, we acknowledge your access request (ref: DSAR-PS-2025-001). We will respond within 30 days. We have verified your identity against our client records.",
          sentAt: "2025-09-11",
          sentBy: "dpo",
        },
        {
          id: "proserv-dsar-1-comm-3",
          direction: "OUTBOUND",
          channel: "Email",
          subject: "RE: Access Request — Response",
          content:
            "Dear Dr. Weber, please find your personal data via the enclosed secure download link (valid 7 days). Note: 12 documents containing legal opinions have been withheld under professional privilege (Art. 15(4) GDPR). A detailed explanation is included in the response package.",
          sentAt: "2025-10-02",
          sentBy: "dpo",
        },
      ],
    },
    // 2. IN_PROGRESS ERASURE — Ex-employee requesting file deletion
    {
      id: "proserv-dsar-2",
      publicId: "DSAR-PS-2025-002",
      type: "ERASURE",
      status: "IN_PROGRESS",
      requesterName: "Anna Svensson",
      requesterEmail: "anna.svensson@personal.se",
      relationship: "Employee",
      description:
        "Former employee (left firm October 2025) requesting deletion of all personal data, including HR records, performance reviews, and internal communications.",
      receivedAt: "2025-12-05",
      acknowledgedAt: "2025-12-06",
      dueDate: "2026-01-04",
      verificationMethod: "Former employee ID verification + HR record match",
      verifiedAt: "2025-12-08",
      responseNotes:
        "Partial deletion possible — statutory retention applies to payroll (10 years), tax records, and professional liability insurance records.",
      tasks: [
        {
          id: "proserv-dsar-2-task-1",
          dataAssetId: "proserv-asset-hr-system",
          assignee: "admin",
          title: "Identify erasable vs. retained HR records",
          description:
            "Categorize all HR records for Anna Svensson into erasable (performance reviews, internal notes) and legally retained (payroll, tax, pension).",
          status: "COMPLETED",
          completedAt: "2025-12-15",
          notes:
            "Performance reviews and internal notes flagged for deletion. Payroll and tax records retained under statutory obligation (10-year retention).",
        },
        {
          id: "proserv-dsar-2-task-2",
          dataAssetId: "proserv-asset-collaboration",
          assignee: "member1",
          title: "Anonymize Confluence contributions",
          description:
            "Remove personal identifiers from internal wiki contributions and reassign authored content to anonymized account.",
          status: "IN_PROGRESS",
          notes: "47 wiki pages identified. Anonymization in progress.",
        },
        {
          id: "proserv-dsar-2-task-3",
          dataAssetId: "proserv-asset-project-mgmt",
          assignee: "member2",
          title: "Remove from Monday.com project boards",
          description: "Delete personal references and timesheet data from active and archived project boards.",
          status: "PENDING",
        },
      ],
      communications: [
        {
          id: "proserv-dsar-2-comm-1",
          direction: "INBOUND",
          channel: "Email",
          subject: "Erasure Request — Former Employee",
          content:
            "I am a former employee of Alder & Stone (departed October 2025). Under Article 17 GDPR, I request deletion of all my personal data across your systems.",
          sentAt: "2025-12-05",
        },
        {
          id: "proserv-dsar-2-comm-2",
          direction: "OUTBOUND",
          channel: "Email",
          subject: "RE: Erasure Request — Acknowledgement & Retention Notice",
          content:
            "Dear Ms. Svensson, we acknowledge your erasure request. Please note that certain records (payroll, tax, pension) must be retained for statutory periods. We will delete all non-retained personal data and confirm once complete.",
          sentAt: "2025-12-06",
          sentBy: "dpo",
        },
      ],
    },
    // 3. IDENTITY_PENDING — Opposing counsel requesting client data (suspicious)
    {
      id: "proserv-dsar-3",
      publicId: "DSAR-PS-2025-003",
      type: "ACCESS",
      status: "IDENTITY_PENDING",
      requesterName: "James Whitfield",
      requesterEmail: "j.whitfield@protonmail.com",
      relationship: "Other",
      description:
        "Individual claiming to be a data subject named in one of our client matters, requesting all data held. Using anonymous email provider. Suspected opposing counsel attempt to obtain privileged client information through DSAR mechanism.",
      receivedAt: "2026-01-15",
      acknowledgedAt: "2026-01-16",
      dueDate: "2026-02-14",
      verificationMethod: "Enhanced ID verification requested — government-issued ID + proof of address",
      responseNotes:
        "Flagged as suspicious. Pattern matches known tactic by opposing counsel to use DSARs to obtain litigation-privileged materials. Enhanced verification requested; no data released pending identity confirmation.",
      tasks: [
        {
          id: "proserv-dsar-3-task-1",
          dataAssetId: "proserv-asset-client-db",
          assignee: "dpo",
          title: "Verify requester identity and data subject status",
          description:
            "Conduct enhanced identity verification. Cross-reference with active client matters to determine if this is a legitimate data subject or an attempt to circumvent privilege.",
          status: "IN_PROGRESS",
          notes:
            "Government ID requested but not yet received. Name does not match any known client contact. Monitoring for follow-up.",
        },
      ],
      communications: [
        {
          id: "proserv-dsar-3-comm-1",
          direction: "INBOUND",
          channel: "Email",
          subject: "Subject Access Request",
          content:
            "I believe Alder & Stone holds personal data about me in relation to a corporate transaction. I request access to all data under Article 15 GDPR.",
          sentAt: "2026-01-15",
        },
        {
          id: "proserv-dsar-3-comm-2",
          direction: "OUTBOUND",
          channel: "Email",
          subject: "RE: Subject Access Request — Identity Verification Required",
          content:
            "Dear Mr. Whitfield, before we can process your request, we require identity verification. Please provide a government-issued photo ID and proof of current address. This is required under Art. 12(6) GDPR where we have reasonable doubts about the identity of the requester.",
          sentAt: "2026-01-16",
          sentBy: "dpo",
        },
      ],
    },
    // 4. SUBMITTED ACCESS — Client requesting copies of all communications
    {
      id: "proserv-dsar-4",
      publicId: "DSAR-PS-2026-004",
      type: "ACCESS",
      status: "SUBMITTED",
      requesterName: "Maria Gonzalez",
      requesterEmail: "m.gonzalez@iberdyne.es",
      relationship: "Client",
      description:
        "Active client requesting copies of all communications, meeting notes, and internal assessments related to their ongoing advisory engagement for GDPR compliance program implementation.",
      receivedAt: "2026-02-20",
      dueDate: "2026-03-22",
      tasks: [
        {
          id: "proserv-dsar-4-task-1",
          dataAssetId: "proserv-asset-client-db",
          assignee: "member1",
          title: "Compile client communication records",
          description:
            "Extract all communications, meeting notes, and engagement records for Iberdyne S.A. from the Client DB.",
          status: "PENDING",
        },
        {
          id: "proserv-dsar-4-task-2",
          dataAssetId: "proserv-asset-video-conf",
          assignee: "member2",
          title: "Retrieve meeting recordings and transcripts",
          description: "Locate and compile all Zoom meeting recordings and transcripts for the Iberdyne engagement.",
          status: "PENDING",
        },
      ],
      communications: [
        {
          id: "proserv-dsar-4-comm-1",
          direction: "INBOUND",
          channel: "Portal",
          subject: "Access Request — All Communications",
          content:
            "We would like copies of all communications, meeting notes, assessments, and internal notes related to our engagement for GDPR compliance program implementation (Project IB-2025-GDPR).",
          sentAt: "2026-02-20",
        },
      ],
    },
    // 5. REJECTED — Competitor suspected of fishing for client list (legal privilege)
    {
      id: "proserv-dsar-5",
      publicId: "DSAR-PS-2025-005",
      type: "ACCESS",
      status: "REJECTED",
      requesterName: "Thomas Berger",
      requesterEmail: "t.berger@consultinghaus.de",
      requesterPhone: "+49 30 1234567",
      relationship: "Other",
      description:
        "Individual associated with a competing consulting firm requesting 'all data including client lists and engagement records' under DSAR. Request rejected as manifestly unfounded — requesting trade secrets and privileged client information, not personal data about the requester.",
      receivedAt: "2025-07-05",
      acknowledgedAt: "2025-07-06",
      dueDate: "2025-08-04",
      completedAt: "2025-07-20",
      verificationMethod: "Email domain cross-referenced with competitor firm",
      verifiedAt: "2025-07-08",
      responseMethod: "Formal rejection letter via email",
      responseNotes:
        "Rejected under Art. 12(5) GDPR — manifestly unfounded. Requester sought client lists and engagement records (trade secrets/privileged info), not their own personal data. Linked to Consultinghaus GmbH, a direct competitor.",
      tasks: [
        {
          id: "proserv-dsar-5-task-1",
          dataAssetId: "proserv-asset-client-db",
          assignee: "dpo",
          title: "Assess legitimacy of request",
          description:
            "Determine whether the request is a genuine DSAR or an attempt to obtain trade secrets / privileged client information.",
          status: "COMPLETED",
          completedAt: "2025-07-12",
          notes:
            "Confirmed requester is a senior associate at Consultinghaus GmbH. Request specifically asks for 'client lists and engagement records' — these are firm trade secrets, not the requester's personal data. Manifestly unfounded.",
        },
      ],
      communications: [
        {
          id: "proserv-dsar-5-comm-1",
          direction: "INBOUND",
          channel: "Email",
          subject: "Data Access Request",
          content:
            "Under GDPR, I request access to all data you hold, including client lists, engagement records, and internal assessments where my name may appear.",
          sentAt: "2025-07-05",
        },
        {
          id: "proserv-dsar-5-comm-2",
          direction: "OUTBOUND",
          channel: "Email",
          subject: "RE: Data Access Request — Rejection Notice",
          content:
            "Dear Mr. Berger, your request has been assessed and is rejected under Art. 12(5) GDPR as manifestly unfounded. Your request seeks access to client lists and engagement records which constitute trade secrets and legally privileged information, not your personal data. We hold limited personal data about you (name, email, phone) which we can confirm. Should you wish to appeal, you may contact the relevant supervisory authority.",
          sentAt: "2025-07-20",
          sentBy: "dpo",
        },
      ],
    },
  ],

  // ── Assessments ────────────────────────────────────────────
  assessments: [
    // 1. LIA: CRM Data Processing — APPROVED
    {
      id: "proserv-assess-lia-crm",
      templateType: "lia",
      activityId: "proserv-pa-business-development",
      name: "LIA: CRM Data Processing for Business Development",
      description:
        "Legitimate Interests Assessment for using Salesforce CRM to manage business development contacts and client relationships.",
      status: "APPROVED",
      riskLevel: "LOW",
      startedAt: "2025-06-01",
      submittedAt: "2025-06-15",
      completedAt: "2025-06-20",
      dueDate: "2025-07-01",
      responses: [],
      mitigations: [],
      approvals: [
        {
          id: "proserv-assess-lia-crm-approval-1",
          approver: "dpo",
          level: 1,
          status: "APPROVED",
          comments:
            "Legitimate interest in business development clearly established. Adequate safeguards in place including opt-out mechanism and data minimization. Approved.",
          decidedAt: "2025-06-20",
        },
      ],
    },
    // 2. LIA: Knowledge Management — IN_PROGRESS
    {
      id: "proserv-assess-lia-km",
      templateType: "lia",
      activityId: "proserv-pa-knowledge-mgmt",
      name: "LIA: Knowledge Management & Collaboration",
      description:
        "Legitimate Interests Assessment for internal knowledge management activities using Atlassian Confluence and Jira.",
      status: "IN_PROGRESS",
      riskLevel: "LOW",
      startedAt: "2026-01-10",
      dueDate: "2026-02-10",
      responses: [],
      mitigations: [],
      approvals: [],
    },
    // 3. Custom: Client Data Retention Review — PENDING_REVIEW
    {
      id: "proserv-assess-custom-retention",
      templateType: "custom",
      name: "Client Data Retention Review",
      description:
        "Review of client data retention practices across all systems to ensure compliance with GDPR data minimization principle and professional regulatory requirements.",
      status: "PENDING_REVIEW",
      riskLevel: "MEDIUM",
      startedAt: "2025-11-01",
      submittedAt: "2025-12-15",
      dueDate: "2026-01-15",
      responses: [],
      mitigations: [
        {
          id: "proserv-assess-custom-retention-mit-1",
          riskId: "retention-risk-1",
          title: "Implement automated retention enforcement",
          description:
            "Deploy automated data lifecycle management to enforce retention periods across Client DB and Document Management System.",
          status: "PLANNED",
          priority: 1,
          owner: "Henrik Larsen",
          dueDate: "2026-04-01",
        },
        {
          id: "proserv-assess-custom-retention-mit-2",
          riskId: "retention-risk-2",
          title: "Archive legacy client files exceeding retention",
          description:
            "Identify and securely archive or delete client files that have exceeded the 7-year retention period.",
          status: "IN_PROGRESS",
          priority: 2,
          owner: "Giulia Romano",
          dueDate: "2026-03-15",
        },
      ],
      approvals: [
        {
          id: "proserv-assess-custom-retention-approval-1",
          approver: "dpo",
          level: 1,
          status: "PENDING",
          comments: null,
        },
      ],
    },
    // 4. Custom: New Client Portal — DRAFT
    {
      id: "proserv-assess-custom-portal",
      templateType: "custom",
      name: "New Client Portal Assessment",
      description:
        "Privacy assessment for the planned client self-service portal allowing document sharing, engagement status tracking, and invoice management.",
      status: "DRAFT",
      startedAt: "2026-02-01",
      dueDate: "2026-04-01",
      responses: [],
      mitigations: [],
      approvals: [],
    },
    // 5. DPIA: AI-Powered Document Review — APPROVED, HIGH risk, score 58
    {
      id: "proserv-assess-dpia-ai",
      templateType: "dpia",
      activityId: "proserv-pa-ai-document-review",
      name: "DPIA: AI-Powered Document Review Platform",
      description:
        "Data Protection Impact Assessment for the deployment of LLM-powered document review technology processing confidential client documents, including automated PII extraction, contract analysis, and due diligence acceleration.",
      status: "APPROVED",
      riskLevel: "HIGH",
      riskScore: 58,
      startedAt: "2025-10-01",
      submittedAt: "2025-12-01",
      completedAt: "2025-12-20",
      dueDate: "2026-01-01",
      responses: [
        // S1: Processing Description
        {
          questionId: "q1_1",
          sectionId: "s1",
          response:
            "Categories processed: (1) Identifiers — client names, contact details, signatories, counterparty names extracted from contracts and M&A documents. (2) Financial — deal values, company financials, payment terms from due diligence materials. (3) Employment — employee names, roles, compensation data from HR due diligence in M&A transactions. (4) Other — NDA-protected trade secrets, legal professional privilege materials, proprietary business strategies.",
          responder: "dpo",
        },
        {
          questionId: "q1_2",
          sectionId: "s1",
          response:
            "Primary purpose: Accelerate document review and due diligence processes using AI technology, reducing review time by approximately 60% while maintaining accuracy. Secondary purposes: (1) Automated PII detection and redaction for document sharing, (2) Contract clause extraction and risk flagging, (3) Cross-document reference analysis in M&A due diligence. The processing supports the firm's core advisory business and is critical for maintaining competitive service delivery timelines.",
          responder: "dpo",
        },
        {
          questionId: "q1_3",
          sectionId: "s1",
          response: "Legitimate interests (Art. 6(1)(f))",
          responder: "dpo",
        },
        {
          questionId: "q1_4",
          sectionId: "s1",
          response: ["Customers", "Business contacts", "Employees", "Other"],
          responder: "dpo",
        },
        {
          questionId: "q1_5",
          sectionId: "s1",
          response: "1,000 \u2013 10,000",
          responder: "dpo",
        },
        {
          questionId: "q1_6",
          sectionId: "s1",
          response:
            "Data flow: (1) Client documents uploaded from Document Management System (SharePoint) to AI platform via encrypted API. (2) Documents processed by LLM for PII extraction, clause analysis, and risk scoring. (3) Extracted metadata and analysis results stored in AI platform's EU-hosted database. (4) Results returned to engagement team via secure dashboard. (5) Document embeddings stored in vector database for cross-reference analysis. (6) Optional: anonymized patterns used for model fine-tuning (opt-out available per client). Recipients: AI platform provider (Luminance, processor), engagement team members (4-6 per matter), quality assurance reviewers, and engagement partners for sign-off.",
          responder: "dpo",
        },
        // S2: Scope & Context
        {
          questionId: "q2_1",
          sectionId: "s2",
          response: "Mix of non-sensitive and sensitive indicators",
          responder: "dpo",
        },
        {
          questionId: "q2_2",
          sectionId: "s2",
          response:
            "Retention periods: (1) Extracted PII: 90 days — sufficient for engagement review cycle, then auto-deleted. (2) Document embeddings: 12 months — needed for cross-document analysis across related matters, then purged. (3) Model training data: 6 months — with per-client opt-out mechanism, anonymized before inclusion. (4) AI processing audit trail: 24 months — required for regulatory compliance and professional liability insurance. (5) Analysis results: retained in Document Management System under standard client file retention (7 years). Justification: Each period aligns with the minimum necessary for the stated purpose. Shorter periods would compromise service quality; longer periods would violate data minimization.",
          responder: "dpo",
        },
        {
          questionId: "q2_3",
          sectionId: "s2",
          response:
            "Primary processing: EU (Frankfurt data center). However, certain AI model inference requests may be processed via US-based infrastructure when the EU endpoint is at capacity. Transfer mechanism: Standard Contractual Clauses (2021 version) with supplementary technical measures (encryption in transit TLS 1.3, encryption at rest AES-256, access controls). Transfer Impact Assessment completed June 2025. Countries involved: Germany (primary), Netherlands (backup), United States (overflow processing).",
          responder: "dpo",
        },
        {
          questionId: "q2_4",
          sectionId: "s2",
          response: "Possibly unexpected \u2014 not directly related to the primary service",
          responder: "member1",
        },
        // S3: Necessity & Proportionality
        {
          questionId: "q3_1",
          sectionId: "s3",
          response:
            "Highly beneficial \u2014 significantly more effective than alternatives",
          responder: "dpo",
        },
        {
          questionId: "q3_2",
          sectionId: "s3",
          response:
            "Alternatives considered: (1) Manual document review only — rejected because it requires 3-4x more time, increasing costs and reducing competitiveness. Error rates higher for repetitive PII detection tasks. (2) Keyword-based search tools — rejected because they miss contextual PII (e.g., names in narrative text), cannot extract structured data from unstructured documents, and do not support cross-document analysis. (3) On-premises AI deployment — rejected due to prohibitive infrastructure costs for a 120-person firm and inability to keep models current. (4) Outsourced review to contract reviewers — rejected due to higher data exposure risk (more individuals accessing confidential materials) and quality control challenges.",
          responder: "dpo",
        },
        {
          questionId: "q3_3",
          sectionId: "s3",
          response:
            "Data minimization measures: (1) Only documents relevant to the specific engagement are uploaded — no bulk uploads. (2) PII extraction results are auto-deleted after 90 days. (3) Document embeddings do not contain raw text — only mathematical vector representations. (4) Model training uses anonymized patterns only, with per-client opt-out. (5) Access restricted to engagement team members via RBAC. (6) Redaction tools applied before document sharing with third parties. (7) Client-specific data silos — no cross-client data mixing in AI processing.",
          responder: "dpo",
        },
        // S4: Consultation
        {
          questionId: "q4_1",
          sectionId: "s4",
          response: [
            "Data Protection Officer",
            "IT / Information Security",
            "Legal counsel",
            "Processor / vendor",
          ],
          responder: "dpo",
        },
        {
          questionId: "q4_2",
          sectionId: "s4",
          response:
            "Consultation outcomes: (1) DPO recommended enhanced audit logging for all AI processing operations — implemented. (2) IT Security required additional network segmentation between AI platform and general office network — implemented. (3) Legal counsel advised that client engagement letters must disclose AI tool usage — updated template. (4) AI vendor (Luminance) confirmed EU data residency option and provided SOC 2 Type II report. (5) Information Security team conducted penetration test of AI platform integration — no critical findings. (6) Decision not to consult data subjects directly — assessed as disproportionate given the number of third-party data subjects in documents and the safeguards in place.",
          responder: "dpo",
        },
        // S5: Risk Identification
        {
          questionId: "q5_1",
          sectionId: "s5",
          response: true,
          responder: "dpo",
        },
        {
          questionId: "q5_2",
          sectionId: "s5",
          response: false,
          responder: "dpo",
        },
        {
          questionId: "q5_3",
          sectionId: "s5",
          response: false,
          responder: "dpo",
        },
        {
          questionId: "q5_4",
          sectionId: "s5",
          response: false,
          responder: "dpo",
        },
        {
          questionId: "q5_5",
          sectionId: "s5",
          response: true,
          responder: "dpo",
        },
        {
          questionId: "q5_6",
          sectionId: "s5",
          response:
            "Risk 1 — LLM Hallucination Exposing Client Data: The AI model could generate inaccurate outputs that inadvertently reveal or fabricate client data, leading to incorrect legal conclusions. Likelihood: Possible. Severity: Severe. Affected rights: accuracy, confidentiality.\n\nRisk 2 — Training Data Leakage: Client-specific information could leak into model outputs for other clients if training data is not properly siloed. Likelihood: Remote. Severity: Critical. Affected rights: confidentiality, legal professional privilege.\n\nRisk 3 — Unauthorized Document Access: Insufficient access controls could allow unauthorized personnel to view confidential client documents through the AI platform. Likelihood: Possible. Severity: Severe. Affected rights: confidentiality, data security.\n\nRisk 4 — Cross-Border Processing Exposure: EU client data processed by US infrastructure may be subject to US government access requests (FISA 702). Likelihood: Remote. Severity: Significant. Affected rights: data protection, privacy.\n\nRisk 5 — Breach of Legal Professional Privilege: AI processing of privileged materials could create copies or derivatives that fall outside privilege protections. Likelihood: Possible. Severity: Severe. Affected rights: legal privilege, confidentiality.\n\nRisk 6 — Excessive Retention of Extracted PII: PII extracted by the AI could be retained beyond necessary periods if automated deletion fails. Likelihood: Remote. Severity: Significant. Affected rights: data minimization, erasure.",
          responder: "dpo",
        },
        // S6: Mitigation Measures
        {
          questionId: "q6_1",
          sectionId: "s6",
          response: [
            "Encryption at rest",
            "Encryption in transit",
            "Access controls / RBAC",
            "Audit logging",
            "Network segmentation",
            "Automated retention enforcement",
          ],
          responder: "dpo",
        },
        {
          questionId: "q6_2",
          sectionId: "s6",
          response: [
            "Staff training / awareness",
            "Data processing agreements (DPAs)",
            "Privacy policies & procedures",
            "Regular audits / reviews",
            "Vendor management program",
            "Privacy by design process",
          ],
          responder: "dpo",
        },
        {
          questionId: "q6_3",
          sectionId: "s6",
          response:
            "Individual rights safeguards: (1) Updated engagement letters now disclose AI tool usage with clear explanation of processing purposes — clients can opt out of AI-assisted review. (2) Per-client opt-out from model training data, managed via Client DB flag. (3) Privacy notice for third-party data subjects published on firm website. (4) Data portability: extracted data available in JSON/CSV format on request. (5) Right to object: clients can request human-only review at any time (may affect timeline). (6) Automated PII detection outputs flagged for human review before use in deliverables — no fully automated decisions affecting individuals.",
          responder: "dpo",
        },
        // S7: Residual Risk & Conclusion
        {
          questionId: "q7_1",
          sectionId: "s7",
          response: "Medium",
          responder: "dpo",
        },
        {
          questionId: "q7_2",
          sectionId: "s7",
          response:
            "No \u2014 residual risk has been sufficiently mitigated",
          responder: "dpo",
        },
        {
          questionId: "q7_3",
          sectionId: "s7",
          response:
            "DPO Recommendation: The processing may proceed subject to the following conditions: (1) All six identified mitigations must be fully implemented before production deployment with client data. (2) Quarterly review of AI processing outputs for accuracy and hallucination rates. (3) Annual review of this DPIA or upon significant changes to the AI platform. (4) Client engagement letters must be updated before new engagements commence. (5) Incident response plan specific to AI-related data incidents must be tested within 3 months. Recommended next review date: July 2026. The residual risk is assessed as MEDIUM after mitigations — acceptable given the significant business benefits and the comprehensive safeguards implemented.",
          responder: "dpo",
        },
      ],
      mitigations: [
        {
          id: "proserv-assess-dpia-ai-mit-1",
          riskId: "risk-1-hallucination",
          title: "Implement output validation and human oversight",
          description:
            "Deploy automated hallucination detection for AI outputs. All AI-generated analysis must be reviewed by a qualified team member before inclusion in client deliverables. Implement confidence scoring for PII extraction results.",
          status: "IMPLEMENTED",
          priority: 1,
          owner: "Giulia Romano",
          completedAt: "2025-11-15",
          evidence: "Output validation pipeline deployed. SOC 2 audit confirmed.",
        },
        {
          id: "proserv-assess-dpia-ai-mit-2",
          riskId: "risk-2-training-leakage",
          title: "Client data siloing and training opt-out",
          description:
            "Enforce strict client-level data isolation in AI platform. Implement per-client opt-out flag for model training. Anonymize all training data before inclusion in fine-tuning datasets.",
          status: "IMPLEMENTED",
          priority: 1,
          owner: "Henrik Larsen",
          completedAt: "2025-11-20",
          evidence:
            "Client isolation verified by penetration test. Opt-out mechanism tested with 3 pilot clients.",
        },
        {
          id: "proserv-assess-dpia-ai-mit-3",
          riskId: "risk-3-unauthorized-access",
          title: "Role-based access controls and audit logging",
          description:
            "Implement engagement-level RBAC in AI platform. All document access logged with user, timestamp, and action. Quarterly access reviews by DPO.",
          status: "IMPLEMENTED",
          priority: 2,
          owner: "Henrik Larsen",
          completedAt: "2025-11-10",
          evidence:
            "RBAC configured with engagement-level granularity. Audit logs reviewed — no unauthorized access detected in Q4 2025.",
        },
        {
          id: "proserv-assess-dpia-ai-mit-4",
          riskId: "risk-4-cross-border",
          title: "EU-primary processing with SCCs for overflow",
          description:
            "Configure AI platform to prioritize EU data center. US overflow processing only when EU capacity exceeded. SCCs and supplementary technical measures in place.",
          status: "IMPLEMENTED",
          priority: 2,
          owner: "Elise M\u00fcller",
          completedAt: "2025-10-25",
          evidence: "EU-primary routing confirmed. TIA completed. SCCs executed with vendor.",
        },
        {
          id: "proserv-assess-dpia-ai-mit-5",
          riskId: "risk-5-privilege",
          title: "Privilege classification and processing controls",
          description:
            "Implement document privilege classification before AI processing. Privileged materials processed in isolated environment with enhanced access controls. AI-generated derivatives of privileged documents marked as privileged.",
          status: "VERIFIED",
          priority: 1,
          owner: "Elise M\u00fcller",
          completedAt: "2025-12-05",
          evidence:
            "Privilege workflow tested with legal team. Classification accuracy validated at 97%. External legal counsel confirmed approach is consistent with professional secrecy obligations.",
        },
        {
          id: "proserv-assess-dpia-ai-mit-6",
          riskId: "risk-6-retention",
          title: "Automated PII lifecycle management",
          description:
            "Deploy automated retention enforcement: PII extractions auto-deleted at 90 days, embeddings at 12 months, training data at 6 months. Daily monitoring job with alerting for deletion failures.",
          status: "IMPLEMENTED",
          priority: 2,
          owner: "Giulia Romano",
          completedAt: "2025-11-28",
          evidence:
            "Automated deletion jobs running successfully since November 2025. Zero retention violations detected.",
        },
      ],
      approvals: [
        {
          id: "proserv-assess-dpia-ai-approval-1",
          approver: "dpo",
          level: 1,
          status: "APPROVED",
          comments:
            "All six risk mitigations implemented and verified. Residual risk assessed as Medium. Processing may proceed under stated conditions. Next review: July 2026.",
          decidedAt: "2025-12-15",
        },
        {
          id: "proserv-assess-dpia-ai-approval-2",
          approver: "owner",
          level: 2,
          status: "APPROVED",
          comments:
            "Approved. The AI document review platform is critical to our competitive positioning. Satisfied that the DPO's recommended safeguards adequately address the identified risks. Annual review committed.",
          decidedAt: "2025-12-20",
        },
      ],
    },
  ],

  // ── Incidents ──────────────────────────────────────────────
  incidents: [
    // 1. CLOSED — Unauthorized Access to M&A Deal Room
    {
      id: "proserv-incident-deal-room",
      publicId: "INC-PS-2025-001",
      title: "Unauthorized Access to M&A Deal Room",
      description:
        "A junior consultant was found to have accessed a confidential M&A deal room in the Document Management System without authorization. The consultant was assigned to a different engagement but used inherited SharePoint permissions to view due diligence documents for a high-profile acquisition involving 2 listed companies.",
      type: "UNAUTHORIZED_ACCESS",
      severity: "HIGH",
      status: "CLOSED",
      discoveredAt: "2025-08-15",
      discoveredBy: "Henrik Larsen",
      discoveryMethod: "Audit log review during quarterly access control review",
      affectedRecords: 340,
      affectedSubjects: [
        "Target company employees",
        "Target company directors",
        "Acquiring company executives",
      ],
      dataCategories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
      containedAt: "2025-08-15",
      containmentActions:
        "Immediately revoked the consultant's access to the deal room. Suspended inherited permissions model for all deal rooms. Placed consultant on administrative leave pending investigation.",
      rootCause: "SharePoint permission inheritance",
      rootCauseCategory: "Access Control Failure",
      resolvedAt: "2025-09-05",
      resolutionNotes:
        "Implemented explicit-only permissions for all deal rooms. Deployed DLP policies preventing download of deal room documents to personal devices. Consultant received formal warning and mandatory privacy training.",
      lessonsLearned:
        "Permission inheritance in SharePoint deal rooms must be disabled by default. Quarterly access reviews should include automated permission audits. Consider dedicated deal room platform with built-in access controls.",
      notificationRequired: false,
      notificationDeadline: "2025-08-18",
      timeline: [
        {
          id: "proserv-incident-deal-room-tl-1",
          timestamp: "2025-08-15T09:30:00Z",
          title: "Unauthorized access detected",
          description:
            "Quarterly access audit revealed junior consultant accessed Project Eagle deal room 14 times over 3 weeks without authorization.",
          entryType: "DETECTION",
          createdBy: "admin",
        },
        {
          id: "proserv-incident-deal-room-tl-2",
          timestamp: "2025-08-15T11:00:00Z",
          title: "Access revoked and permissions reviewed",
          description:
            "Consultant's deal room access revoked. SharePoint permission inheritance disabled for all deal rooms. HR notified.",
          entryType: "CONTAINMENT",
          createdBy: "admin",
        },
        {
          id: "proserv-incident-deal-room-tl-3",
          timestamp: "2025-08-18T14:00:00Z",
          title: "Investigation completed",
          description:
            "Forensic analysis confirmed no data exfiltration (no downloads, no forwarding). Access was view-only. No evidence of malicious intent — consultant claimed curiosity.",
          entryType: "INVESTIGATION",
          createdBy: "dpo",
        },
        {
          id: "proserv-incident-deal-room-tl-4",
          timestamp: "2025-09-05T10:00:00Z",
          title: "Incident closed — remediation complete",
          description:
            "All deal rooms migrated to explicit-only permissions. DLP policies deployed. Consultant completed mandatory training. No DPA notification required — no data exfiltration confirmed.",
          entryType: "RESOLUTION",
          createdBy: "dpo",
        },
      ],
      tasks: [
        {
          id: "proserv-incident-deal-room-task-1",
          assignee: "admin",
          title: "Revoke unauthorized access and audit permissions",
          description:
            "Immediately revoke consultant's access. Audit all deal room permissions for similar inheritance issues.",
          priority: "URGENT",
          status: "COMPLETED",
          completedAt: "2025-08-15",
          dueDate: "2025-08-15",
        },
        {
          id: "proserv-incident-deal-room-task-2",
          assignee: "dpo",
          title: "Assess DPA notification obligation",
          description:
            "Determine whether this incident triggers Art. 33/34 notification obligations under GDPR.",
          priority: "HIGH",
          status: "COMPLETED",
          completedAt: "2025-08-18",
          dueDate: "2025-08-18",
          notes:
            "No data exfiltration confirmed. Risk to data subjects assessed as low. No DPA notification required.",
        },
        {
          id: "proserv-incident-deal-room-task-3",
          assignee: "admin",
          title: "Implement explicit-only permissions for deal rooms",
          description:
            "Migrate all deal rooms to explicit permission grants. Disable SharePoint permission inheritance.",
          priority: "HIGH",
          status: "COMPLETED",
          completedAt: "2025-08-25",
          dueDate: "2025-08-30",
        },
      ],
      affectedAssets: [
        {
          id: "proserv-incident-deal-room-aa-1",
          dataAssetId: "proserv-asset-document-mgmt",
          impactLevel: "HIGH",
          compromised: false,
          notes:
            "340 documents in Project Eagle deal room were viewed but not downloaded or shared externally.",
        },
      ],
      notifications: [],
    },
    // 2. INVESTIGATING — Ex-Employee Retaining Confidential Client Files
    {
      id: "proserv-incident-exemployee",
      publicId: "INC-PS-2026-002",
      title: "Ex-Employee Retaining Confidential Client Files",
      description:
        "A former senior consultant, who departed the firm 2 months ago, was discovered to have retained copies of confidential client files on a personal cloud storage service. The files include M&A due diligence documents, client financial statements, and engagement correspondence for 8 active client matters.",
      type: "DATA_LOSS",
      severity: "HIGH",
      status: "INVESTIGATING",
      discoveredAt: "2026-02-01",
      discoveredBy: "Giulia Romano",
      discoveryMethod:
        "Client reported receiving an email from the ex-employee referencing confidential deal details",
      affectedRecords: 1200,
      affectedSubjects: [
        "Clients",
        "Client employees",
        "Counterparties",
      ],
      dataCategories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
      containedAt: "2026-02-02",
      containmentActions:
        "Legal demand letter sent to ex-employee requiring immediate deletion and certification of destruction. All client passwords and access tokens rotated. Affected clients notified informally.",
      notificationRequired: true,
      notificationDeadline: "2026-02-04",
      timeline: [
        {
          id: "proserv-incident-exemployee-tl-1",
          timestamp: "2026-02-01T10:00:00Z",
          title: "Client report of confidential data exposure",
          description:
            "Client Nordström Capital reported receiving an email from ex-employee referencing specific deal terms from Project Viking (active M&A matter).",
          entryType: "DETECTION",
          createdBy: "member1",
        },
        {
          id: "proserv-incident-exemployee-tl-2",
          timestamp: "2026-02-01T14:00:00Z",
          title: "Internal investigation initiated",
          description:
            "IT forensics engaged to determine scope of data retained. Exit procedure records reviewed — standard device return and access revocation was completed at departure.",
          entryType: "INVESTIGATION",
          createdBy: "admin",
        },
        {
          id: "proserv-incident-exemployee-tl-3",
          timestamp: "2026-02-02T09:00:00Z",
          title: "Legal demand letter sent",
          description:
            "External counsel sent formal demand to ex-employee requiring deletion of all firm data, certification of destruction, and undertaking not to use or disclose.",
          entryType: "CONTAINMENT",
          createdBy: "dpo",
        },
      ],
      tasks: [
        {
          id: "proserv-incident-exemployee-task-1",
          assignee: "dpo",
          title: "Notify DPA within 72 hours",
          description:
            "Prepare and submit Art. 33 notification to relevant supervisory authority.",
          priority: "URGENT",
          status: "COMPLETED",
          completedAt: "2026-02-03",
          dueDate: "2026-02-04",
          notes: "Notification submitted to BfDI (German DPA).",
        },
        {
          id: "proserv-incident-exemployee-task-2",
          assignee: "admin",
          title: "Determine full scope of retained data",
          description:
            "Work with IT forensics to identify all files the ex-employee may have retained. Review email logs, cloud sync records, and USB device history.",
          priority: "HIGH",
          status: "IN_PROGRESS",
          dueDate: "2026-02-15",
        },
        {
          id: "proserv-incident-exemployee-task-3",
          assignee: "member1",
          title: "Notify affected clients",
          description:
            "Prepare formal notifications to all 8 affected clients under Art. 34 obligations.",
          priority: "HIGH",
          status: "IN_PROGRESS",
          dueDate: "2026-02-10",
        },
        {
          id: "proserv-incident-exemployee-task-4",
          assignee: "admin",
          title: "Review and strengthen offboarding procedures",
          description:
            "Audit current offboarding process and implement enhanced controls: device forensic wipe, cloud storage audit, NDA compliance verification.",
          priority: "MEDIUM",
          status: "TODO",
          dueDate: "2026-03-01",
        },
      ],
      affectedAssets: [
        {
          id: "proserv-incident-exemployee-aa-1",
          dataAssetId: "proserv-asset-document-mgmt",
          impactLevel: "HIGH",
          compromised: true,
          notes:
            "Confidential client files from 8 active matters copied to ex-employee's personal cloud storage.",
        },
        {
          id: "proserv-incident-exemployee-aa-2",
          dataAssetId: "proserv-asset-client-db",
          impactLevel: "MEDIUM",
          compromised: false,
          notes:
            "Client contact details may have been included in retained correspondence but database itself not accessed post-departure.",
        },
      ],
      notifications: [
        {
          id: "proserv-incident-exemployee-notif-1",
          jurisdictionCode: "GDPR",
          recipientType: "DPA",
          recipientName: "BfDI (German Federal DPA)",
          status: "SENT",
          deadline: "2026-02-04",
          content:
            "Art. 33 notification regarding unauthorized retention of confidential client data by former employee. Approximately 1,200 records across 8 client matters affected.",
          notes: "Initial notification submitted. Follow-up with full scope pending investigation.",
        },
        {
          id: "proserv-incident-exemployee-notif-2",
          jurisdictionCode: "GDPR",
          recipientType: "Data Subjects",
          recipientName: "Affected Clients (8 organizations)",
          status: "PENDING",
          deadline: "2026-02-10",
          content:
            "Art. 34 notification to affected clients regarding unauthorized retention of engagement files by a former employee.",
          notes: "Individual client notifications being prepared by engagement teams.",
        },
      ],
    },
    // 3. CONTAINED — AI Tool Leaking Client Data in Completions
    {
      id: "proserv-incident-ai-leak",
      publicId: "INC-PS-2026-003",
      title: "AI Tool Leaking Client Data in Completions",
      description:
        "The AI Document Review Platform was found to be including fragments of Client A's confidential M&A documents in completion outputs generated for Client B's engagement. Root cause: insufficient data siloing in the vector database led to cross-client contamination in retrieval-augmented generation (RAG) queries.",
      type: "DATA_BREACH",
      severity: "CRITICAL",
      status: "CONTAINED",
      discoveredAt: "2026-02-20",
      discoveredBy: "Giulia Romano",
      discoveryMethod:
        "Engagement team member noticed unfamiliar company names in AI-generated contract analysis output",
      affectedRecords: 85,
      affectedSubjects: [
        "Client A employees and directors",
        "Client A counterparties",
      ],
      dataCategories: ["IDENTIFIERS", "FINANCIAL"],
      containedAt: "2026-02-20",
      containmentActions:
        "Immediately suspended all AI Document Review processing. Isolated vector database. Engagement teams for both clients notified. Vendor (Luminance) escalation opened as Priority 1.",
      notificationRequired: true,
      notificationDeadline: "2026-02-23",
      timeline: [
        {
          id: "proserv-incident-ai-leak-tl-1",
          timestamp: "2026-02-20T11:15:00Z",
          title: "Cross-client data contamination detected",
          description:
            "Giulia Romano identified references to 'Project Meridian' (Client A matter) appearing in AI outputs for 'Project Atlas' (Client B matter). Investigation confirmed RAG pipeline retrieving cross-client document chunks.",
          entryType: "DETECTION",
          createdBy: "member1",
        },
        {
          id: "proserv-incident-ai-leak-tl-2",
          timestamp: "2026-02-20T12:00:00Z",
          title: "AI platform suspended",
          description:
            "All AI Document Review processing suspended firm-wide. Vector database access locked. Vendor notified as P1 incident.",
          entryType: "CONTAINMENT",
          createdBy: "admin",
        },
        {
          id: "proserv-incident-ai-leak-tl-3",
          timestamp: "2026-02-21T10:00:00Z",
          title: "Root cause identified",
          description:
            "Vendor confirmed root cause: recent platform update inadvertently merged per-client vector namespaces into a shared index. Affecting all multi-tenant deployments. Patch in development.",
          entryType: "INVESTIGATION",
          createdBy: "dpo",
        },
      ],
      tasks: [
        {
          id: "proserv-incident-ai-leak-task-1",
          assignee: "admin",
          title: "Suspend AI platform and preserve evidence",
          description:
            "Immediately halt all AI processing. Preserve vector database state and processing logs for forensic analysis.",
          priority: "URGENT",
          status: "COMPLETED",
          completedAt: "2026-02-20",
          dueDate: "2026-02-20",
        },
        {
          id: "proserv-incident-ai-leak-task-2",
          assignee: "dpo",
          title: "Assess scope and notify DPA",
          description:
            "Determine full scope of cross-client data exposure. Prepare Art. 33 notification.",
          priority: "URGENT",
          status: "IN_PROGRESS",
          dueDate: "2026-02-23",
        },
        {
          id: "proserv-incident-ai-leak-task-3",
          assignee: "member1",
          title: "Notify affected clients",
          description:
            "Prepare Art. 34 notifications and schedule calls with Client A and Client B engagement partners.",
          priority: "HIGH",
          status: "TODO",
          dueDate: "2026-02-25",
        },
        {
          id: "proserv-incident-ai-leak-task-4",
          assignee: "admin",
          title: "Coordinate vendor remediation and testing",
          description:
            "Work with AI vendor to verify patch, conduct isolation testing before platform restart.",
          priority: "HIGH",
          status: "TODO",
          dueDate: "2026-03-05",
        },
      ],
      affectedAssets: [
        {
          id: "proserv-incident-ai-leak-aa-1",
          dataAssetId: "proserv-asset-ai-review",
          impactLevel: "CRITICAL",
          compromised: true,
          notes:
            "Vector database cross-client contamination. Client A document fragments appearing in Client B outputs.",
        },
        {
          id: "proserv-incident-ai-leak-aa-2",
          dataAssetId: "proserv-asset-document-mgmt",
          impactLevel: "LOW",
          compromised: false,
          notes:
            "Source documents in DMS not affected — contamination occurred only in AI platform's vector store.",
        },
      ],
      notifications: [
        {
          id: "proserv-incident-ai-leak-notif-1",
          jurisdictionCode: "GDPR",
          recipientType: "DPA",
          recipientName: "BfDI (German Federal DPA)",
          status: "PENDING",
          deadline: "2026-02-23",
          content:
            "Art. 33 notification regarding cross-client data exposure in AI document review platform due to vendor software defect.",
        },
      ],
    },
    // 4. CLOSED — Phishing Email Targeting Partner Accounts
    {
      id: "proserv-incident-phishing",
      publicId: "INC-PS-2025-004",
      title: "Phishing Email Targeting Partner Accounts",
      description:
        "Sophisticated phishing campaign targeting firm partners using spoofed client emails requesting urgent wire transfer authorization and document access. Two partners clicked phishing links; one entered credentials before recognizing the attack. No data exfiltration confirmed.",
      type: "PHISHING",
      severity: "MEDIUM",
      status: "CLOSED",
      discoveredAt: "2025-11-20",
      discoveredBy: "Patrick O'Brien",
      discoveryMethod:
        "Partner recognized suspicious email after entering credentials on fake login page",
      affectedRecords: 0,
      affectedSubjects: ["Firm partners"],
      dataCategories: ["IDENTIFIERS"],
      containedAt: "2025-11-20",
      containmentActions:
        "Immediately reset compromised partner credentials. Enabled MFA re-enrollment. Blocked phishing domains at firewall. Sent firm-wide alert.",
      rootCause: "Social engineering via spoofed client email domain",
      rootCauseCategory: "Phishing / Social Engineering",
      resolvedAt: "2025-11-25",
      resolutionNotes:
        "Credential reset confirmed. MFA re-enrolled. No unauthorized access to systems detected in 72-hour monitoring window. Phishing awareness training refresher scheduled for all staff.",
      lessonsLearned:
        "Partners are high-value targets. Implement phishing-resistant MFA (FIDO2/hardware keys) for all partner accounts. Add external email banner warnings. Consider dedicated email security gateway.",
      notificationRequired: false,
      timeline: [
        {
          id: "proserv-incident-phishing-tl-1",
          timestamp: "2025-11-20T16:30:00Z",
          title: "Phishing attack detected",
          description:
            "Partner Patrick O'Brien reported suspicious email purportedly from a client requesting urgent document access. Investigation revealed 2 partners received similar emails; 1 entered credentials on phishing page.",
          entryType: "DETECTION",
          createdBy: "member2",
        },
        {
          id: "proserv-incident-phishing-tl-2",
          timestamp: "2025-11-20T17:00:00Z",
          title: "Credentials reset and MFA re-enrolled",
          description:
            "Compromised partner credentials immediately reset. MFA tokens invalidated and re-enrolled. Phishing domains blocked. Firm-wide alert issued.",
          entryType: "CONTAINMENT",
          createdBy: "admin",
        },
        {
          id: "proserv-incident-phishing-tl-3",
          timestamp: "2025-11-25T10:00:00Z",
          title: "Incident closed — no data exposure confirmed",
          description:
            "72-hour monitoring confirmed no unauthorized access using compromised credentials. FIDO2 hardware key rollout approved for all partners.",
          entryType: "RESOLUTION",
          createdBy: "dpo",
        },
      ],
      tasks: [
        {
          id: "proserv-incident-phishing-task-1",
          assignee: "admin",
          title: "Reset credentials and enforce MFA re-enrollment",
          description: "Immediately reset compromised partner credentials and re-enroll MFA tokens.",
          priority: "URGENT",
          status: "COMPLETED",
          completedAt: "2025-11-20",
          dueDate: "2025-11-20",
        },
        {
          id: "proserv-incident-phishing-task-2",
          assignee: "dpo",
          title: "Monitor for unauthorized access (72 hours)",
          description:
            "Review all authentication logs and system access for compromised accounts over 72-hour window.",
          priority: "HIGH",
          status: "COMPLETED",
          completedAt: "2025-11-23",
          dueDate: "2025-11-23",
        },
        {
          id: "proserv-incident-phishing-task-3",
          assignee: "member2",
          title: "Schedule firm-wide phishing awareness training",
          description:
            "Arrange mandatory phishing awareness refresher training for all staff within 30 days.",
          priority: "MEDIUM",
          status: "COMPLETED",
          completedAt: "2025-12-15",
          dueDate: "2025-12-20",
        },
      ],
      affectedAssets: [
        {
          id: "proserv-incident-phishing-aa-1",
          dataAssetId: "proserv-asset-collaboration",
          impactLevel: "LOW",
          compromised: false,
          notes:
            "Partner's Atlassian account credentials were compromised but MFA prevented unauthorized login. No data accessed.",
        },
      ],
      notifications: [],
    },
  ],

  // ── Audit Logs ─────────────────────────────────────────────
  auditLogs: [
    {
      id: "proserv-audit-01",
      user: "owner",
      entityType: "Organization",
      entityId: "proserv-organization",
      action: "CREATE",
      changes: { name: "Alder & Stone Consulting", slug: "demo-proserv" },
      createdAt: "2025-03-01T09:00:00Z",
    },
    {
      id: "proserv-audit-02",
      user: "dpo",
      entityType: "DataAsset",
      entityId: "proserv-asset-client-db",
      action: "CREATE",
      changes: { name: "Client Management Database", type: "DATABASE" },
      createdAt: "2025-03-05T10:00:00Z",
    },
    {
      id: "proserv-audit-03",
      user: "dpo",
      entityType: "DataAsset",
      entityId: "proserv-asset-ai-review",
      action: "CREATE",
      changes: { name: "AI Document Review Platform", type: "CLOUD_SERVICE" },
      createdAt: "2025-06-15T11:00:00Z",
    },
    {
      id: "proserv-audit-04",
      user: "admin",
      entityType: "Vendor",
      entityId: "proserv-vendor-microsoft",
      action: "CREATE",
      changes: { name: "Microsoft 365", status: "ACTIVE" },
      createdAt: "2025-03-10T09:30:00Z",
    },
    {
      id: "proserv-audit-05",
      user: "admin",
      entityType: "Vendor",
      entityId: "proserv-vendor-salesforce",
      action: "CREATE",
      changes: { name: "Salesforce", status: "ACTIVE" },
      createdAt: "2025-03-10T10:00:00Z",
    },
    {
      id: "proserv-audit-06",
      user: "dpo",
      entityType: "ProcessingActivity",
      entityId: "proserv-pa-ai-document-review",
      action: "CREATE",
      changes: { name: "AI-Powered Document Review", legalBasis: "LEGITIMATE_INTERESTS" },
      createdAt: "2025-07-01T14:00:00Z",
    },
    {
      id: "proserv-audit-07",
      user: "dpo",
      entityType: "Assessment",
      entityId: "proserv-assess-dpia-ai",
      action: "CREATE",
      changes: { name: "DPIA: AI-Powered Document Review Platform", status: "DRAFT" },
      createdAt: "2025-10-01T09:00:00Z",
    },
    {
      id: "proserv-audit-08",
      user: "dpo",
      entityType: "Assessment",
      entityId: "proserv-assess-dpia-ai",
      action: "UPDATE",
      changes: { status: { from: "DRAFT", to: "IN_PROGRESS" } },
      createdAt: "2025-10-05T10:00:00Z",
    },
    {
      id: "proserv-audit-09",
      user: "dpo",
      entityType: "Assessment",
      entityId: "proserv-assess-dpia-ai",
      action: "UPDATE",
      changes: { status: { from: "IN_PROGRESS", to: "PENDING_APPROVAL" } },
      createdAt: "2025-12-01T16:00:00Z",
    },
    {
      id: "proserv-audit-10",
      user: "dpo",
      entityType: "Assessment",
      entityId: "proserv-assess-dpia-ai",
      action: "UPDATE",
      changes: { status: { from: "PENDING_APPROVAL", to: "APPROVED" }, riskScore: 58 },
      createdAt: "2025-12-20T11:00:00Z",
    },
    {
      id: "proserv-audit-11",
      user: "dpo",
      entityType: "DSARRequest",
      entityId: "proserv-dsar-1",
      action: "CREATE",
      changes: { type: "ACCESS", requesterName: "Dr. Friedrich Weber" },
      createdAt: "2025-09-10T09:00:00Z",
    },
    {
      id: "proserv-audit-12",
      user: "dpo",
      entityType: "DSARRequest",
      entityId: "proserv-dsar-1",
      action: "UPDATE",
      changes: { status: { from: "SUBMITTED", to: "COMPLETED" } },
      createdAt: "2025-10-02T15:00:00Z",
    },
    {
      id: "proserv-audit-13",
      user: "dpo",
      entityType: "DSARRequest",
      entityId: "proserv-dsar-5",
      action: "UPDATE",
      changes: { status: { from: "SUBMITTED", to: "REJECTED" }, reason: "Manifestly unfounded" },
      createdAt: "2025-07-20T14:00:00Z",
    },
    {
      id: "proserv-audit-14",
      user: "admin",
      entityType: "Incident",
      entityId: "proserv-incident-deal-room",
      action: "CREATE",
      changes: { title: "Unauthorized Access to M&A Deal Room", severity: "HIGH" },
      createdAt: "2025-08-15T10:00:00Z",
    },
    {
      id: "proserv-audit-15",
      user: "dpo",
      entityType: "Incident",
      entityId: "proserv-incident-deal-room",
      action: "UPDATE",
      changes: { status: { from: "INVESTIGATING", to: "CLOSED" } },
      createdAt: "2025-09-05T10:30:00Z",
    },
    {
      id: "proserv-audit-16",
      user: "member1",
      entityType: "Incident",
      entityId: "proserv-incident-ai-leak",
      action: "CREATE",
      changes: { title: "AI Tool Leaking Client Data in Completions", severity: "CRITICAL" },
      createdAt: "2026-02-20T11:30:00Z",
    },
    {
      id: "proserv-audit-17",
      user: "admin",
      entityType: "DataTransfer",
      entityId: "proserv-transfer-crm-us",
      action: "CREATE",
      changes: { name: "Salesforce CRM \u2014 EU to US Transfer", mechanism: "SCCs" },
      createdAt: "2025-06-15T13:00:00Z",
    },
    {
      id: "proserv-audit-18",
      user: "dpo",
      entityType: "Incident",
      entityId: "proserv-incident-exemployee",
      action: "CREATE",
      changes: { title: "Ex-Employee Retaining Confidential Client Files", severity: "HIGH" },
      createdAt: "2026-02-01T10:30:00Z",
    },
    {
      id: "proserv-audit-19",
      user: "dpo",
      entityType: "Assessment",
      entityId: "proserv-assess-lia-crm",
      action: "UPDATE",
      changes: { status: { from: "IN_PROGRESS", to: "APPROVED" } },
      createdAt: "2025-06-20T15:00:00Z",
    },
    {
      id: "proserv-audit-20",
      user: "member2",
      entityType: "Incident",
      entityId: "proserv-incident-phishing",
      action: "CREATE",
      changes: { title: "Phishing Email Targeting Partner Accounts", severity: "MEDIUM" },
      createdAt: "2025-11-20T17:00:00Z",
    },
  ],
};
