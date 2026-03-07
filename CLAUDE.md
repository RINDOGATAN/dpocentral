# DPO Central (Privacy Suite)

Next.js 16 + tRPC + Prisma + PostgreSQL + NextAuth

**Production**: https://privacysuite-ten.vercel.app

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

## Vendor Catalog — READ-ONLY
- `vendor_catalog` table is now **owned by Vendor.Watch** (admin CRUD, enrichment, seeding)
- DPO Central retains **read-only** access via `vendorCatalog.search`, `getBySlug`, `listCategories`
- Admin catalog pages and AI enrichment have been removed from this project

Premium features require entitlements via `src/server/services/licensing/`

## Quickstart — Free Tier (5 Vendors)
- Vendor catalog import in quickstart allows **5 free vendors** without premium license
- Tracked via `Vendor.metadata.source = "quickstart"` (counted per organization)
- Portfolio imports (from Vendor.Watch) also use this budget (`metadata.fromPortfolio: true`)
- After 5 free imports, users need the Vendor Catalog add-on for more
- Industry templates are always free (no limit)
- Transaction timeout: 30s (default 5s was too short for multi-vendor imports)

## Admin Panel (`/admin`)
Platform admin panel gated by `ADMIN_EMAILS` env var. 6 sections:
- **Dashboard** — stats (customers, orgs, entitlements, active licenses, new users 7d/30d, active subs), activity feed, quick actions
- **Customers** — CRUD, link/unlink orgs, manage entitlements, delete with cascade confirmation, license key display with copy
- **Skill Packages** — browse packages
- **Organizations** — search/browse all orgs, detail view with members, stats (assets/activities/DSARs/assessments/incidents/vendors), audit logs
- **Users** — search/browse all users, detail view with inline userType editor, org memberships, activity log
- **Audit Logs** — filterable table (entity type, action, date range, search), expandable rows with changes JSON

Key files:
- `src/server/routers/platformAdmin.ts` — all admin tRPC endpoints
- `src/app/(admin)/admin/` — all admin pages

## Modules
- **Data Inventory** - Assets, elements, processing activities, data flow visualization
- **DSAR** - Subject access requests, SLA tracking, public portal
- **Assessments** - DPIA/PIA/TIA/Vendor with templates & approvals
- **Incidents** - Breach tracking, DPA notifications, timeline
- **Vendors** - Contracts, questionnaires, risk tiers

All module list pages share consistent patterns: debounced search wired to tRPC `search` param, controlled Tabs for client-side filtering, mobile/desktop dual layouts, responsive stats grids. Every module page includes an `ExpertHelpCta` with context-specific copy.

## Expert Directory & Dealroom Integration
- `/privacy/experts` — searchable directory with filters (specialization, country, language, type)
- `src/server/services/dealroom/client.ts` — Dealroom API client with mock fallback (12 experts)
- Env vars: `DEALROOM_API_URL`, `DEALROOM_API_KEY` (falls back to mock data if unset)
- `ExpertHelpCta` component (9 contexts): quickstart, assessment, incident, empty-state, general, vendor, dsar, high-risk, transfer
- Contextual CTAs pass `?specialization=` to deep-link into filtered expert search
- Quickstart review step shows expert nudges when high-risk vendors or international transfers detected
- Gated by `features.expertDirectoryEnabled` + `isBusinessOwner` user type

## Structure
```
prisma/schema.prisma          # ~25 models
src/server/routers/privacy/   # tRPC routers
src/app/(dashboard)/privacy/  # Dashboard pages
src/app/dsar/                 # Public DSAR portal
scripts/                      # Verification & testing scripts
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
