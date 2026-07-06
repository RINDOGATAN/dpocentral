# Vendor data sourcing

DPO Central owns its own database. It no longer shares vendor.watch's DB.
Vendor data reaches DPO over HTTP, not through a shared schema. There are
two distinct data sets, sourced two different ways.

## 1. Global vendor catalog (live now)

The platform-wide reference catalog (`vendor_catalog`, model `VendorCatalog`)
is a DPO-owned mirror. It is populated by syncing from vendor.watch's
`/catalog/sync` API, the same endpoint AI Sentinel already consumes.

- Job: `scripts/sync-vendor-catalog.ts` (`npm run db:sync-vendor-catalog`).
- It fetches vendors page by page (`x-api-key` auth), maps each to DPO's
  `VendorCatalog` columns (`src/lib/vendor-watch-mapper.ts`), and upserts by
  `slug` into the local table. It never touches vendor.watch's database.
- Config: `VENDORWATCH_CATALOG_API_URL` and `VENDORWATCH_CATALOG_API_KEY`.
- Cloud: run the sync on a schedule so the catalog stays fresh.
- Self-host / sovereign: run it once on operator demand to seed the catalog,
  then remove the credentials and stay air-gapped. See the sovereign
  `.env.example` for the operator-triggered refresh command.

### Fresh-install seed: the release snapshot

A fresh install does not have API credentials yet, so the catalog seeds from a
release-generated snapshot rather than the live sync. `vendors/catalog-snapshot.json`
is the full, rich catalog exported by vendor.watch at release time
(`db:export-snapshot`) in the **same shape** as the live `/catalog/sync`
payload, so it flows through the same mapper (`src/lib/vendor-watch-mapper.ts`).

- `prisma/seed.ts` and `npm run db:seed-vendors` both call
  `seedCatalogFromSnapshot` (`src/lib/seed-catalog-from-snapshot.ts`), which
  reads `vendors/catalog-snapshot.json` and upserts every vendor by `slug`.
  The catalog is core to a fresh install, so it fails **loudly** (throws) if
  the snapshot is missing, unparseable, or implausibly small — never a silent
  warn.
- The snapshot is **not committed to this repo**. It is dropped in at release
  time by vendor.watch's owner step. Only a small test fixture lives in
  `tests/fixtures/`.
- Reconciling existing installs: `npm run db:seed-vendors -- --prune` deletes
  vendor-catalog rows absent from the snapshot **only** when they are ours
  (`source` ∈ `vendor-watch` / `processors.json` / `seed`). It never deletes a
  verified, publicly-profiled, or operator-curated row.
- After a fresh install is seeded, the live sync
  (`npm run db:sync-vendor-catalog`) keeps the catalog current going forward.

## 2. Per-user vendor.watch portfolio (DEFERRED — Part B)

A user's personal vendor.watch portfolio (`portfolio_vendors`, model
`VwPortfolioVendor`) is now a DPO-owned table too, but it is **not yet
populated**. Building the import is a deferred follow-up (Part B of the DB
decoupling).

The plan: vendor.watch pushes a user's portfolio to DPO through an API keyed
by the user's email (identity is linked by email across todo.law apps), never
through the shared DB. Until that API exists, the table stays empty.

The quickstart's "import from your vendor.watch portfolio" step already
handles the empty case gracefully: the read is wrapped so an empty or absent
`portfolio_vendors` returns "no portfolio", and the user proceeds with the
normal flow. No error, no blocked onboarding.

## Identity: JIT provisioning

Because DPO owns its own `users` table, a cross-app `*.todo.law` SSO session
can arrive for a user with no local DPO row. DPO mints one just-in-time from
the token claims, keyed by email (`src/lib/jit-provisioning.ts`, wired into
the NextAuth `jwt` callback). A JIT user has no org membership yet and lands
in the normal "create or join an organization" onboarding. Identity is linked
by email; DPO-specific data starts fresh.
