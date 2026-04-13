# DPO Central (Privacy Suite)

Next.js 16 + tRPC + Prisma + PostgreSQL + NextAuth

**Production**: https://dpocentral.todo.law

## License

Open Core model: **Core** AGPL-3.0 / **Premium** proprietary.
- Core: Data Inventory, ROPA, DSAR, Incidents, LIA/Custom assessments, Vendor management
- Premium: DPIA templates & scoring (`@dpocentral/premium-skills`), security (`@dpocentral/security`)
- PIA, TIA, Vendor assessments: Coming Soon (no templates yet) — gated by `COMING_SOON_SKILL_IDS` in `src/config/skill-packages.ts`

## Key Architecture

- **Multi-tenancy**: All models scoped by `organizationId`. Use `organizationProcedure`.
- **Auth**: Google OAuth + Email Magic Link (Resend). JWT strategy. API routes must use `getToken` from `next-auth/jwt` (NOT `getServerSession` — breaks on Next.js 16).
- **Rate limiting**: `src/lib/rate-limit.ts` — auth 30/min, checkout 10/min.
- **Icons**: All in `/public` only. Never put favicons in `src/app/` (Next.js prioritizes them over `/public`). `/logos` folder is gitignored (source files only).

## Modules

Data Inventory, DSAR, Assessments, Incidents, Vendors, AI Governance, Reports, Regulations, Transfer Compliance, Expert Directory, Notifications, Admin Panel.

All list pages: debounced search, controlled Tabs, mobile/desktop layouts, responsive stats grids.

## DSAR — Privacy by Design

- Public portal: `/dsar/[orgSlug]` — consent checkbox required, privacy notice, configurable per-org
- Auto-redaction: cron redacts PII from completed DSARs after retention period (default 90 days)
- Manual redact/delete: `redactDSAR` and `deleteDSAR` mutations (admin only)
- Audit trail survives redaction (actions + timestamps, no PII)
- Settings: `DSARIntakeForm.retentionDays`, `privacyNoticeUrl`

## Export Pipeline (8 PDF Reports)

`@react-pdf/renderer` — shared components in `src/server/services/export/pdf-styles.tsx`

| Report | Route | Trigger |
|--------|-------|---------|
| Assessment (individual) | `/api/export/assessment/[id]` | Assessment detail page |
| Assessment Portfolio | `/api/export/assessment-portfolio` | Assessments list page |
| DSAR Performance | `/api/export/dsar-performance` | DSAR list page |
| Regulatory Landscape | `/api/export/regulatory-landscape` | Regulations + Reports pages |
| Data Inventory | `/api/export/data-inventory` | Data Inventory page |
| ROPA | `/api/export/ropa` | Data Inventory page |
| Vendor Register | `/api/export/vendor-register` | Vendors page |
| Breach Register | `/api/export/breach-register` | Incidents page |

**Critical**: never use `wrap={false}` on Views with unbounded lists — causes text overlap.

## AI Systems & Models

- Detection: `src/config/vendor-ai-detection.ts` (`isAiCapableVendor`, `buildAISystemFromCatalog`)
- Detail page shows embedded models from `aiModels` JSON (name, type, source, EU AI Act risk tier)
- Status dropdown: DRAFT → REGISTERED → UNDER_REVIEW → COMPLIANT/NON_COMPLIANT → DECOMMISSIONED

## Cron Jobs

`/api/cron/dsar-redaction`: DSAR PII auto-redaction. Currently not scheduled in `vercel.json` — endpoint exists for manual / future cron use. The full notifications cron (deadline alerts, email/in-app/Slack) was removed; reinstating it requires restoring `dispatchNotification` in `src/server/services/notifications/dispatcher.ts` and adding a new cron entry.

## Public Pages & Docs

- `/docs/*` — 6 documentation pages (overview, data-inventory, dsar, assessments, incidents, vendors) with PDF export sections
- `/security` — Data Security page
- SEO: sitemap, robots.txt, llms.txt, OpenGraph, JSON-LD

## Billing (Stripe)

EUR 9/mo default, USD for US visitors (geo-IP). Per-feature add-on model. `EnableFeatureModal` for purchase. Assessment PDF export is NOT premium-gated.

## Structure
```
prisma/schema.prisma              # ~56 models
src/server/routers/privacy/       # 14 tRPC routers
src/server/services/export/       # 8 PDF report components + shared styles
src/config/                       # Feature flags, AI Act, vendor mappings, jurisdictions
src/app/(dashboard)/privacy/      # Dashboard pages
src/app/(public)/                 # Public pages (security, docs)
src/app/dsar/                     # Public DSAR portal
src/app/api/export/               # 8 PDF export routes
src/app/api/cron/                 # Vercel cron endpoints
```

## Git Identity
- **Name**: `sergiomaldo` / **Email**: `206754515+sergiomaldo@users.noreply.github.com`
- ALWAYS use `-c user.name="sergiomaldo" -c user.email="206754515+sergiomaldo@users.noreply.github.com"`

## Authorized Committers
- `sergiomaldo` — https://github.com/sergiomaldo
- `todolaw` — https://github.com/todolaw
