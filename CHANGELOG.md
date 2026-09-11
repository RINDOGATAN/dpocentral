# Changelog

All notable changes to DPO Central are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org).

## [0.1.25] - 2026-09-11

### Fixed

- **Self-host installs now receive content updates.** The sovereign migrator
  seeded only on first boot, so an upgraded install kept the vendor catalog
  and templates it was born with (736 vendors from July against 884 on a
  fresh install). Existing installs now refresh the built-in content on
  every boot through a content-only seed mode (`SEED_CONTENT_ONLY`): the
  vendor catalog, jurisdictions, skill packages, the system assessment
  templates and the vendor questionnaire are upserted by stable identifiers,
  and catalog rows retired upstream are pruned. Only rows the release owns
  are written: a catalog row from any other source is never overwritten, and
  a system template is never downgraded (one installed from a signed skill
  package at a newer version is kept). No account or demo data is written in
  this mode. A failed refresh is logged and the app still starts.
- **Demo data now actually requires `DEMO_SEED=true`.** The demo
  organization, demo user and sample records were seeded on every fresh
  install although this changelog said otherwise; they are now gated like
  the demo platform admin. The sovereign compose file passes `DEMO_SEED`
  through to the migrator (empty by default).
- **Existing installs drop the unused demo organization.** On boot, the
  migrator removes the demo organization and demo user that earlier
  releases seeded, but only when nobody has used them: any other member,
  any added or edited record, or any audit activity keeps them, and the
  deletion is checked table by table inside a transaction. It never runs
  where `DEMO_SEED=true`. Available on its own as
  `npm run db:remove-untouched-demo` (`-- --dry-run` to preview).

## [1.0.0] - 2026-07-06

First public release of DPO Central, a multi-tenant privacy operations
platform (DSAR handling, records of processing, vendor and transfer
management, jurisdiction-aware compliance) in English and Spanish. The same
codebase runs the hosted service and the `deploy/sovereign` Docker bundle.

### Product

- DSAR intake and workflow, including an anonymous public intake path
- Records of processing, vendor and cross-border transfer registries
- Jurisdiction-aware compliance built on a unified jurisdiction source of
  truth (`src/config/jurisdiction-data.ts`)
- PDF export of privacy documentation
- Five-tier role model (Owner, Admin, Privacy Officer, Member, Viewer)

### Security

- Multi-tenant isolation enforced on every organization-scoped tRPC procedure;
  by-id access resolves the target row scoped to `organizationId`.
- Role-based access control enforced across the procedure layer in the
  open-source build (previously partially dependent on an optional module).
- Content-Security-Policy enforced; cron endpoints fail closed without their
  secret; session cookies are host-only by default (`.todo.law` is opt-in).
- Internal artifacts and personal data removed from the tracked tree and from
  first-run seeding; demo data now requires `DEMO_SEED=true`.

### Content

- 2026 jurisdiction refresh: Mexico (2025 federal law, post-INAI enforcement),
  Nigeria NDPA 2023, California CCPA/CPRA thresholds, LGPD breach timing,
  UK adequacy renewal. The three jurisdiction registries are unified on one
  source of truth.
- "Not legal advice" disclaimers added across the app, seeded templates, and
  PDF footers, in English and Spanish.

### Tooling and operability

- `/api/health` endpoint with a real database check, wired to the sovereign
  container healthcheck.
- Prisma migrations history adopted for a safe update path.
- First test suite (tenant isolation, RBAC, public DSAR intake) and CI
  (lint, typecheck, test, build); `ignoreBuildErrors` removed so the build
  type-checks clean.
- Governance set: `LICENSE` (AGPL-3.0-or-later), `README`, `NOTICES`,
  `SECURITY`, `CONTRIBUTING`, this changelog; AGPL §13 source offer in the
  app footer.
- A stranger can `npm ci`: private optional dependencies dropped, `engines`
  declared, root README added.

### Operator note

A one-time hosted-database cleanup script (`scripts/cleanup-catalog-v3.ts`)
ships with this release to remove pre-v3 catalog rows and a legacy admin
record. Run it once against the live database with the dry-run flag first.
