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
