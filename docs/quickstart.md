# Privacy Program Quickstart

DPO Central's **Quickstart** feature helps new organizations bootstrap a complete privacy program in minutes instead of hours. It's available at **Dashboard > Get Started** (or directly at `/privacy/quickstart`) and offers two complementary approaches that can be used independently or combined.

---

## Overview

| Approach | Direction | What it does | Pricing |
|----------|-----------|--------------|---------|
| **Vendor Import** | Bottom-up | Select vendors you already use; auto-generates data assets, elements, processing activities, and data transfers from each vendor's known data profile | Requires **Vendor Catalog** entitlement |
| **Industry Template** | Top-down | Choose your industry; get a pre-built scaffold of internal data assets, processing activities, and data flows | Free (AGPL core) |

Both approaches are **non-destructive** — they only create new records and never modify or delete existing ones. Duplicate names are automatically skipped.

---

## Bottom-Up: Vendor Import

### How it works

1. User searches the Vendor Catalog (400+ pre-audited SaaS vendors)
2. Selects the vendors their organization actually uses (multi-select, up to 20)
3. For each vendor, the system looks up the vendor's **catalog category** and maps it to a predefined data profile
4. A preview shows exactly what will be created per vendor
5. On confirmation, a single database transaction creates all records

### What gets created per vendor

| Record type | Example (for a "Digital Analytics" vendor like Google Analytics) |
|-------------|---------------------------------------------------------------|
| **Vendor** | Google Analytics, status: Prospective, categories: ["Digital Analytics"] |
| **Data Asset** | "Google Analytics (Analytics & BI)", type: CLOUD_SERVICE |
| **Data Elements** | IP Address, Device Fingerprint, Page Views, Session Duration, Click Events, Referral Source, Browser & OS, Geolocation |
| **Processing Activity** | "Website/App Analytics — Google Analytics", legal basis: Legitimate Interests |
| **Data Transfers** | Auto-created for each non-EU data location with Standard Contractual Clauses |

### Category mapping groups

Vendor catalog categories are mapped into 12 groups, each with a tailored data profile:

| Group | Catalog categories covered | Typical elements |
|-------|---------------------------|------------------|
| Analytics & BI | Digital Analytics, Advanced Analytics, Integrated Analytics, Mobile App Analytics, Video Analytics, Data Layer Optimization, AB Testing, Digital Experience Optimization, Session Replay | IP Address, Device Fingerprint, Page Views, Session Data, Click Events |
| Marketing & Advertising | Email Marketing, Marketing Automation, Retargeting, Lead Generation, Lead Capturing, Account Based Marketing, Social Media Automation, Social Management, Social Sharing, Web Creative Automation, Personalization, Buyer Profiling | Email, Name, Company, Marketing Preferences, Campaign Interactions, Cookies |
| CRM & Sales | CRM, Sales Enablement, Customer Journey Orchestration, Customer Sign-up, Conversion Optimization, Cart Abandonment | Name, Email, Phone, Company & Job Title, Deal Data, Communication History |
| Customer Data Platform | Customer Data Platform, DMP, Data Management Platform, Identity Resolution, Data Clean Room | Unified Profile, Cross-device IDs, Behavioral Segments, Transaction History |
| Cloud Infrastructure | Cloud Hosting, Data warehouse, Reverse ETL, API Integration | Application Data, Server Logs, Stored Records, Backups |
| Content Management | Content Management Platform, Content Curation, Online store management, Enterprise Ecommerce, eCommerce Platform | User Accounts, Orders, Shipping Address, Content Interactions |
| Customer Support | Customer Communications Platform, Call tracking | Name, Email, Phone, Ticket Content, Call Recordings |
| AI & Chatbot | AI Bot, AI Chatbot, AI SEO, AI Widget, AI-driven data insights | User Prompts, Chat Transcripts, User Identifiers |
| Surveys & Feedback | Online Surveys, Site Optimization | Respondent Email, Survey Responses, NPS Scores |
| Events & Webinars | Event Management | Attendee Name, Email, Company, Dietary Requirements |
| Tag Management | Tag Management Platform | Page URLs, Event Data, Cookie Data, User Agent |
| B2C Messaging | B2C video messaging | Contact Info, Message Content, Video Recordings |

Vendors whose category doesn't match any group get a **generic "Third-Party Service"** mapping with basic identifiers and usage data elements.

### Data transfer detection

When a vendor's `dataLocations` includes countries outside the EU/EEA adequacy list, the system automatically creates **DataTransfer** records with:
- Mechanism: Standard Contractual Clauses (SCCs)
- Safeguards: "SCCs with supplementary measures"
- Linked to the vendor's processing activity

The adequacy list includes all EU/EEA member states plus countries with active EU adequacy decisions (UK, Japan, South Korea, Switzerland, Canada, Argentina, etc.).

### Entitlement gating

Vendor import requires the **Vendor Catalog** entitlement (`com.nel.dpocentral.vendor-catalog`) or the **Complete** package. Organizations without access see the vendor card as locked with a "Premium" badge.

---

## Top-Down: Industry Template

### How it works

1. User selects from 6 industry templates
2. An expandable preview shows all assets, activities, and flows in the template
3. Items that already exist in the organization are marked and automatically skipped
4. On confirmation, a single transaction creates all records with correct cross-references

### Available templates

#### E-commerce
For online retail with customer accounts, orders, payments, and marketing.

- **Assets (5):** Customer Database, Order Management System, Marketing Platform, Web Analytics, Payment Gateway
- **Activities (4):** Customer Account Management, Order Processing & Fulfillment, Marketing & Promotions, Website Analytics & Optimization
- **Flows (3):** Customer to Orders, Orders to Payment, Customer to Marketing

#### SaaS / Technology
For software-as-a-service platforms with user accounts, usage tracking, and support.

- **Assets (5):** User Database, Application Logs, Support Ticketing System, Billing System, Product Analytics
- **Activities (5):** User Account Provisioning, Service Delivery & Processing, Subscription Billing, Customer Support, Product Analytics & Improvement
- **Flows (3):** User Actions to Logs, User to Billing, User to Analytics

#### Healthcare
For healthcare providers or health-tech with patient data, EHR, and regulatory compliance.

- **Assets (4):** Electronic Health Records (EHR), Patient Portal, Billing & Insurance System, Staff HR System
- **Activities (3):** Patient Care & Treatment, Medical Billing & Insurance, Staff Employment Management
- **Flows (2):** EHR to Patient Portal, EHR to Billing

#### Fintech
For financial technology with KYC, transaction processing, and regulatory reporting.

- **Assets (4):** KYC/Identity Verification System, Transaction Ledger, Customer Account System, Regulatory Reporting System
- **Activities (3):** Customer Onboarding & KYC, Transaction Processing, AML Monitoring & Regulatory Reporting
- **Flows (2):** KYC to Account, Transactions to Monitoring

#### Media / Publishing
For digital media, news, or content platforms with subscriptions and advertising.

- **Assets (4):** Subscriber Database, Content Management System, Ad Tech Platform, Newsletter Platform
- **Activities (4):** Subscription Management, Programmatic Advertising, Newsletter Distribution, Content Personalization
- **Flows (2):** Subscribers to Ad Platform, Subscribers to Newsletter

#### Professional Services
For consulting, legal, accounting, or agency with client data and project management.

- **Assets (4):** Client Database, Project Management System, HR & Payroll System, Document Management
- **Activities (3):** Client Relationship Management, Service Delivery & Project Work, Employee HR & Payroll
- **Flows (2):** Client to Projects, Projects to Documents

---

## Wizard Flow

The quickstart page (`/privacy/quickstart`) walks users through a multi-step wizard:

```
Step 1: Choose Path
  Select "Import from Vendor Catalog" and/or "Start from Industry Template"

Step 2A: Vendor Selection (if vendor path chosen)
  Search catalog, multi-select vendors, see live preview of what will be created

Step 2B: Industry Selection (if industry path chosen)
  Pick template from grid, expand to preview all assets/activities/flows

Step 3: Review & Confirm
  Summary counts (X assets, Y elements, Z activities...)
  Non-destructive notice
  "Build My Privacy Program" button

Success Screen
  Links to Data Inventory, Processing Activities, Vendors, Dashboard
```

If both paths are selected, the wizard flows: Choose > Vendors > Industry > Review.

---

## Dashboard Integration

A **"Get Started with Quickstart"** card appears at the top of the Privacy Dashboard (`/privacy`) when the organization has few records:

```
showQuickstart = totalAssets <= 2 AND totalActivities <= 1 AND activeVendors <= 1
```

The card disappears automatically once the organization has populated its privacy program.

---

## Technical Details

### API Endpoints

All endpoints require authentication and organization membership (`organizationProcedure`).

| Endpoint | Type | Description |
|----------|------|-------------|
| `quickstart.listTemplates` | Query | Returns lightweight list of all 6 industry templates with counts |
| `quickstart.previewVendorImport` | Query | Returns preview of what vendor import would create, including dedup info |
| `quickstart.previewIndustryTemplate` | Query | Returns full template preview with existing-record detection |
| `quickstart.execute` | Mutation | Creates all records in a single `$transaction()` |

### Deduplication

Before creating any record, the execute mutation checks for existing records by name within the organization:
- Existing **vendors** (by name) are skipped entirely
- Existing **data assets** (by name) are skipped but their IDs are still resolved for activity linking
- Existing **processing activities** (by name) are skipped

### Audit Trail

All records created by quickstart are tagged in the audit log:
- `action: "CREATE"`
- `metadata: { source: "quickstart" }`
- `changes` includes `source: "quickstart"` and the template ID or catalog slug

### Source Files

| File | Purpose |
|------|---------|
| `src/config/vendor-data-mappings.ts` | Category-to-data-profile mappings, EU adequacy list |
| `src/config/industry-templates.ts` | 6 industry template definitions |
| `src/server/routers/privacy/quickstart.ts` | tRPC router with preview + execute endpoints |
| `src/app/(dashboard)/privacy/quickstart/page.tsx` | Multi-step wizard UI |
| `src/app/(dashboard)/privacy/page.tsx` | Dashboard with conditional quickstart card |
