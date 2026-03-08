# DPO Central — Demo Recording Script

Browser automation agent guide for recording a product demo video.

**App**: http://localhost:3001
**Demo org**: Meridian Retail Group (slug: `demo`)
**Login**: `GET /api/auth/dev-login?email=demo@privacysuite.example` (auto-redirects to `/privacy`)

---

## Pre-flight

1. Run `npm run db:seed-demo` to seed the Meridian demo data
2. Run `npm run dev` to start the dev server on port 3001
3. Navigate to `http://localhost:3001/api/auth/dev-login?email=demo@privacysuite.example`
4. You are now logged in as Demo User (OWNER) in the Meridian Retail Group org
5. The app redirects to `/privacy` (dashboard home)

---

## Scene 1: Dashboard Overview (10s)

**URL**: `/privacy`

**What's on screen**:
- Quick stats grid: Data Inventory count, Open DSARs, Assessments, Incidents
- DSAR Queue section: 3 recent requests with status badges
- Recent Activity feed: audit log entries
- Quick Actions: Add Data Asset, New DSAR, Report Incident, Add Vendor, Quickstart Wizard
- Vendor Overview: 3 vendors with risk tier badges

**Actions**: Pause to show the dashboard. Scroll down slowly to reveal all sections.

---

## Scene 2: Data Inventory (20s)

**URL**: `/privacy/data-inventory`

**What's on screen**:
- Stats ribbon at top
- Search bar + Export dropdown + Add Asset button
- Tabs: Assets | Activities | Data Flows | Transfers
- Grid of 12 data asset cards (Customer Database, E-commerce Platform, Payment Gateway, etc.)
- Each card shows: type icon, element count badge, activity count, location

**Actions**:
1. Show the asset grid (default tab)
2. Click the **Activities** tab → shows 8 processing activities with legal basis badges
3. Click the **Data Flows** tab → shows the data flow visualization diagram
4. Click the **Transfers** tab → shows 4 cross-border transfers with mechanism badges
5. Click back to **Assets** tab, click on **"Customer Database"** card to open detail

**Detail page** (`/privacy/data-inventory/demo-asset-customer-db`):
- Asset metadata: type, owner, location, vendor
- 5 data elements listed with category and sensitivity badges
- Linked processing activities
- Back button to return

---

## Scene 3: Processing Activities / ROPA (10s)

**URL**: `/privacy/data-inventory/processing-activities`

**What's on screen**:
- List of all 8 processing activities
- Each shows: name, legal basis, data subjects, retention period, linked assets
- Export ROPA button

**Actions**: Scroll through the list. Click export if available.

---

## Scene 4: DSAR Management (20s)

**URL**: `/privacy/dsar`

**What's on screen**:
- Stats: Total (5), Open (3), Overdue (0 or highlighted), At Risk
- Tabs: All | Open | Overdue | Completed
- 5 DSAR cards with status badges:
  - DSAR-2025-0042 (ACCESS, COMPLETED) — Anna van der Berg
  - DSAR-2026-0003 (ERASURE, IN_PROGRESS) — Thomas Muller
  - DSAR-2026-0007 (ACCESS, IDENTITY_PENDING) — Sarah Johnson
  - DSAR-2026-0009 (PORTABILITY, SUBMITTED) — Marc Dubois
  - DSAR-2025-0038 (ERASURE, REJECTED) — Unknown

**Actions**:
1. Show the overview with all 5 DSARs
2. Click the **Open** tab → filters to show active requests
3. Click on **DSAR-2025-0042** (Anna van der Berg, COMPLETED) to open detail

**Detail page** (`/privacy/dsar/demo-dsar-1`):
- Request details: requester, type, dates, SLA countdown
- 3 tasks (all completed) with assigned team members
- 4 communications (inbound/outbound timeline)
- Audit log trail
- Back button

---

## Scene 5: Assessments Overview (10s)

**URL**: `/privacy/assessments`

**What's on screen**:
- Stats: Total (5), In Progress (1), Pending Review (1), High Risk
- Tabs: All | DPIA | Vendor | TIA
- 5 assessment cards:
  - LIA: Customer Analytics & BI (APPROVED, LOW risk)
  - LIA: Fraud Detection & Prevention (IN_PROGRESS)
  - Privacy Review: Meridian Rewards Loyalty (PENDING_REVIEW, MEDIUM risk)
  - Privacy Review: New SMS Marketing Campaign (DRAFT)
  - **DPIA: Customer Analytics Platform** (APPROVED, MEDIUM risk, score 48)

**Actions**:
1. Show the overview
2. Click the **DPIA** tab → filters to show only the DPIA assessment
3. Click on **"DPIA: Customer Analytics Platform"**

---

## Scene 6: DPIA Deep Dive — THE SHOWCASE (40s)

**URL**: `/privacy/assessments/demo-assess-dpia-analytics`

This is the centerpiece. The DPIA has 27 fully-answered questions across 7 sections.

**What's on screen**:
- Header: assessment name, APPROVED badge, MEDIUM risk badge, risk score 48
- Progress bar: 100% complete (27/27 questions)
- Tabs for navigation: Overview | Responses | Mitigations | Approvals | Export

**Actions — walk through each tab**:

### Tab: Overview
- Assessment metadata: template (DPIA v2.0), linked activity, dates, status
- Summary stats: responses, mitigations, approvals

### Tab: Responses (scroll through sections)
Show these key sections by scrolling:

1. **S1: Processing Description** (6 questions)
   - q1_1: Long multi-paragraph answer listing all data categories
   - q1_2: Primary and secondary purposes with business objectives
   - q1_3: Legal basis = Legitimate interests
   - q1_6: Detailed data flow diagram description

2. **S2: Scope & Context** (4 questions)
   - q2_1: Sensitivity level
   - q2_3: Geographic scope and transfers (EU, US, UK)

3. **S5: Risk Identification** (6 questions)
   - q5_1-q5_5: Boolean risk flags (large scale = true)
   - q5_6: 6 detailed risks with likelihood and severity ratings

4. **S7: Residual Risk** (3 questions)
   - q7_1: Medium residual risk
   - q7_3: DPO formal recommendation (multi-paragraph)

### Tab: Mitigations
- 6 mitigations at various stages:
  - **VERIFIED**: Consent preference center for analytics opt-out
  - **IMPLEMENTED**: Purpose limitation controls, Automated retention enforcement
  - **IN_PROGRESS**: Transfer Impact Assessment for Snowflake
  - **PLANNED**: Data minimization layer
  - **IDENTIFIED**: Annual DPIA review
- Each shows: title, owner, status badge, evidence (if completed)

### Tab: Approvals
- Level 1: Maria Torres (DPO) — APPROVED with detailed comment
- Level 2: James Mitchell (Admin/CISO) — APPROVED with security review comment

### Tab: Export
- Click the **Download PDF** button to show the export capability

---

## Scene 7: Incident Management (15s)

**URL**: `/privacy/incidents`

**What's on screen**:
- Stats: Total (4), Open (2), Critical (0), Pending DPA Notification (1)
- 4 incidents:
  - INC-2025-0012: Phishing Attack (MEDIUM, CLOSED)
  - INC-2026-0002: Unauthorized DB Query (HIGH, INVESTIGATING) — red highlight
  - INC-2026-0001: Vendor Data Violation — Klaviyo (MEDIUM, CONTAINED)
  - INC-2025-0015: Lost Employee Laptop (LOW, CLOSED)

**Actions**:
1. Show overview
2. Click on **INC-2026-0002** (Unauthorized Database Query — the active investigation)

**Detail page** (`/privacy/incidents/demo-incident-db-access`):
- Severity: HIGH, Status: INVESTIGATING
- Affected records: 15,000
- Timeline: 4 entries (detection → escalation → suspension → forensics)
- 3 tasks (forensic analysis, DPA notification draft, network segmentation)
- DPA notification: Autoriteit Persoonsgegevens — DRAFTED
- Affected assets: Customer Database (compromised)

---

## Scene 8: Vendor Management (15s)

**URL**: `/privacy/vendors`

**What's on screen**:
- Stats: Total (10), Active (8), High Risk (3), Pending Review (1)
- Vendor cards in grid with risk tier badges
- Mix of statuses: ACTIVE, UNDER_REVIEW, PROSPECTIVE

**Actions**:
1. Show vendor overview grid
2. Click the **High Risk** tab → 3 vendors (Stripe, BambooHR, TechServe Solutions)
3. Click on **Stripe** to show vendor detail

**Detail page** (`/privacy/vendors/demo-vendor-stripe`):
- Vendor profile: description, categories, certifications
- Contract: Stripe DPA (ACTIVE)
- Completed review: Maria Torres, LOW risk finding
- Questionnaire response: score 92, APPROVED
- Countries: US, IE, SG
- Data processed: FINANCIAL, IDENTIFIERS

---

## Scene 9: Public DSAR Portal (10s)

**URL**: `/dsar/demo` (no auth required)

**What's on screen**:
- Public-facing form branded for Meridian Retail Group
- Request type selector (6 types: Access, Erasure, Rectification, etc.)
- Form fields: Full Name, Email, Phone, Relationship, Details
- Thank you message preview

**Actions**: Show the public form. Select "Access" type. Show the fields. (Don't submit.)

---

## Scene 10: Export Documents (10s)

Navigate back to an authenticated page, then demonstrate export capability.

**Option A**: From the Data Inventory page (`/privacy/data-inventory`), click the Export dropdown → PDF
**Option B**: From the Incidents page (`/privacy/incidents`), click Export Register → PDF
**Option C**: From the DPIA detail page, click Export / Download PDF

---

## Total Runtime: ~2.5 minutes

---

## Quick Reference: Key URLs

| Scene | URL | Description |
|-------|-----|-------------|
| Login | `/api/auth/dev-login?email=demo@privacysuite.example` | Auto-login, redirects to dashboard |
| Dashboard | `/privacy` | Home overview |
| Data Inventory | `/privacy/data-inventory` | Assets, activities, flows, transfers |
| Asset Detail | `/privacy/data-inventory/demo-asset-customer-db` | Customer Database detail |
| ROPA | `/privacy/data-inventory/processing-activities` | Processing activities list |
| DSARs | `/privacy/dsar` | All 5 DSARs |
| DSAR Detail | `/privacy/dsar/demo-dsar-1` | Anna van der Berg (COMPLETED) |
| Assessments | `/privacy/assessments` | All 5 assessments |
| DPIA Detail | `/privacy/assessments/demo-assess-dpia-analytics` | DPIA showcase (27q, 6 mits) |
| Incidents | `/privacy/incidents` | All 4 incidents |
| Incident Detail | `/privacy/incidents/demo-incident-db-access` | Active investigation |
| Vendors | `/privacy/vendors` | All 10 vendors |
| Vendor Detail | `/privacy/vendors/demo-vendor-stripe` | Stripe detail |
| Public DSAR | `/dsar/demo` | Public intake form |

---

## For Vertical Demos

To demo a specific vertical instead of (or in addition to) Meridian:

| Vertical | Login URL | Dashboard |
|----------|-----------|-----------|
| SaaS | `/api/auth/dev-login?email=demo-saas@privacysuite.example` | `/privacy` |
| Healthcare | `/api/auth/dev-login?email=demo-healthcare@privacysuite.example` | `/privacy` |
| Fintech | `/api/auth/dev-login?email=demo-fintech@privacysuite.example` | `/privacy` |
| Media | `/api/auth/dev-login?email=demo-media@privacysuite.example` | `/privacy` |
| Prof Services | `/api/auth/dev-login?email=demo-proserv@privacysuite.example` | `/privacy` |

After login, the org context is set by the user's org membership. Each vertical user is the OWNER of their respective org.

---

## Tips for the Recording Agent

1. **Viewport**: Use 1280x720 or 1920x1080 for clean desktop layout
2. **Dark mode**: The app supports dark/light themes via `next-themes`. Default is system preference.
3. **Scroll speed**: Scroll slowly (~2s per screen) to let viewers read content
4. **Tab clicks**: Pause 1-2s after clicking a tab to let content load
5. **Detail pages**: Spend extra time on the DPIA (Scene 6) — this is the main selling point
6. **Transitions**: Use natural navigation (click cards/links) rather than direct URL jumps
7. **Loading states**: The app uses tRPC + React Query, so data loads quickly but there may be brief loading spinners
