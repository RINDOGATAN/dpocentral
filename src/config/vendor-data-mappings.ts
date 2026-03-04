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
      "Digital Analytics", "Advanced Analytics", "Integrated Analytics",
      "Mobile App Analytics", "Video Analytics", "Data Layer Optimization",
      "AB Testing", "Digital Experience Optimization", "Session Replay",
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
      "Email Marketing", "Marketing Automation", "Retargeting",
      "Lead Generation", "Lead Capturing", "Account Based Marketing",
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
      "CRM", "Sales Enablement", "Customer Journey Orchestration",
      "Customer Sign-up", "Conversion Optimization", "Cart Abandonment",
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
      "Customer Data Platform", "DMP", "Data Management Platform",
      "Identity Resolution", "Data Clean Room",
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
      "Cloud Hosting", "Data warehouse", "Reverse ETL", "API Integration",
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
    label: "Content Management",
    catalogCategories: [
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
    label: "AI & Chatbot",
    catalogCategories: [
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
    label: "B2C Messaging",
    catalogCategories: [
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
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Find the mapping group for a given vendor catalog category string.
 * Returns undefined if no mapping exists (falls back to generic).
 */
export function findMappingForCategory(catalogCategory: string): VendorDataMapping | undefined {
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
