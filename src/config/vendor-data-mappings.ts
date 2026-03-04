/**
 * Vendor Data Mappings
 *
 * Maps VendorCatalog categories to privacy data structures for the
 * Privacy Program Quickstart feature. When a user imports a vendor,
 * these mappings determine what DataAssets, DataElements, and
 * ProcessingActivities are auto-generated.
 */

import type { DataCategory, DataAssetType, LegalBasis, DataSensitivity } from "@prisma/client";

// ============================================================
// TYPES
// ============================================================

export interface VendorDataMapping {
  /** Display label for this category group */
  label: string;
  /** Vendor catalog categories that map to this group */
  catalogCategories: string[];
  /** Data asset to create for the vendor */
  asset: {
    type: DataAssetType;
    hostingType: string;
    description: string;
  };
  /** Data elements the vendor typically processes */
  elements: {
    name: string;
    category: DataCategory;
    sensitivity: DataSensitivity;
    isPersonalData: boolean;
    isSpecialCategory: boolean;
    retentionDays?: number;
  }[];
  /** Processing activity for this vendor */
  activity: {
    name: string;
    purpose: string;
    legalBasis: LegalBasis;
    dataSubjects: string[];
    categories: DataCategory[];
    recipients: string[];
    retentionPeriod: string;
    retentionDays?: number;
  };
  /** Whether this vendor category warrants a DPIA suggestion */
  isHighRisk: boolean;
}

// ============================================================
// EU ADEQUACY COUNTRIES
// ============================================================

/** Countries with EU adequacy decisions (safe for data transfers) */
export const EU_ADEQUATE_COUNTRIES = [
  // EU/EEA
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA
  "IS", "LI", "NO",
  // Adequacy decisions
  "AD", "AR", "CA", "FO", "GG", "IL", "IM", "JP", "JE", "NZ",
  "KR", "CH", "UY", "GB",
];

// ============================================================
// CATEGORY MAPPINGS
// ============================================================

export const VENDOR_DATA_MAPPINGS: Record<string, VendorDataMapping> = {
  analytics: {
    label: "Analytics & BI",
    catalogCategories: [
      // VW canonical
      "Analytics & BI",
      "Personalization & Engagement",
      // VW subcategories
      "Web Analytics", "Session Replay", "Attribution", "Product Analytics", "Heatmaps",
      "A/B Testing", "Conversion Optimization", "Customer Success", "Loyalty", "Digital Adoption",
      // Legacy
      "Digital Analytics", "Advanced Analytics", "Integrated Analytics",
      "Mobile App Analytics", "Video Analytics", "Data Layer Optimization",
      "AB Testing", "Digital Experience Optimization",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Web/app analytics platform tracking user behavior and engagement metrics",
    },
    elements: [
      { name: "IP Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Device Fingerprint", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Page Views", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Session Duration", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Click Events", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Referral Source", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
      { name: "Browser & OS", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Geolocation (City-level)", category: "LOCATION", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Website/App Analytics",
      purpose: "Collect and analyze user behavior data to improve product experience, measure feature adoption, and optimize conversion funnels",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Website visitors", "App users"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "LOCATION"],
      recipients: ["Analytics provider"],
      retentionPeriod: "26 months",
      retentionDays: 790,
    },
    isHighRisk: false,
  },

  marketing: {
    label: "Marketing & Advertising",
    catalogCategories: [
      // VW canonical
      "Marketing Automation",
      "Advertising",
      // VW subcategories
      "Email Marketing", "Social Media", "ABM", "Growth & Lifecycle", "Affiliate",
      "Retargeting", "Lead Generation", "Programmatic", "Social Ads",
      // Legacy
      "Lead Capturing", "Account Based Marketing",
      "Social Media Automation", "Social Management", "Social Sharing",
      "Web Creative Automation", "Personalization", "Buyer Profiling",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Marketing automation and campaign management platform",
    },
    elements: [
      { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Full Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Company Name", category: "EMPLOYMENT", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
      { name: "Marketing Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Campaign Interactions", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Cookie Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Marketing Communications",
      purpose: "Send targeted marketing communications, track campaign effectiveness, and manage subscriber preferences",
      legalBasis: "CONSENT",
      dataSubjects: ["Subscribers", "Leads", "Customers"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "EMPLOYMENT"],
      recipients: ["Marketing platform provider", "Email service provider"],
      retentionPeriod: "Until consent withdrawn + 30 days",
      retentionDays: undefined,
    },
    isHighRisk: false,
  },

  crm: {
    label: "CRM & Sales",
    catalogCategories: [
      // VW canonical
      "CRM & Sales",
      // VW subcategories
      "CRM Platform", "Sales Engagement", "Revenue Intelligence",
      // Legacy
      "CRM", "Sales Enablement", "Customer Journey Orchestration",
      "Customer Sign-up", "Cart Abandonment",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Customer relationship management system storing prospect and customer data",
    },
    elements: [
      { name: "Full Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Phone Number", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Company & Job Title", category: "EMPLOYMENT", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Deal/Opportunity Data", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: false, isSpecialCategory: false },
      { name: "Communication History", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Postal Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Customer Relationship Management",
      purpose: "Manage customer relationships, track sales pipeline, and support customer communications throughout the customer lifecycle",
      legalBasis: "CONTRACT",
      dataSubjects: ["Customers", "Prospects", "Business contacts"],
      categories: ["IDENTIFIERS", "EMPLOYMENT", "FINANCIAL", "BEHAVIORAL"],
      recipients: ["CRM provider", "Sales team"],
      retentionPeriod: "Duration of business relationship + 3 years",
      retentionDays: 1095,
    },
    isHighRisk: false,
  },

  cdp: {
    label: "Customer Data Platform",
    catalogCategories: [
      // VW canonical
      "Customer Data Platform",
      // VW subcategories
      "CDP", "DMP", "Identity Resolution", "Data Enrichment",
      // Legacy
      "Data Management Platform", "Data Clean Room",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Unified customer data platform aggregating profiles across touchpoints",
    },
    elements: [
      { name: "Unified Customer Profile", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Cross-device Identifiers", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Behavioral Segments", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Transaction History", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Consent Records", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Customer Data Unification",
      purpose: "Create unified customer profiles by combining data from multiple sources for personalization and analytics",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Customers", "Website visitors"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "FINANCIAL"],
      recipients: ["CDP provider", "Connected marketing tools"],
      retentionPeriod: "Duration of customer relationship + 1 year",
      retentionDays: 365,
    },
    isHighRisk: true,
  },

  cloud: {
    label: "Cloud Infrastructure",
    catalogCategories: [
      // VW canonical
      "Cloud Infrastructure",
      "Data Warehouse & Integration",
      // VW subcategories
      "CDN", "PaaS", "Hosting", "Storage",
      "Data Warehouse", "ETL",
      // Legacy
      "Cloud Hosting", "Reverse ETL", "API Integration",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Cloud infrastructure and hosting services for application and data storage",
    },
    elements: [
      { name: "Application Data", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: false, isSpecialCategory: false },
      { name: "Server Logs", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Stored Customer Records", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Backup Data", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Cloud Data Hosting",
      purpose: "Host and store application data including personal data in cloud infrastructure with appropriate security controls",
      legalBasis: "CONTRACT",
      dataSubjects: ["Customers", "Employees", "All data subjects"],
      categories: ["IDENTIFIERS", "OTHER"],
      recipients: ["Cloud infrastructure provider"],
      retentionPeriod: "As defined by data controller policies",
      retentionDays: undefined,
    },
    isHighRisk: false,
  },

  cms: {
    label: "Content & E-commerce",
    catalogCategories: [
      // VW canonical
      "Content Management",
      "E-commerce",
      // VW subcategories
      "CMS", "DAM", "Landing Pages",
      "Platform", "Cart & Checkout", "Subscription Billing",
      // Legacy
      "Content Management Platform", "Content Curation",
      "Online store management", "Enterprise Ecommerce", "eCommerce Platform",
    ],
    asset: {
      type: "APPLICATION",
      hostingType: "Cloud",
      description: "Content management or ecommerce platform powering web presence",
    },
    elements: [
      { name: "User Accounts", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Order/Purchase Data", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Shipping Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Content Interactions", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Content & Commerce Management",
      purpose: "Manage web content, user accounts, and ecommerce transactions",
      legalBasis: "CONTRACT",
      dataSubjects: ["Customers", "Registered users"],
      categories: ["IDENTIFIERS", "FINANCIAL", "BEHAVIORAL"],
      recipients: ["Platform provider", "Payment processor"],
      retentionPeriod: "Duration of account + 5 years for transactions",
      retentionDays: 1825,
    },
    isHighRisk: false,
  },

  support: {
    label: "Customer Support",
    catalogCategories: [
      // VW canonical
      "Customer Support",
      "Communication",
      // VW subcategories
      "Chatbot", "Live Chat", "Helpdesk",
      "Email Delivery", "Messaging", "Video",
      // Legacy
      "Customer Communications Platform", "Call tracking",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Customer support and communications platform for handling inquiries",
    },
    elements: [
      { name: "Full Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Phone Number", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Support Ticket Content", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Call Recordings", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Customer Support Operations",
      purpose: "Handle customer inquiries, track support tickets, and maintain communication records for service quality",
      legalBasis: "CONTRACT",
      dataSubjects: ["Customers", "Support requesters"],
      categories: ["IDENTIFIERS", "OTHER"],
      recipients: ["Support platform provider"],
      retentionPeriod: "3 years after ticket closure",
      retentionDays: 1095,
    },
    isHighRisk: false,
  },

  ai: {
    label: "AI & Machine Learning",
    catalogCategories: [
      // VW canonical
      "AI & Machine Learning",
      // VW subcategories
      "LLM Provider", "ML Platform", "AI Tools",
      // Legacy
      "AI Bot", "AI Chatbot", "AI SEO", "AI Widget",
      "AI-driven data insights",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "AI-powered tool processing user data for automated interactions or insights",
    },
    elements: [
      { name: "User Prompts/Inputs", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Chat Transcripts", category: "BEHAVIORAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "User Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "AI Model Outputs", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
    ],
    activity: {
      name: "AI-Powered Processing",
      purpose: "Provide AI-driven features including chatbots, content generation, and automated insights using user data",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Users", "Website visitors"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["AI service provider"],
      retentionPeriod: "90 days for training data, 1 year for transcripts",
      retentionDays: 365,
    },
    isHighRisk: true,
  },

  surveys: {
    label: "Surveys & Feedback",
    catalogCategories: [
      // VW canonical
      "Surveys & Research",
      // VW subcategories
      "Surveys", "Feedback", "Reviews",
      // Legacy
      "Online Surveys", "Site Optimization",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Survey and feedback collection platform",
    },
    elements: [
      { name: "Respondent Email", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Survey Responses", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "NPS/Satisfaction Scores", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Free-text Comments", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Survey & Feedback Collection",
      purpose: "Collect user feedback through surveys to measure satisfaction and improve products/services",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Customers", "Users", "Employees"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Survey platform provider"],
      retentionPeriod: "2 years",
      retentionDays: 730,
    },
    isHighRisk: false,
  },

  events: {
    label: "Events & Webinars",
    catalogCategories: [
      "Event Management",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Event management and registration platform",
    },
    elements: [
      { name: "Attendee Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Company & Job Title", category: "EMPLOYMENT", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Dietary Requirements", category: "HEALTH", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: true },
      { name: "Registration Details", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Event Registration & Management",
      purpose: "Manage event registrations, attendee data, and post-event communications",
      legalBasis: "CONTRACT",
      dataSubjects: ["Event attendees", "Registrants"],
      categories: ["IDENTIFIERS", "EMPLOYMENT", "BEHAVIORAL"],
      recipients: ["Event platform provider", "Venue"],
      retentionPeriod: "1 year after event",
      retentionDays: 365,
    },
    isHighRisk: false,
  },

  tag_management: {
    label: "Tag Management",
    catalogCategories: [
      // VW subcategory
      "Tag Management",
      // Legacy
      "Tag Management Platform",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Tag management system controlling third-party scripts and data collection",
    },
    elements: [
      { name: "Page URLs", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Event Data", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Cookie Data", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "User Agent", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Tag & Script Management",
      purpose: "Manage website tags and third-party scripts, controlling data collection and distribution to analytics/marketing tools",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Website visitors"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Tag management provider", "Connected third-party tools"],
      retentionPeriod: "As per connected tool policies",
      retentionDays: undefined,
    },
    isHighRisk: false,
  },

  messaging: {
    label: "Communication & Messaging",
    catalogCategories: [
      // Legacy
      "B2C video messaging",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Business-to-consumer messaging and video communication platform",
    },
    elements: [
      { name: "Recipient Contact Info", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Message Content", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Video Recordings", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Delivery/Read Receipts", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Customer Messaging",
      purpose: "Send personalized video and text messages to customers for engagement and support",
      legalBasis: "CONSENT",
      dataSubjects: ["Customers", "Prospects"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["Messaging platform provider"],
      retentionPeriod: "1 year",
      retentionDays: 365,
    },
    isHighRisk: false,
  },

  // ──────────────────────────────────────────────────
  // NEW GROUPS — VW canonical categories with no prior match
  // ──────────────────────────────────────────────────

  payment: {
    label: "Payment Processing",
    catalogCategories: [
      "Payment Processing",
      // VW subcategories
      "Gateway", "Invoicing", "Fraud Detection",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Payment processing gateway handling financial transactions",
    },
    elements: [
      { name: "Cardholder Name", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Payment Card Data (tokenized)", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
      { name: "Billing Address", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Transaction Records", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Fraud Signals", category: "BEHAVIORAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Payment Processing",
      purpose: "Process financial transactions, verify payment methods, and detect fraudulent activity",
      legalBasis: "CONTRACT",
      dataSubjects: ["Customers", "Buyers"],
      categories: ["IDENTIFIERS", "FINANCIAL", "BEHAVIORAL"],
      recipients: ["Payment processor", "Card networks", "Fraud detection provider"],
      retentionPeriod: "7 years (legal/tax requirement)",
      retentionDays: 2555,
    },
    isHighRisk: false,
  },

  hr: {
    label: "HR & People",
    catalogCategories: [
      "HR & People",
      // VW subcategories
      "HRIS", "Recruiting", "Payroll",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Human resources management system processing employee and candidate data",
    },
    elements: [
      { name: "Employee Name & Contact", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "National ID / Tax Number", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
      { name: "Salary & Compensation", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
      { name: "Employment History", category: "EMPLOYMENT", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Performance Records", category: "EMPLOYMENT", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "HR & Employee Management",
      purpose: "Manage employee lifecycle including recruitment, onboarding, payroll, and performance tracking",
      legalBasis: "CONTRACT",
      dataSubjects: ["Employees", "Job candidates", "Contractors"],
      categories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
      recipients: ["HR platform provider", "Payroll provider"],
      retentionPeriod: "Duration of employment + 7 years",
      retentionDays: 2555,
    },
    isHighRisk: true,
  },

  developer: {
    label: "Developer Tools",
    catalogCategories: [
      "Developer Tools",
      // VW subcategories
      "Observability", "DevOps", "Error Tracking", "Feature Flags",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Developer tooling for application monitoring, deployment, and quality assurance",
    },
    elements: [
      { name: "Server Logs", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Error Stack Traces", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
      { name: "User Session Context", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "IP Addresses", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Application Monitoring & DevOps",
      purpose: "Monitor application health, track errors, manage deployments, and control feature rollouts",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Users", "Developers"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["DevOps tool provider"],
      retentionPeriod: "90 days for logs, 1 year for metrics",
      retentionDays: 365,
    },
    isHighRisk: false,
  },

  security: {
    label: "Security & Identity",
    catalogCategories: [
      "Security & Identity",
      // VW subcategories
      "SIEM", "IAM", "Endpoint Security",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Security and identity management platform protecting systems and user access",
    },
    elements: [
      { name: "User Credentials (hashed)", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
      { name: "Access Logs", category: "BEHAVIORAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "IP Addresses", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Device Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Security Events", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: false, isSpecialCategory: false },
    ],
    activity: {
      name: "Security & Access Management",
      purpose: "Authenticate users, manage access control, detect security threats, and maintain audit trails",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Employees", "Users", "System administrators"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["Security platform provider"],
      retentionPeriod: "1 year for access logs, 2 years for security events",
      retentionDays: 730,
    },
    isHighRisk: false,
  },

  privacy: {
    label: "Privacy & Consent",
    catalogCategories: [
      "Privacy & Consent",
      // VW subcategories
      "Cookie Compliance", "Consent Management", "Data Governance",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Privacy management and consent collection platform",
    },
    elements: [
      { name: "Consent Records", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Cookie Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "User Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Data Subject Requests", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Privacy & Consent Management",
      purpose: "Collect and manage user consent preferences, handle cookie compliance, and support data governance processes",
      legalBasis: "LEGAL_OBLIGATION",
      dataSubjects: ["Website visitors", "Customers", "Data subjects"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["Consent management provider"],
      retentionPeriod: "5 years (proof of consent)",
      retentionDays: 1825,
    },
    isHighRisk: false,
  },

  productivity: {
    label: "Productivity & Collaboration",
    catalogCategories: [
      "Productivity & Collaboration",
      // VW subcategories
      "Workplace", "Project Management", "File Sharing",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Collaboration and productivity tools for team communication and project management",
    },
    elements: [
      { name: "User Profiles", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Messages & Comments", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Shared Files", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Activity Logs", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Team Collaboration",
      purpose: "Enable team communication, project tracking, and file sharing across the organization",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Employees", "Contractors", "External collaborators"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["Collaboration tool provider"],
      retentionPeriod: "Duration of account + 1 year",
      retentionDays: 365,
    },
    isHighRisk: false,
  },

  legal: {
    label: "Legal & Compliance",
    catalogCategories: [
      "Legal & Compliance",
      // VW subcategories
      "RegTech", "E-Signature",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Legal and compliance technology platform",
    },
    elements: [
      { name: "Signatory Name & Email", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Contract/Document Content", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Digital Signatures", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Audit Trail", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Legal Document Management",
      purpose: "Manage contracts, collect digital signatures, and ensure regulatory compliance",
      legalBasis: "CONTRACT",
      dataSubjects: ["Customers", "Employees", "Business partners"],
      categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
      recipients: ["Legal tech provider"],
      retentionPeriod: "10 years (legal retention)",
      retentionDays: 3650,
    },
    isHighRisk: false,
  },

  design: {
    label: "Design & Creative",
    catalogCategories: [
      "Design & Creative",
      // VW subcategories
      "Design Tools", "Brand Management",
    ],
    asset: {
      type: "CLOUD_SERVICE",
      hostingType: "Cloud",
      description: "Design and creative tools for brand assets and visual content",
    },
    elements: [
      { name: "User Accounts", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
      { name: "Creative Assets", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
      { name: "Collaboration Data", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    ],
    activity: {
      name: "Design Asset Management",
      purpose: "Create, manage, and collaborate on visual content and brand assets",
      legalBasis: "LEGITIMATE_INTERESTS",
      dataSubjects: ["Employees", "Designers", "External collaborators"],
      categories: ["IDENTIFIERS", "BEHAVIORAL"],
      recipients: ["Design platform provider"],
      retentionPeriod: "Duration of account",
      retentionDays: undefined,
    },
    isHighRisk: false,
  },
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Find the mapping group for a given vendor catalog category string.
 * Returns undefined if no mapping exists (falls back to generic).
 */
export function findMappingForCategory(
  catalogCategory: string,
  subcategory?: string | null,
): VendorDataMapping | undefined {
  // Try subcategory first for more precise mapping
  // e.g. "Developer Tools" > "Tag Management" → tag_management instead of developer
  if (subcategory) {
    const subLower = subcategory.toLowerCase();
    for (const mapping of Object.values(VENDOR_DATA_MAPPINGS)) {
      if (mapping.catalogCategories.some(c => c.toLowerCase() === subLower)) {
        return mapping;
      }
    }
  }
  // Fall back to top-level category
  const lower = catalogCategory.toLowerCase();
  for (const mapping of Object.values(VENDOR_DATA_MAPPINGS)) {
    if (mapping.catalogCategories.some(c => c.toLowerCase() === lower)) {
      return mapping;
    }
  }
  return undefined;
}

/** Default/generic mapping used when a vendor's category doesn't match any known group */
export const GENERIC_VENDOR_MAPPING: VendorDataMapping = {
  label: "Third-Party Service",
  catalogCategories: [],
  asset: {
    type: "THIRD_PARTY",
    hostingType: "Cloud",
    description: "Third-party SaaS service processing data on behalf of the organization",
  },
  elements: [
    { name: "User Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
    { name: "Usage Data", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
  ],
  activity: {
    name: "Third-Party Data Processing",
    purpose: "Process personal data through a third-party service provider",
    legalBasis: "CONTRACT",
    dataSubjects: ["Users"],
    categories: ["IDENTIFIERS", "BEHAVIORAL"],
    recipients: ["Service provider"],
    retentionPeriod: "As per contract terms",
    retentionDays: undefined,
  },
  isHighRisk: false,
};

/**
 * Check if a country code requires a data transfer record
 * (i.e., not in the EU adequacy list).
 */
export function requiresTransferSafeguards(countryCode: string): boolean {
  return !EU_ADEQUATE_COUNTRIES.includes(countryCode.toUpperCase());
}
