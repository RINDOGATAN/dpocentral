# DPO Central (Privacy Suite)

Next.js 16 + tRPC + Prisma + PostgreSQL + NextAuth

**Production**: https://dpocentral.todo.law

## License

Open Core model: **Core** AGPL-3.0 / **Premium** proprietary.
- Core: Data Inventory, ROPA, DSAR, Incidents, LIA/Custom assessments, Vendor management
- Premium: DPIA templates & scoring (`@dpocentral/premium-skills`), security (`@dpocentral/security`)
- TIA (Transfer Impact Assessment): core template shipped (`system-tia-template`), ungated
- PIA, Vendor assessments: Coming Soon (no templates yet) — gated by `COMING_SOON_SKILL_IDS` in `src/config/skill-packages.ts`
- Public open-core snapshot: `https://github.com/RINDOGATAN/dpo` (AGPL-3.0)

## Key Architecture

- **Multi-tenancy**: All models scoped by `organizationId`. Use `organizationProcedure`.
- **Auth**: Google OAuth + Email Magic Link (Resend). JWT strategy. API routes must use `getToken` from `next-auth/jwt` (NOT `getServerSession` — breaks on Next.js 16).
- **Rate limiting**: `src/lib/rate-limit.ts` — `authLimiter` 30/min, `checkoutLimiter` 10/min, `dsarPublicLimiter` 5/10min, `exportLimiter` 10/min.
- **Auto-flow generation**: `generateFlowsForActivity` in `src/server/routers/privacy/dataInventory.ts` runs after `linkAssets` / `linkActivitiesToAsset` mutations. Sorts linked assets by `ASSET_FLOW_RANK` (APPLICATION→CLOUD_SERVICE→DATABASE→FILE_SYSTEM→THIRD_PARTY) and creates a chain of `DataFlow` records, deduped against existing flows in either direction. Manual trigger: `regenerateFlows` procedure + "Generate Flows" button on activity detail.
- **Icons**: All in `/public` only. Never put favicons in `src/app/` (Next.js prioritizes them over `/public`). `/logos` folder is gitignored (source files only).

## Modules

Data Inventory, DSAR, Assessments, Incidents, Vendors, AI Governance, Reports, Regulations, Transfer Compliance, Expert Directory, Admin Panel. (Notifications router exists for in-app bell but the cron + dispatcher were removed — see Cron Jobs.)

All list pages: debounced search, controlled Tabs, mobile/desktop layouts, responsive stats grids. **List queries that feed pickers** must use `useInfiniteQuery` with auto-fetch — silent truncation at the server `max()` cap is the most common bug class in this codebase.

## DSAR — Privacy by Design

- Public portal: `/dsar/[orgSlug]` — wired to `dsar.submitPublic`, consent checkbox required, returns publicId, rate-limited (5/10min/IP via `dsarPublicLimiter` in middleware). Status page at `/dsar/status/[token]` calls `dsar.checkStatus` with the publicId.
- Bad slug → 404 card via `dsar.getPublicForm` validation on mount.
- Auto-redaction: `/api/cron/dsar-redaction` redacts PII from completed DSARs after retention period (default 90 days). Scheduled daily at 03:00 UTC via `vercel.json` (`CRON_SECRET` env required).
- Manual redact/delete: `redactDSAR` and `deleteDSAR` mutations (admin only)
- Audit trail survives redaction (actions + timestamps, no PII)
- Settings: `DSARIntakeForm.retentionDays`, `privacyNoticeUrl`

## Export Pipeline (8 PDF Reports, 2 style systems)

`@react-pdf/renderer`. All routes share `src/lib/api-export.ts` for rate limiting (`exportLimiter`, 10/min/user) + try/catch error responses.

Two parallel style systems coexist:

1. **Design System v2** — `src/server/services/export/design-system/` (tokens.ts + primitives + charts). Navy-first palette, SVG-native donuts + horizontal bars, airy category tables with uppercase-navy headers and inline PillBadge / CategoryChip cells. Used by the three board-level reports.
2. **Legacy** — `src/server/services/export/pdf-styles.tsx`. Frozen; kept for the 5 untouched reports. Do NOT add features here; extend the design system instead.

| Report | Route | Style | Trigger |
|--------|-------|-------|---------|
| Privacy Program Report | `/api/export/privacy-program` | v2 | Main dashboard (primary CTA) + Data Inventory page |
| ROPA | `/api/export/ropa` | v2 | Data Inventory page (premium) |
| Vendor Register | `/api/export/vendor-register` | v2 | Vendors page |
| Assessment (individual) | `/api/export/assessment/[id]` | legacy | Assessment detail page |
| Assessment Portfolio | `/api/export/assessment-portfolio` | legacy | Assessments list page |
| DSAR Performance | `/api/export/dsar-performance` | legacy | DSAR list page |
| Regulatory Landscape | `/api/export/regulatory-landscape` | legacy | Regulations + Reports pages |
| Breach Register | `/api/export/breach-register` | legacy | Incidents page |

The **Privacy Program Report** is the consolidated board-level export: Cover + KPIs → Data Inventory → ROPA (compact) → Vendors → AI Governance (conditional) → Data Flow Map. It supersedes the standalone Data Inventory PDF (retired). ROPA remains standalone for auditor-grade Article 30 output.

**Design-system layout**: `design-system/` holds `tokens.ts` (single palette + type scale + space scale), `primitives/` (PageFrame, CoverFrame, SectionHeading, StatTile, KeyFinding, MiniCoverageBar, PillBadge, CategoryChip, CategoryTable, ConfidentialPill), `charts/` (DonutChart, HorizontalBarChart, StackedBar — all pure `<Svg>`), and `utils/palette-helpers.ts`. Each v2 report lives in its own folder (`privacy-program/`, `ropa/`, `vendor-register/`) with a `*Document.tsx` top-level composition. The Privacy Program Report splits into one page per section under `privacy-program/pages/`.

**Data-flow rendering**: `privacy-program/flow-input.ts :: buildFlowGraphInputs` applies a production + participation filter, drops orphaned nodes, and batches clusters (default ≤ 60 nodes / batch) into one `DataFlowPage` per batch. It returns shapes ready for the existing `renderFlowGraphPng` pipeline.

**Fonts**: All PDF body text uses **Inter** (4 weights vendored at `src/server/services/export/fonts/Inter-*.ttf`, SIL OFL). Registered from `design-system/fonts.ts` (v2) and `pdf-styles.tsx` (legacy) — `Font.register` is idempotent. Never use `fontStyle: "italic"` — Inter Italic is not vendored; use muted color instead. The Graphviz flow-map pipeline uses vendored Noto Sans Regular for node labels.

**Data Flow Map**: `src/server/services/export/flow-graph-pdf.tsx` renders a colour-coded, cluster-aware diagram via `@hpcc-js/wasm-graphviz` (DOT engine) → `@resvg/resvg-js` → PNG → `@react-pdf <Image>`. Route pre-renders the PNG before invoking `renderToBuffer` and passes it as a prop. Both packages are in `next.config.ts > serverExternalPackages` because Turbopack can't bundle the native binding / WASM blob. `FlowGraphImage` caps display height at 680 pt so oversized graphs never overflow a page.

**Critical**: never use `wrap={false}` on Views with unbounded lists — causes text overlap or "VIEW can't wrap" warnings.

**Preview harness**: `scripts/render-all-rebuilt-previews.ts [orgNameFilter]` renders all three v2 PDFs to `/tmp/dpocentral-exports/` without needing Next/auth. Optional org name filter picks by substring match; otherwise picks the org with the most data (AI systems weighted 5×). `scripts/export-demo-docs.ts` covers the 5 legacy reports against the seeded `demo` org.

## AI Systems & Models

- Detection: `src/config/vendor-ai-detection.ts` (`isAiCapableVendor`, `buildAISystemFromCatalog`)
- Detail page shows embedded models from `aiModels` JSON (name, type, source, EU AI Act risk tier)
- Status dropdown: DRAFT → REGISTERED → UNDER_REVIEW → COMPLIANT/NON_COMPLIANT → DECOMMISSIONED

## Cron Jobs

`/api/cron/dsar-redaction`: DSAR PII auto-redaction. Scheduled daily at 03:00 UTC in `vercel.json`; requires `CRON_SECRET` env to authenticate. The full notifications cron (deadline alerts, email/in-app/Slack) was removed; reinstating it requires restoring `dispatchNotification` in `src/server/services/notifications/dispatcher.ts` and adding a new cron entry.

## Deploy

Vercel is gated to **main-only** via `ignoreCommand` in `vercel.json`. Feature branches, Dependabot branches, and any non-`main` push are skipped at the Vercel build-trigger stage — no preview URLs, no build minutes consumed. To re-enable previews, remove the `ignoreCommand` line. Dependabot is configured in `.github/dependabot.yml` with weekly grouped PRs; `next-auth` major bumps are ignored (v4 → v5 is a breaking migration).

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
