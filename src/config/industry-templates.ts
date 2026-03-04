/**
 * Industry Templates for Privacy Program Quickstart
 *
 * Each template provides a pre-built privacy program scaffold with common
 * data assets, processing activities, data flows, and suggested vendor categories.
 */

import type { DataAssetType, DataCategory, DataSensitivity, LegalBasis } from "@prisma/client";

// ============================================================
// TYPES
// ============================================================

export interface IndustryAsset {
  name: string;
  type: DataAssetType;
  description: string;
  hostingType: string;
  owner: string;
  elements: {
    name: string;
    category: DataCategory;
    sensitivity: DataSensitivity;
    isPersonalData: boolean;
    isSpecialCategory: boolean;
    retentionDays?: number;
  }[];
}

export interface IndustryActivity {
  name: string;
  description: string;
  purpose: string;
  legalBasis: LegalBasis;
  dataSubjects: string[];
  categories: DataCategory[];
  recipients: string[];
  retentionPeriod: string;
  retentionDays?: number;
  /** Names of assets this activity uses (cross-references IndustryAsset.name) */
  assetNames: string[];
}

export interface IndustryFlow {
  name: string;
  description: string;
  /** Name of source asset (cross-references IndustryAsset.name) */
  sourceAssetName: string;
  /** Name of destination asset (cross-references IndustryAsset.name) */
  destAssetName: string;
  dataCategories: DataCategory[];
  frequency: string;
  isAutomated: boolean;
}

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  assets: IndustryAsset[];
  activities: IndustryActivity[];
  flows: IndustryFlow[];
  suggestedVendorCategories: string[];
}

// ============================================================
// TEMPLATES
// ============================================================

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  // ─────────────────────────────────────────────────
  // E-COMMERCE
  // ─────────────────────────────────────────────────
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Online retail with customer accounts, orders, payments, and marketing",
    icon: "ShoppingCart",
    assets: [
      {
        name: "Customer Database",
        type: "DATABASE",
        description: "Primary database storing customer accounts, profiles, and order history",
        hostingType: "Cloud",
        owner: "Engineering",
        elements: [
          { name: "Full Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Phone Number", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Shipping Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Billing Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Password Hash", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Date of Birth", category: "DEMOGRAPHICS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Order Management System",
        type: "APPLICATION",
        description: "Handles order processing, fulfillment, and returns",
        hostingType: "Cloud",
        owner: "Operations",
        elements: [
          { name: "Order Details", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Payment Token", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Delivery Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Return/Refund Records", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Marketing Platform",
        type: "CLOUD_SERVICE",
        description: "Email marketing, campaigns, and customer segmentation",
        hostingType: "Cloud",
        owner: "Marketing",
        elements: [
          { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Purchase History Segments", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Marketing Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Campaign Interactions", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Web Analytics",
        type: "CLOUD_SERVICE",
        description: "Website traffic analysis and conversion tracking",
        hostingType: "Cloud",
        owner: "Marketing",
        elements: [
          { name: "IP Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Browsing Behavior", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Device Information", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Conversion Events", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Payment Gateway",
        type: "THIRD_PARTY",
        description: "Payment processing via Stripe, PayPal, or similar provider",
        hostingType: "Cloud",
        owner: "Finance",
        elements: [
          { name: "Cardholder Name", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Card Last 4 Digits", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Transaction Records", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Billing Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
    ],
    activities: [
      {
        name: "Customer Account Management",
        description: "Registration, authentication, and profile management for customer accounts",
        purpose: "Enable customers to create accounts, manage their profiles, and track their orders",
        legalBasis: "CONTRACT",
        dataSubjects: ["Customers"],
        categories: ["IDENTIFIERS", "DEMOGRAPHICS"],
        recipients: ["Internal teams"],
        retentionPeriod: "Duration of account + 3 years",
        retentionDays: 1095,
        assetNames: ["Customer Database"],
      },
      {
        name: "Order Processing & Fulfillment",
        description: "Processing purchases, managing inventory, and coordinating delivery",
        purpose: "Process and fulfill customer orders including payment, shipping, and returns",
        legalBasis: "CONTRACT",
        dataSubjects: ["Customers"],
        categories: ["IDENTIFIERS", "FINANCIAL"],
        recipients: ["Payment processor", "Shipping providers", "Warehouse"],
        retentionPeriod: "7 years (tax/accounting)",
        retentionDays: 2555,
        assetNames: ["Customer Database", "Order Management System", "Payment Gateway"],
      },
      {
        name: "Marketing & Promotions",
        description: "Email campaigns, personalized recommendations, and loyalty programs",
        purpose: "Send marketing communications and personalized product recommendations to opted-in customers",
        legalBasis: "CONSENT",
        dataSubjects: ["Customers", "Subscribers"],
        categories: ["IDENTIFIERS", "BEHAVIORAL"],
        recipients: ["Email marketing provider"],
        retentionPeriod: "Until consent withdrawn",
        assetNames: ["Marketing Platform", "Customer Database"],
      },
      {
        name: "Website Analytics & Optimization",
        description: "Tracking website usage patterns to improve user experience and conversion rates",
        purpose: "Analyze website traffic and user behavior to optimize the shopping experience",
        legalBasis: "LEGITIMATE_INTERESTS",
        dataSubjects: ["Website visitors"],
        categories: ["IDENTIFIERS", "BEHAVIORAL"],
        recipients: ["Analytics provider"],
        retentionPeriod: "26 months",
        retentionDays: 790,
        assetNames: ["Web Analytics"],
      },
    ],
    flows: [
      {
        name: "Customer to Orders",
        description: "Customer profile data flows to order system during checkout",
        sourceAssetName: "Customer Database",
        destAssetName: "Order Management System",
        dataCategories: ["IDENTIFIERS", "FINANCIAL"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "Orders to Payment",
        description: "Order payment details sent to payment processor",
        sourceAssetName: "Order Management System",
        destAssetName: "Payment Gateway",
        dataCategories: ["FINANCIAL", "IDENTIFIERS"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "Customer to Marketing",
        description: "Customer segments synced to marketing platform for campaigns",
        sourceAssetName: "Customer Database",
        destAssetName: "Marketing Platform",
        dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
        frequency: "Daily",
        isAutomated: true,
      },
    ],
    suggestedVendorCategories: ["Payment Processing", "Email Marketing", "Digital Analytics", "Cloud Hosting"],
  },

  // ─────────────────────────────────────────────────
  // SAAS / TECHNOLOGY
  // ─────────────────────────────────────────────────
  {
    id: "saas",
    name: "SaaS / Technology",
    description: "Software-as-a-service platform with user accounts, usage tracking, and support",
    icon: "Cloud",
    assets: [
      {
        name: "User Database",
        type: "DATABASE",
        description: "Production database storing user accounts, workspace data, and application state",
        hostingType: "Cloud",
        owner: "Engineering",
        elements: [
          { name: "Full Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Password Hash", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Profile Avatar", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Organization/Workspace Data", category: "EMPLOYMENT", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Application Logs",
        type: "CLOUD_SERVICE",
        description: "Centralized logging and monitoring system (e.g., Datadog, Sentry)",
        hostingType: "Cloud",
        owner: "Engineering",
        elements: [
          { name: "IP Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "User Actions", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Error Traces", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: false, isSpecialCategory: false },
          { name: "Session Identifiers", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Support Ticketing System",
        type: "CLOUD_SERVICE",
        description: "Customer support platform for handling tickets and live chat",
        hostingType: "Cloud",
        owner: "Customer Success",
        elements: [
          { name: "Contact Name & Email", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Ticket Content", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Screenshots/Attachments", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Billing System",
        type: "CLOUD_SERVICE",
        description: "Subscription billing and invoicing (e.g., Stripe)",
        hostingType: "Cloud",
        owner: "Finance",
        elements: [
          { name: "Billing Contact", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Payment Method", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Invoice History", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Subscription Plan", category: "FINANCIAL", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
        ],
      },
      {
        name: "Product Analytics",
        type: "CLOUD_SERVICE",
        description: "Product usage analytics for feature adoption and retention",
        hostingType: "Cloud",
        owner: "Product",
        elements: [
          { name: "User ID", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Feature Usage Events", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Session Data", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
    ],
    activities: [
      {
        name: "User Account Provisioning",
        description: "User registration, workspace creation, and SSO integration",
        purpose: "Create and manage user accounts, handle authentication, and provision workspace resources",
        legalBasis: "CONTRACT",
        dataSubjects: ["Customers", "End users"],
        categories: ["IDENTIFIERS", "EMPLOYMENT"],
        recipients: ["Internal teams"],
        retentionPeriod: "Duration of subscription + 90 days",
        retentionDays: 90,
        assetNames: ["User Database"],
      },
      {
        name: "Service Delivery & Processing",
        description: "Core application processing of user data as part of the SaaS service",
        purpose: "Deliver the contracted SaaS service by processing user data within the application",
        legalBasis: "CONTRACT",
        dataSubjects: ["End users"],
        categories: ["IDENTIFIERS", "BEHAVIORAL", "OTHER"],
        recipients: ["Sub-processors (cloud infrastructure)"],
        retentionPeriod: "Duration of subscription + 30 days for deletion",
        retentionDays: 30,
        assetNames: ["User Database", "Application Logs"],
      },
      {
        name: "Subscription Billing",
        description: "Recurring billing, invoicing, and payment processing",
        purpose: "Process subscription payments, generate invoices, and manage billing lifecycle",
        legalBasis: "CONTRACT",
        dataSubjects: ["Billing contacts", "Account administrators"],
        categories: ["IDENTIFIERS", "FINANCIAL"],
        recipients: ["Payment processor", "Tax authorities"],
        retentionPeriod: "7 years (tax/accounting)",
        retentionDays: 2555,
        assetNames: ["Billing System", "User Database"],
      },
      {
        name: "Customer Support",
        description: "Handling support tickets, live chat, and escalations",
        purpose: "Provide customer support, troubleshoot issues, and maintain service quality",
        legalBasis: "CONTRACT",
        dataSubjects: ["Customers", "End users"],
        categories: ["IDENTIFIERS", "OTHER"],
        recipients: ["Support platform provider"],
        retentionPeriod: "3 years after ticket closure",
        retentionDays: 1095,
        assetNames: ["Support Ticketing System", "User Database"],
      },
      {
        name: "Product Analytics & Improvement",
        description: "Tracking feature usage, measuring adoption, and A/B testing",
        purpose: "Analyze product usage patterns to improve features, fix usability issues, and guide product roadmap",
        legalBasis: "LEGITIMATE_INTERESTS",
        dataSubjects: ["End users"],
        categories: ["IDENTIFIERS", "BEHAVIORAL"],
        recipients: ["Analytics provider"],
        retentionPeriod: "26 months",
        retentionDays: 790,
        assetNames: ["Product Analytics"],
      },
    ],
    flows: [
      {
        name: "User Actions to Logs",
        description: "Application events and errors sent to centralized logging",
        sourceAssetName: "User Database",
        destAssetName: "Application Logs",
        dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "User to Billing",
        description: "Account data synced to billing system for subscription management",
        sourceAssetName: "User Database",
        destAssetName: "Billing System",
        dataCategories: ["IDENTIFIERS", "FINANCIAL"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "User to Analytics",
        description: "Product usage events streamed to analytics platform",
        sourceAssetName: "User Database",
        destAssetName: "Product Analytics",
        dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
        frequency: "Real-time",
        isAutomated: true,
      },
    ],
    suggestedVendorCategories: ["Cloud Hosting", "Customer Communications Platform", "Digital Analytics", "CRM"],
  },

  // ─────────────────────────────────────────────────
  // HEALTHCARE
  // ─────────────────────────────────────────────────
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Healthcare provider or health-tech with patient data, EHR, and regulatory compliance",
    icon: "Heart",
    assets: [
      {
        name: "Electronic Health Records (EHR)",
        type: "APPLICATION",
        description: "Primary clinical system storing patient medical records",
        hostingType: "Cloud",
        owner: "Clinical IT",
        elements: [
          { name: "Patient Name", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Date of Birth", category: "DEMOGRAPHICS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "National ID / Insurance Number", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Medical Diagnoses", category: "HEALTH", sensitivity: "SPECIAL_CATEGORY", isPersonalData: true, isSpecialCategory: true },
          { name: "Treatment Records", category: "HEALTH", sensitivity: "SPECIAL_CATEGORY", isPersonalData: true, isSpecialCategory: true },
          { name: "Prescription Data", category: "HEALTH", sensitivity: "SPECIAL_CATEGORY", isPersonalData: true, isSpecialCategory: true },
          { name: "Lab Results", category: "HEALTH", sensitivity: "SPECIAL_CATEGORY", isPersonalData: true, isSpecialCategory: true },
        ],
      },
      {
        name: "Patient Portal",
        type: "APPLICATION",
        description: "Online portal for patients to access records and book appointments",
        hostingType: "Cloud",
        owner: "Digital Health",
        elements: [
          { name: "Login Credentials", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Contact Information", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Appointment History", category: "HEALTH", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: true },
          { name: "Messages to Providers", category: "HEALTH", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: true },
        ],
      },
      {
        name: "Billing & Insurance System",
        type: "APPLICATION",
        description: "Medical billing, insurance claims, and patient financial records",
        hostingType: "Cloud",
        owner: "Finance",
        elements: [
          { name: "Insurance Policy Number", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Billing Codes (ICD/CPT)", category: "HEALTH", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: true },
          { name: "Payment Records", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Patient Address", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Staff HR System",
        type: "APPLICATION",
        description: "HR system for clinical and administrative staff",
        hostingType: "Cloud",
        owner: "Human Resources",
        elements: [
          { name: "Employee Name & Contact", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Professional Licenses", category: "EMPLOYMENT", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Payroll Data", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Background Check Results", category: "CRIMINAL", sensitivity: "SPECIAL_CATEGORY", isPersonalData: true, isSpecialCategory: true },
        ],
      },
    ],
    activities: [
      {
        name: "Patient Care & Treatment",
        description: "Recording and managing patient clinical data for treatment purposes",
        purpose: "Provide healthcare services, record diagnoses and treatments, and maintain continuity of care",
        legalBasis: "VITAL_INTERESTS",
        dataSubjects: ["Patients"],
        categories: ["IDENTIFIERS", "HEALTH", "DEMOGRAPHICS"],
        recipients: ["Healthcare providers", "Referring specialists"],
        retentionPeriod: "10 years after last treatment (or as per law)",
        retentionDays: 3650,
        assetNames: ["Electronic Health Records (EHR)", "Patient Portal"],
      },
      {
        name: "Medical Billing & Insurance",
        description: "Processing insurance claims, generating invoices, and managing payments",
        purpose: "Process insurance claims and patient billing for healthcare services rendered",
        legalBasis: "LEGAL_OBLIGATION",
        dataSubjects: ["Patients", "Insurance holders"],
        categories: ["IDENTIFIERS", "FINANCIAL", "HEALTH"],
        recipients: ["Insurance companies", "Billing clearinghouse"],
        retentionPeriod: "7 years (financial records)",
        retentionDays: 2555,
        assetNames: ["Billing & Insurance System", "Electronic Health Records (EHR)"],
      },
      {
        name: "Staff Employment Management",
        description: "Managing employee records, credentials, and compliance",
        purpose: "Manage healthcare staff employment, verify professional credentials, and ensure regulatory compliance",
        legalBasis: "CONTRACT",
        dataSubjects: ["Employees", "Clinical staff"],
        categories: ["IDENTIFIERS", "EMPLOYMENT", "FINANCIAL", "CRIMINAL"],
        recipients: ["HR platform provider", "Regulatory bodies"],
        retentionPeriod: "Duration of employment + 6 years",
        retentionDays: 2190,
        assetNames: ["Staff HR System"],
      },
    ],
    flows: [
      {
        name: "EHR to Patient Portal",
        description: "Patient records made available through the patient-facing portal",
        sourceAssetName: "Electronic Health Records (EHR)",
        destAssetName: "Patient Portal",
        dataCategories: ["IDENTIFIERS", "HEALTH"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "EHR to Billing",
        description: "Clinical encounter data sent to billing system for claims processing",
        sourceAssetName: "Electronic Health Records (EHR)",
        destAssetName: "Billing & Insurance System",
        dataCategories: ["IDENTIFIERS", "HEALTH", "FINANCIAL"],
        frequency: "Daily",
        isAutomated: true,
      },
    ],
    suggestedVendorCategories: ["Cloud Hosting", "Customer Communications Platform"],
  },

  // ─────────────────────────────────────────────────
  // FINTECH
  // ─────────────────────────────────────────────────
  {
    id: "fintech",
    name: "Fintech",
    description: "Financial technology with KYC, transaction processing, and regulatory reporting",
    icon: "Landmark",
    assets: [
      {
        name: "KYC/Identity Verification System",
        type: "APPLICATION",
        description: "Know Your Customer platform for identity verification and AML screening",
        hostingType: "Cloud",
        owner: "Compliance",
        elements: [
          { name: "Full Legal Name", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Government ID (Passport/Driver License)", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Selfie/Facial Scan", category: "BIOMETRIC", sensitivity: "SPECIAL_CATEGORY", isPersonalData: true, isSpecialCategory: true },
          { name: "Address Proof", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "PEP/Sanctions Screening Results", category: "CRIMINAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: true },
        ],
      },
      {
        name: "Transaction Ledger",
        type: "DATABASE",
        description: "Core transaction processing database with financial records",
        hostingType: "Cloud",
        owner: "Engineering",
        elements: [
          { name: "Account Holder Name", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Account Number/IBAN", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Transaction Records", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Balance Information", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Beneficiary Details", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Customer Account System",
        type: "APPLICATION",
        description: "User-facing account management and dashboard",
        hostingType: "Cloud",
        owner: "Product",
        elements: [
          { name: "Email & Phone", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Login & MFA Data", category: "IDENTIFIERS", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Notification Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Linked Bank Accounts", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Regulatory Reporting System",
        type: "APPLICATION",
        description: "Automated reporting to financial regulators (SAR, CTR)",
        hostingType: "Cloud",
        owner: "Compliance",
        elements: [
          { name: "Suspicious Activity Reports", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Currency Transaction Reports", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Customer Risk Profiles", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
    ],
    activities: [
      {
        name: "Customer Onboarding & KYC",
        description: "Identity verification, document collection, and AML screening during sign-up",
        purpose: "Verify customer identity, comply with KYC/AML regulations, and prevent financial fraud",
        legalBasis: "LEGAL_OBLIGATION",
        dataSubjects: ["Customers", "Applicants"],
        categories: ["IDENTIFIERS", "BIOMETRIC", "CRIMINAL"],
        recipients: ["Identity verification provider", "Regulators"],
        retentionPeriod: "5 years after account closure (AML requirement)",
        retentionDays: 1825,
        assetNames: ["KYC/Identity Verification System", "Customer Account System"],
      },
      {
        name: "Transaction Processing",
        description: "Processing financial transactions, transfers, and settlements",
        purpose: "Execute financial transactions on behalf of customers as part of the contracted service",
        legalBasis: "CONTRACT",
        dataSubjects: ["Customers", "Beneficiaries"],
        categories: ["IDENTIFIERS", "FINANCIAL"],
        recipients: ["Banking partners", "Payment networks", "Clearing houses"],
        retentionPeriod: "7 years (financial regulation)",
        retentionDays: 2555,
        assetNames: ["Transaction Ledger", "Customer Account System"],
      },
      {
        name: "AML Monitoring & Regulatory Reporting",
        description: "Ongoing transaction monitoring and filing required regulatory reports",
        purpose: "Monitor transactions for suspicious activity and file mandatory reports with financial regulators",
        legalBasis: "LEGAL_OBLIGATION",
        dataSubjects: ["Customers"],
        categories: ["IDENTIFIERS", "FINANCIAL", "CRIMINAL"],
        recipients: ["Financial regulators", "Law enforcement (on request)"],
        retentionPeriod: "5 years after filing",
        retentionDays: 1825,
        assetNames: ["Transaction Ledger", "Regulatory Reporting System", "KYC/Identity Verification System"],
      },
    ],
    flows: [
      {
        name: "KYC to Account",
        description: "Verified identity data provisioned to customer account",
        sourceAssetName: "KYC/Identity Verification System",
        destAssetName: "Customer Account System",
        dataCategories: ["IDENTIFIERS"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "Transactions to Monitoring",
        description: "Transaction data fed to regulatory monitoring system",
        sourceAssetName: "Transaction Ledger",
        destAssetName: "Regulatory Reporting System",
        dataCategories: ["FINANCIAL", "IDENTIFIERS"],
        frequency: "Real-time",
        isAutomated: true,
      },
    ],
    suggestedVendorCategories: ["Cloud Hosting", "Identity Resolution", "Customer Communications Platform"],
  },

  // ─────────────────────────────────────────────────
  // MEDIA / PUBLISHING
  // ─────────────────────────────────────────────────
  {
    id: "media",
    name: "Media / Publishing",
    description: "Digital media, news, or content platform with subscriptions and advertising",
    icon: "Newspaper",
    assets: [
      {
        name: "Subscriber Database",
        type: "DATABASE",
        description: "Database of registered users and paying subscribers",
        hostingType: "Cloud",
        owner: "Product",
        elements: [
          { name: "Full Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Subscription Plan", category: "FINANCIAL", sensitivity: "INTERNAL", isPersonalData: false, isSpecialCategory: false },
          { name: "Payment Method", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Reading Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Content Management System",
        type: "APPLICATION",
        description: "Editorial CMS for publishing articles, videos, and podcasts",
        hostingType: "Cloud",
        owner: "Editorial",
        elements: [
          { name: "Author Profiles", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "User Comments", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "User-Generated Content", category: "OTHER", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Ad Tech Platform",
        type: "CLOUD_SERVICE",
        description: "Programmatic advertising and audience targeting system",
        hostingType: "Cloud",
        owner: "Revenue",
        elements: [
          { name: "Cookie/Device IDs", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Content Consumption Patterns", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Interest Segments", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Ad Interaction Data", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Newsletter Platform",
        type: "CLOUD_SERVICE",
        description: "Email newsletter distribution and subscriber management",
        hostingType: "Cloud",
        owner: "Growth",
        elements: [
          { name: "Email Address", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Open/Click Rates", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Topic Preferences", category: "BEHAVIORAL", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
    ],
    activities: [
      {
        name: "Subscription Management",
        description: "Managing paid subscriptions, billing, and access control",
        purpose: "Manage subscriber accounts, process payments, and control access to premium content",
        legalBasis: "CONTRACT",
        dataSubjects: ["Subscribers"],
        categories: ["IDENTIFIERS", "FINANCIAL", "BEHAVIORAL"],
        recipients: ["Payment processor"],
        retentionPeriod: "Duration of subscription + 3 years",
        retentionDays: 1095,
        assetNames: ["Subscriber Database"],
      },
      {
        name: "Programmatic Advertising",
        description: "Serving targeted ads based on reading behavior and audience segments",
        purpose: "Display relevant advertisements to fund content production, using audience segmentation based on reading behavior",
        legalBasis: "CONSENT",
        dataSubjects: ["Website visitors", "Readers"],
        categories: ["IDENTIFIERS", "BEHAVIORAL"],
        recipients: ["Ad networks", "Demand-side platforms", "Advertisers"],
        retentionPeriod: "13 months",
        retentionDays: 395,
        assetNames: ["Ad Tech Platform", "Subscriber Database"],
      },
      {
        name: "Newsletter Distribution",
        description: "Sending editorial newsletters and managing subscriber preferences",
        purpose: "Distribute newsletter content to opted-in subscribers and track engagement for editorial optimization",
        legalBasis: "CONSENT",
        dataSubjects: ["Subscribers", "Newsletter signups"],
        categories: ["IDENTIFIERS", "BEHAVIORAL"],
        recipients: ["Email service provider"],
        retentionPeriod: "Until unsubscribe + 30 days",
        assetNames: ["Newsletter Platform", "Subscriber Database"],
      },
      {
        name: "Content Personalization",
        description: "Recommending articles and content based on reading history",
        purpose: "Provide personalized content recommendations to improve reader engagement and satisfaction",
        legalBasis: "LEGITIMATE_INTERESTS",
        dataSubjects: ["Readers", "Subscribers"],
        categories: ["IDENTIFIERS", "BEHAVIORAL"],
        recipients: ["Internal teams"],
        retentionPeriod: "26 months",
        retentionDays: 790,
        assetNames: ["Content Management System", "Subscriber Database"],
      },
    ],
    flows: [
      {
        name: "Subscribers to Ad Platform",
        description: "Audience segments shared with ad tech for targeting",
        sourceAssetName: "Subscriber Database",
        destAssetName: "Ad Tech Platform",
        dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
        frequency: "Daily",
        isAutomated: true,
      },
      {
        name: "Subscribers to Newsletter",
        description: "Subscriber data synced to newsletter platform",
        sourceAssetName: "Subscriber Database",
        destAssetName: "Newsletter Platform",
        dataCategories: ["IDENTIFIERS", "BEHAVIORAL"],
        frequency: "Real-time",
        isAutomated: true,
      },
    ],
    suggestedVendorCategories: ["Email Marketing", "Digital Analytics", "Retargeting", "Content Management Platform"],
  },

  // ─────────────────────────────────────────────────
  // PROFESSIONAL SERVICES
  // ─────────────────────────────────────────────────
  {
    id: "professional_services",
    name: "Professional Services",
    description: "Consulting, legal, accounting, or agency with client data and project management",
    icon: "Briefcase",
    assets: [
      {
        name: "Client Database",
        type: "DATABASE",
        description: "CRM and client relationship management system",
        hostingType: "Cloud",
        owner: "Business Development",
        elements: [
          { name: "Client Contact Name", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Email & Phone", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Company & Role", category: "EMPLOYMENT", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Engagement History", category: "BEHAVIORAL", sensitivity: "CONFIDENTIAL", isPersonalData: false, isSpecialCategory: false },
        ],
      },
      {
        name: "Project Management System",
        type: "CLOUD_SERVICE",
        description: "Project tracking, document sharing, and collaboration platform",
        hostingType: "Cloud",
        owner: "Operations",
        elements: [
          { name: "Project Documents", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Client Communications", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Time Tracking", category: "EMPLOYMENT", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Deliverable Files", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: false, isSpecialCategory: false },
        ],
      },
      {
        name: "HR & Payroll System",
        type: "CLOUD_SERVICE",
        description: "Employee management, payroll, and benefits administration",
        hostingType: "Cloud",
        owner: "Human Resources",
        elements: [
          { name: "Employee Personal Details", category: "IDENTIFIERS", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "Salary & Compensation", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Bank Account Details", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Tax Information", category: "FINANCIAL", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Emergency Contacts", category: "IDENTIFIERS", sensitivity: "INTERNAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
      {
        name: "Document Management",
        type: "CLOUD_SERVICE",
        description: "Secure document storage for contracts, proposals, and client files",
        hostingType: "Cloud",
        owner: "Operations",
        elements: [
          { name: "Client Contracts", category: "OTHER", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
          { name: "NDAs & Legal Docs", category: "OTHER", sensitivity: "RESTRICTED", isPersonalData: true, isSpecialCategory: false },
          { name: "Financial Reports", category: "FINANCIAL", sensitivity: "CONFIDENTIAL", isPersonalData: true, isSpecialCategory: false },
        ],
      },
    ],
    activities: [
      {
        name: "Client Relationship Management",
        description: "Managing client contacts, engagements, and business development pipeline",
        purpose: "Manage client relationships, track engagements, and support business development efforts",
        legalBasis: "CONTRACT",
        dataSubjects: ["Clients", "Prospects", "Business contacts"],
        categories: ["IDENTIFIERS", "EMPLOYMENT", "BEHAVIORAL"],
        recipients: ["CRM provider", "Internal teams"],
        retentionPeriod: "Duration of relationship + 5 years",
        retentionDays: 1825,
        assetNames: ["Client Database"],
      },
      {
        name: "Service Delivery & Project Work",
        description: "Executing client engagements, managing deliverables, and collaborating on projects",
        purpose: "Deliver contracted professional services, manage project workflows, and maintain engagement records",
        legalBasis: "CONTRACT",
        dataSubjects: ["Clients", "Client employees"],
        categories: ["IDENTIFIERS", "OTHER"],
        recipients: ["Project management platform", "Subcontractors (where applicable)"],
        retentionPeriod: "Duration of engagement + 7 years",
        retentionDays: 2555,
        assetNames: ["Project Management System", "Document Management"],
      },
      {
        name: "Employee HR & Payroll",
        description: "Managing employee records, payroll processing, and benefits administration",
        purpose: "Manage employment lifecycle, process payroll, and fulfill employment obligations",
        legalBasis: "CONTRACT",
        dataSubjects: ["Employees", "Contractors"],
        categories: ["IDENTIFIERS", "FINANCIAL", "EMPLOYMENT"],
        recipients: ["Payroll provider", "Tax authorities", "Benefits providers"],
        retentionPeriod: "Duration of employment + 7 years",
        retentionDays: 2555,
        assetNames: ["HR & Payroll System"],
      },
    ],
    flows: [
      {
        name: "Client to Projects",
        description: "Client data referenced in project management for engagement delivery",
        sourceAssetName: "Client Database",
        destAssetName: "Project Management System",
        dataCategories: ["IDENTIFIERS"],
        frequency: "Real-time",
        isAutomated: true,
      },
      {
        name: "Projects to Documents",
        description: "Project deliverables and files stored in document management",
        sourceAssetName: "Project Management System",
        destAssetName: "Document Management",
        dataCategories: ["OTHER"],
        frequency: "Daily",
        isAutomated: true,
      },
    ],
    suggestedVendorCategories: ["CRM", "Cloud Hosting", "Customer Communications Platform"],
  },
];

// ============================================================
// HELPERS
// ============================================================

export function getTemplateById(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find(t => t.id === id);
}

export function getTemplateIds(): string[] {
  return INDUSTRY_TEMPLATES.map(t => t.id);
}
