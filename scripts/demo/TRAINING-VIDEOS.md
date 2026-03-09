# DPO Central — Training Video Recording Guide

Short training videos that map specific legal requirements to DPO Central features using demo data.

**Machine-readable version**: `training-videos.json` (same directory)

---

## Setup

```bash
npm run demo:setup          # Seeds Meridian Retail Group demo data
npm run dev                 # Start on port 3001
```

**Login**: `GET /api/auth/dev-login?email=demo@privacysuite.example`

---

## Video 1: ROPA — Building Your Record of Processing Activities

**Legal basis**: GDPR Article 30
**Duration**: ~90 seconds
**Audience**: DPOs, privacy officers, compliance teams

### What Article 30 Requires

Every controller must maintain a written record containing:
1. Purposes of processing
2. Categories of data subjects
3. Categories of personal data
4. Categories of recipients
5. International transfers + safeguards
6. Retention periods
7. Security measures description

### Scene Flow

| # | Page | Narration Focus | Key UI Element |
|---|------|----------------|----------------|
| 1 | `/privacy` | Intro — what is ROPA, why it matters | Dashboard overview |
| 2 | `/privacy/data-inventory` | Data Assets = the foundation | Asset grid (12 assets) |
| 3 | Asset detail (Customer DB) | Data Elements = Art. 30 "categories of data" | Element list with categories/sensitivity |
| 4 | Data Inventory → Activities tab | Processing Activities = the ROPA core | Activity list with legal basis badges |
| 5 | `/privacy/data-inventory/processing-activities` | Dedicated ROPA page with all Art. 30 fields | Activities with full metadata |
| 6 | Data Inventory → Data Flows tab | Data recipients + internal flows | Flow visualization diagram |
| 7 | Data Inventory → Transfers tab | International transfers (Art. 44-49) | Transfer cards with SCCs/adequacy |
| 8 | ROPA page → Export | Export for audit/DPA request | PDF/CSV export dropdown |

### Art. 30 → DPO Central Field Mapping

| Art. 30 Requirement | Where in DPO Central |
|---------------------|---------------------|
| Controller name/contact | Organization settings |
| Purposes of processing | `ProcessingActivity.purpose` |
| Legal basis | `ProcessingActivity.legalBasis` + badge |
| Categories of data subjects | `ProcessingActivity.dataSubjects` |
| Categories of personal data | `ProcessingActivity.categories` + linked `DataElement.category` |
| Categories of recipients | `ProcessingActivity.recipients` |
| International transfers | `DataTransfer` linked to activity (Transfers tab) |
| Transfer safeguards | `DataTransfer.mechanism` + `safeguards` |
| Retention periods | `ProcessingActivity.retentionPeriod` / `retentionDays` |
| Security measures | `DataElement.sensitivity`, `DataFlow.encryptionMethod` |
| Automated decisions | `ProcessingActivity.automatedDecisionMaking` + detail |

### Demo Data Highlights

- **8 processing activities** spanning Contract, Consent, and Legitimate Interests
- **12 data assets** across databases, SaaS tools, and third parties
- **28 data elements** with sensitivity and retention
- **10 data flows** showing how data moves between systems
- **4 international transfers** (EU→US, EU→UK, EU→India) with SCCs and adequacy decisions

---

## Video 2: Data Subject Rights — Managing DSARs

**Legal basis**: GDPR Articles 15–22, CCPA Consumer Rights
**Duration**: ~120 seconds
**Audience**: DPOs, customer-facing teams, legal departments

### Rights Covered

| Right | GDPR | CCPA | DPO Central Type |
|-------|------|------|-----------------|
| Access / Know | Art. 15 | § 1798.100 | `ACCESS` |
| Rectification / Correct | Art. 16 | § 1798.106 | `RECTIFICATION` |
| Erasure / Delete | Art. 17 | § 1798.105 | `ERASURE` |
| Restriction | Art. 18 | — | `RESTRICTION` |
| Portability | Art. 20 | — | `PORTABILITY` |
| Objection / Opt-Out | Art. 21 | § 1798.120 | `OBJECTION` |
| Automated decisions | Art. 22 | § 1798.185 | `AUTOMATED_DECISION` |
| Withdraw consent | — | — | `WITHDRAW_CONSENT` |

### Scene Flow

| # | Page | Narration Focus | Key UI Element |
|---|------|----------------|----------------|
| 1 | `/privacy` | Intro — what are data subject rights | Dashboard |
| 2 | `/dsar/demo` | Public intake portal (Art. 12 transparency) | Public form, request type selector |
| 3 | `/privacy/dsar` | DSAR queue with SLA tracking | Stats, tabs, 5 requests |
| 4 | DSAR detail (Anna) | Completed ACCESS request — full lifecycle | Tasks, comms, audit trail |
| 5 | DSAR detail (Thomas) | ERASURE with retention exemptions | Partial completion, legal hold |
| 6 | DSAR detail (Sarah) | Identity verification (Art. 12(6)) | Identity Pending status |
| 7 | DSAR detail (rejected) | Refusing unfounded requests (Art. 12(5)) | Rejection documentation |
| 8 | `/privacy/dsar` | Summary — audit trail = accountability | Final overview |

### Deadlines by Jurisdiction

| Jurisdiction | Deadline | Extension |
|-------------|----------|-----------|
| GDPR (EU) | 30 days | +60 days |
| CCPA (California) | 45 days | +45 days |
| UK GDPR | 30 days | +60 days |
| LGPD (Brazil) | 15 days | — |

### Demo Data Highlights

- **DSAR-2025-0042**: Completed ACCESS — Anna van der Berg, 3 tasks across 3 systems, 4 communications
- **DSAR-2026-0003**: In-progress ERASURE — Thomas Muller, partial completion (marketing deleted, tax records retained)
- **DSAR-2026-0007**: Identity Pending — Sarah Johnson, verification via different email
- **DSAR-2026-0009**: Submitted PORTABILITY — Marc Dubois, requesting JSON/CSV export
- **DSAR-2025-0038**: Rejected ERASURE — anonymous temp email, Art. 12(6) identity failure

---

## Video 3: Vendor Management — Data Processor Compliance

**Legal basis**: GDPR Article 28, Articles 44–49, CCPA Service Provider Rules
**Duration**: ~100 seconds
**Audience**: DPOs, procurement teams, legal departments

### Art. 28 Requirements

| Requirement | DPO Central Feature |
|------------|-------------------|
| Written DPA contract | `VendorContract` (type: DPA) with dates, status, terms |
| Sufficient guarantees | `certifications`, `riskTier`, questionnaire score |
| Sub-processor authorization | Questionnaire section + SUBPROCESSOR contract type |
| Security measures | `certifications`, questionnaire responses |
| Data subject rights assistance | Linked to DSAR tasks per vendor |
| Return/deletion of data | Contract terms, vendor review findings |
| Audit rights | Vendor reviews (PERIODIC, TRIGGERED) |
| International transfers | `DataTransfer` with mechanism + safeguards |

### Scene Flow

| # | Page | Narration Focus | Key UI Element |
|---|------|----------------|----------------|
| 1 | `/privacy` | Intro — what is a data processor | Dashboard |
| 2 | `/privacy/vendors` | Vendor overview with risk tiers | Stats grid, vendor cards |
| 3 | Vendors → High Risk tab | Risk-based prioritization | Filtered high-risk vendors |
| 4 | Vendor detail (Stripe) | Art. 28 profile — data, certs, countries | Profile, certifications list |
| 5 | Stripe → Contracts | DPA tracking (Art. 28(3)) | Contract cards with dates/status |
| 6 | Stripe → Reviews | Ongoing due diligence | Review findings, risk level |
| 7 | `/privacy/vendors/questionnaires` | Security questionnaires for diligence | Template, responses |
| 8 | Vendor detail (TechServe) | Prospective vendor — pre-activation checks | High risk, pending MSA |
| 9 | Data Inventory → Transfers | Cross-border transfers (Art. 44-49) | Transfer cards, SCCs |
| 10 | `/privacy/vendors` | Export vendor register for audit | Final overview |

### Demo Data Highlights

- **10 vendors**: Shopify, Stripe, Klaviyo, Snowflake, BambooHR, Zendesk, HubSpot, Cookiebot, SAP, TechServe
- **8 contracts**: 5 DPAs (Active), 1 MSA (Pending), 1 NDA, 1 Expired DPA
- **4 reviews**: Stripe (completed, LOW risk), Snowflake (renewal, in progress), SAP (scheduled), TechServe (initial, HIGH risk)
- **3 questionnaire responses**: Stripe (score 92, approved), Snowflake (score 78, submitted), SAP (in progress)

---

## Adding More Videos

The framework is designed to extend. To add a new topic:

1. Add a new entry to `training-videos.json` under `videos[]`
2. Define the `legalContext` with primary/related articles
3. Create scenes with `narration` text and `actions`
4. Add a section to this guide with the field mapping

### Suggested Future Topics

| Topic | Legal Articles | DPO Central Module |
|-------|---------------|-------------------|
| Data Breach Notification | Art. 33-34 GDPR | Incidents |
| DPIA — When and How | Art. 35 GDPR | Assessments (DPIA template) |
| Legitimate Interest Assessment | Art. 6(1)(f) GDPR | Assessments (LIA template) |
| Consent Management | Art. 7 GDPR, ePrivacy | Cookie consent + processing activities |
| Privacy by Design | Art. 25 GDPR | Assessments + data minimization |
| Children's Data | Art. 8 GDPR, COPPA | DSARs + special processing |
| Cross-Border Transfers | Art. 44-49 GDPR, Schrems II | Data Inventory transfers + TIA |
| Data Retention | Art. 5(1)(e) GDPR | Data elements + retention policies |

---

## Recording Agent Instructions

1. Load `training-videos.json` for the machine-readable scene definitions
2. Each scene has:
   - `narration` — text for voiceover or captions
   - `actions` — browser actions (navigate, click, scroll, wait, screenshot)
3. Record one video at a time
4. Use 1280x720 viewport
5. Scroll slowly to let viewers read content
6. Pause 1.5–2s after navigation for content to load
7. The narration text can be used for:
   - Text-to-speech voiceover
   - On-screen captions/subtitles
   - Video description/script for human narrator
