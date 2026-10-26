# Changelog

All notable changes to DPO Central are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Fixed

- **Assessment risk score and level come from the answers**. The score averaged a per-answer
  `riskScore` that templates never fill, so every assessment showed 0% and "Low". It is now
  derived in `src/server/services/assessment/risk-score.ts`: weighted indicator answers
  (the template's `riskWeight`, or the weights listed there for the v2 LIA, TIA, PIA and
  Custom templates), and, where the assessment records its own conclusion (DPIA residual risk,
  PIA overall risk, Custom overall risk, TIA likelihood by severity), that conclusion sets the
  level and the score stays inside its band. Computed on display (detail, list, statistics,
  reports, vendor and transfer views, exports), so assessments scored earlier show correctly
  with no stored change and no migration.

### Changed

- **The hosted pilot's editing window is 15 days, not 90**. One constant,
  `PILOT_DAYS` in `src/server/services/pilot/caps.ts`; the documentation, Settings card and
  sign-in screen read it. Transition, computed and not stored (no migration): an organisation
  whose window started before the end of 11 Oct 2026 (UTC) keeps whichever ends earlier of its
  original 90-day end and 15 days from then, so nobody becomes read-only at the release. The
  read-only message no longer names a number of days.

### Added

- **Register import reads Excel workbooks and offers templates**. The one-register import in
  Settings reads `.xlsx` files (the first sheet) as well as CSV, through `read-excel-file`; the
  workbook's unpacked size is checked against `MAX_XLSX_UNPACKED_BYTES` (100 MB) before it is
  read, and the 20,000-row cap and the upload limit are unchanged. Each register has an empty
  template (CSV, and Excel) with the headers in the reader's language, from
  `GET /api/portability/register/template`. Vendor names are matched by exact normalised name
  against the vendor catalogue: the vendors register links a match through
  `metadata.catalogSlug`, a system's provider through `metadata.vendorCatalogSlug`, and the new
  "Vendors or systems" column of processing activities is kept in `metadata.vendors` with each
  name's catalogue slug. A name with no match, or with more than one, is kept as written with a
  row note.
- **Model replies to rights requests**: the six approved
  letters (acknowledgement, identity, extension, refusal, one favourable reply per right,
  repetitive access), in English and Castilian Spanish, offered in the request's "Send message"
  panel by type and language. The app fills the requester's name, the reference, the dates, the
  organisation's name, the status link and the privacy contact; sending is blocked, in the page
  and on the server, while any placeholder in braces remains.
- **Rights requests per organisation on the hosted service**. A pilot
  organisation may receive 3 requests through the public form in total; an organisation on the
  paid plan needs the add-on (`dsarModuleStatus` ACTIVE, set with
  `npm run db:set-dsar-module`, dry run unless `--execute`) and may then receive 10 per calendar
  month, Europe/Madrid. Requests entered by staff never count. At the limit the form shows the
  organisation's privacy contact e-mail (new optional setting). Without the add-on the menu
  shows "Available as an add-on: 49 USD a month" ("49 € al mes" in Spanish), the public form and
  status pages show a neutral "not available" page, and every request already held stays
  readable. The kit is unchanged. Migration `20261011180000_dsar_module_addon` (one enum, four
  nullable columns).
- **Hosted retention**: the personal data of a closed request is removed 30 days after closing
  (fixed; the 1 to 3650-day setting applies on the kit only), and every closing status now
  records its closing date. A new nightly job (`/api/cron/dsar-inactive`) deletes open requests
  with no activity for 30 days, after an e-mail notice to owners and administrators 7 days
  before, and keeps a contentless entry in the organisation's audit log.
- **Support reads** (`npm run db:dsar-support-read`) write a SUPPORT entry in the request's own
  trail before reading.
- The requester is told by e-mail when the deadline is extended (new date; the reasons follow
  from the organisation). Staff are warned when the same address made an access request in the
  six months before (LOPDGDD art. 13.3). Generated tasks are titled in the reader's language.
- **Public form abuse protection**: hidden field, minimum fill time, shared daily limits in the
  database (per address and per organisation), and at most 3 acknowledgement e-mails a day to one
  recipient (migration `20261011150000_rate_limit_counters`).

- **Take your programme with you** ("Llévate tu programa"), in Settings:
  the whole programme as one ZIP in an open, documented format
  (`dpocentral-programme/1.0`): `programme.json` with stable ids and
  explicit references, one CSV per register (UTF-8 with a byte-order mark,
  headers in the reader's language), the JSON Schema (draft 2020-12) and an
  explanation of every field in English (README.md) and Spanish (LEEME.md),
  and a manifest with a SHA-256 digest per file. Streamed page by page.
  Owners and admins only; recorded in the audit trail. Rights requests
  (personal data) only with a separate box that says so. This is also how
  DPO Central supports switching and export under the EU Data Act,
  Chapter VI.
- **Import a programme** ("Importar un programa"), in Settings: a programme
  in that format (the ZIP or programme.json) into a new or empty
  organisation, or one register (processing activities, systems, vendors)
  from a CSV file with a column-matching step. A check shows the counts and
  every problem before anything is written; records arrive as drafts to
  confirm; nothing is overwritten; the same file twice adds nothing.
  Migration `20261009200000_programme_import_records` (additive only: the
  `IMPORTED` provenance and one new table).

- **Audit trail** ("Registro de auditoría"), under Library and tools: the
  organisation's audit log, newest first, filtered by area, action, person
  and dates, fifty entries at a time, and exported as CSV with the same
  filters (the export is itself recorded). Owners, admins and privacy
  officers only; the menu leaves it out for other members and the server
  refuses them. Entries about rights requests show the reference and the
  action only, on screen and in the CSV; without the rights-request module
  they are left out. English and Spanish. No database change.

### Changed

- **The DPIA licence lock moves from the menu to the DPIA option.** The
  Assessments step no longer carries a lock. On your own instance, where
  the DPIA is not licensed, the lock sits on the DPIA card of the
  Assessments page and of the type picker, labelled "Requires a licence"
  ("Requiere una licencia") with no price. Same entitlement check; never on
  the hosted pilot. The Vendor due diligence lock is unchanged.

### Removed

- The help text "Require ID upload before processing": the form never asks for one.
- **The Classic layout.** Guided is now the only dashboard layout. The
  layout switch (the Settings card, the account menu entry and Classic's way
  back), the Classic top bar and its menus, and the Classic dashboard (its
  counters, request queue, recent activity, quick actions and vendor card)
  are gone, with their translations and tests. Every Classic menu entry stays
  in the Guided menu.
- Old links keep working: the `?skin=` parameter is dropped from dashboard
  addresses with a redirect to the same page. A stored `dpc_skin` cookie is
  left in place and ignored. No database change.

### Changed

- **The user guide describes the Guided product.** Getting started now
  covers the dashboard (programme figure, six areas, what is missing), the
  documents panel and "Download ready documents", the next three actions,
  Needs action and the deadlines at risk, and the menu (state words,
  document lines, "Not in DPO Central yet", the licence lock on your own
  instance). All clients and the executive report replace the client cards
  and the old board report export. The pages that pointed to the main
  navigation bar or the DPIA quick action now point to the menu. English
  and Spanish.
- The left menu's organisation switcher now always opens and ends with
  "Add a client" (privacy professionals) or "New organization" (everyone
  else), the entry Classic's dashboard switcher offered to every person.

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
