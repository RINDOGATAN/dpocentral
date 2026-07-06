# Changelog

All notable changes to DPO Central are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org).

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
