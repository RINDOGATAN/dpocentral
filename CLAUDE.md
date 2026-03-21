# DPO Central (Privacy Suite)

Next.js 16 + tRPC + Prisma + PostgreSQL + NextAuth

**Production**: https://dpocentral.todo.law

## License

Open Core model:
- **Core Platform**: AGPL-3.0 (see `LICENSE`)
- **Premium Skills**: Proprietary, requires commercial license

### Core (AGPL-3.0 - Open Source)
- Data Inventory & ROPA
- DSAR management & public portal
- Incident tracking
- Basic assessments (LIA, Custom)
- Vendor management (basic)

### Premium (Proprietary - Requires License)
- DPIA, PIA, TIA assessment templates & scoring
- Vendor risk scoring (`calculateVendorRiskScore`, `calculateAssessmentRiskScore`)
- Advanced audit features

### Premium Skills Package
Private repo: `RINDOGATAN/dpocentral-premium-skills` (`@dpocentral/premium-skills`)
- Loaded dynamically via `src/lib/skills/loader.ts` + `src/instrumentation.ts`
- `optionalDependencies` in package.json — `npm install` succeeds without access
- `serverExternalPackages` in next.config.ts prevents webpack bundling
- `scripts/seed-templates.ts` dynamically imports templates from package (falls back gracefully)
- Templates: DPIA, PIA (new), TIA (new) — seeded only when package is installed
- Open repo keeps: skill loader/registry/types, entitlement checks, LIA/Custom templates

### Security Package
Private repo: `RINDOGATAN/dpocentral-security` (`@dpocentral/security`)
- Loaded dynamically via `src/lib/security/loader.ts` + `src/instrumentation.ts`
- `optionalDependencies` in package.json — `npm install` succeeds without access
- `serverExternalPackages` in next.config.ts prevents webpack bundling
- Provides: rate limiting, RBAC role enforcement, input sanitization, public domain blocklist, CSP nonce generation
- Without package: rate limits disabled, RBAC falls back to membership-only, sanitization is no-op, all domains allowed for auto-join, CSP uses static headers

## Vendor Catalog — READ-ONLY
- `vendor_catalog` table is now **owned by Vendor.Watch** (admin CRUD, enrichment, seeding)
- DPO Central retains **read-only** access via `vendorCatalog.search`, `getBySlug`, `listCategories`
- Admin catalog pages and AI enrichment have been removed from this project

Premium features require entitlements via `src/server/services/licensing/`

## Quickstart — Free Tier (5 Vendors)
- Vendor catalog import allows **5 free vendors** without premium license
- Tracked via `Vendor.metadata.source = "quickstart"` (counted per org)
- Portfolio imports (from Vendor.Watch) share the same 5-vendor budget (`metadata.fromPortfolio: true`)
- AI-capable vendors auto-create `AISystem` records (detected from catalog AI fields)
- Industry templates are always free (no limit)
- Transaction timeout: 30s

## Admin Panel (`/admin`)
Gated by `ADMIN_EMAILS` env var. 6 sections: Dashboard, Customers, Skill Packages, Organizations, Users, Audit Logs.
- `src/server/routers/platformAdmin.ts` — all admin tRPC endpoints
- `src/app/(admin)/admin/` — all admin pages

## Modules
- **Data Inventory** - Assets, elements, processing activities, data flow visualization
- **DSAR** - Subject access requests, SLA tracking, public portal
- **Assessments** - DPIA/PIA/TIA/Vendor with templates & approvals
- **Incidents** - Breach tracking, DPA notifications, timeline
- **Vendors** - Contracts, questionnaires, risk tiers
- **AI Governance** - EU AI Act register, risk classification, AI system CRUD
- **Notifications** - Multi-channel dispatcher (in-app, email, Slack), user preferences, daily cron
- **Reports** - Weighted compliance score (ROPA 25%, Assessment 20%, DSAR 25%, Incident 15%, Vendor 15%), module breakdown, risk indicators, trend snapshots, board report data
- **Regulations** - 40-jurisdiction catalog, applicability wizard, org-level jurisdiction management
- **DPIA Auto-Fill** - Rule-based pre-population from processing activities, optional AI narrative (OpenAI/Anthropic)
- **Transfer Compliance** - Schrems II checklist, EU adequacy decisions, supplementary measures, compliance status evaluator

All module list pages share consistent patterns: debounced search, controlled Tabs, mobile/desktop dual layouts, responsive stats grids, `ExpertHelpCta` per module.

## Dashboard Navigation
- **Top bar (desktop)**: 5 core modules flat — Data Inventory, DSAR, Assessments, Incidents, Vendors
- **More dropdown**: Reports, Regulations, AI Systems, Find Expert, My Clients (professional)
- **Mobile**: All items flat in slide-out sheet
- Feature-flagged via `src/config/features.ts` (19 flags, all enabled by default)

## Expert Directory & Dealroom Integration
- `/privacy/experts` — searchable directory with filters (specialization, country, language, type)
- `src/server/services/dealroom/client.ts` — Dealroom API client with mock fallback (12 experts)
- Env vars: `DEALROOM_API_URL`, `DEALROOM_API_KEY` (falls back to mock data if unset)
- `ExpertHelpCta` component (9 contexts) with `?specialization=` deep links
- Gated by `features.expertDirectoryEnabled` + `isBusinessOwner` user type

## AI Sentinel Integration
- DPO Central = lightweight AI register; AI Sentinel = deep governance (separate app/DB at `aisentinel.todo.law`)
- Quickstart auto-creates `AISystem` records for AI-capable vendors (detected via `src/config/vendor-ai-detection.ts`)
- Export DPC AI Systems → AIS via `POST /api/import/dpc-ai-systems` (x-api-key auth)
- `src/server/services/ai-sentinel/client.ts` — REST client (follows Dealroom pattern, no-op when not configured)
- Env vars: `AI_SENTINEL_API_URL`, `AI_SENTINEL_API_KEY`
- Feature flag: `features.aiSentinelIntegrationEnabled` (default true, functional only when env vars set)
- Synced systems store `aiSentinelSystemId` + `aiSentinelSyncedAt`, show deep link on detail page

## Data Security Page
- Public page at `/security` (under `(public)` layout)
- Linked from dashboard footer and public site footer
- 10 security sections grouped into 4 categories with accordion UI
- Uses shadcn Accordion component (`src/components/ui/accordion.tsx`)

## Cron Jobs
- `vercel.json` defines daily cron at 08:00 UTC: `/api/cron/notifications`
- Checks: DSAR deadlines, incident notification deadlines, vendor contract expiry, assessment due dates, SCC expiry
- Protected by `CRON_SECRET` env var (set in Vercel production)

## Structure
```
prisma/schema.prisma              # ~25 models
src/server/routers/privacy/       # tRPC routers (12 routers)
src/server/services/              # External API clients (Dealroom, AI Sentinel), notifications dispatcher, AI assessment generator
src/config/                       # Feature flags, AI Act classifications, vendor mappings, jurisdiction catalog, transfer compliance rules, DPIA auto-fill rules
src/app/(dashboard)/privacy/      # Dashboard pages
src/app/(public)/security/        # Public Data Security page
src/app/dsar/                     # Public DSAR portal
src/app/api/cron/                 # Vercel cron endpoints
src/components/docs/              # Reusable doc components (DocSection, StepList, FeatureMockup, InfoCallout, DocNavFooter)
scripts/                          # Verification, seeding & demo scripts
```

## Multi-tenancy
All models have `organizationId`. Use `organizationProcedure` for org-scoped routes.

Demo org: `demo` slug, user: `demo@privacysuite.example`

## Commands
```bash
npm run dev                    # Local dev (port 3001)
npx prisma db seed             # Seed demo data
npm run db:studio              # Prisma Studio
python3 scripts/verify-app.py  # Run verification agent
```

## Auth
- Google OAuth + Email Magic Link (Resend)
- Callback: `/api/auth/callback/google`
- `signIn` callback auto-joins users to orgs by email domain (wrapped in try/catch so DB failures don't block sign-in)

## Roles
OWNER > ADMIN > PRIVACY_OFFICER > MEMBER > VIEWER

## Git Identity
- **Name**: `sergiomaldo`
- **Email**: `206754515+sergiomaldo@users.noreply.github.com`
- ALWAYS use `-c user.name="sergiomaldo" -c user.email="206754515+sergiomaldo@users.noreply.github.com"` for every commit

## Authorized Committers
- `sergiomaldo` — https://github.com/sergiomaldo
- `todolaw` — https://github.com/todolaw
