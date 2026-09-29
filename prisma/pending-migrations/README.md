# Pending migrations

Migrations written and tested, but not yet released. `prisma migrate deploy`
reads only `prisma/migrations/`, so nothing here runs on its own: not on the
hosted build (which migrates on build) and not in the self-hosted migrator
(which migrates on every boot).

To release one, in the migration window:

1. Run its `precheck.sql` against the target database and keep the output.
2. Take the dump its `migration.sql` asks for, and keep it.
3. Move the folder into `prisma/migrations/`. Its name must sort after every
   migration already there; rename the timestamp if a newer one was added
   since it was written.
4. Commit, then deploy as usual (`prisma migrate deploy`).

Migrations are append-only: once a folder is in `prisma/migrations/` and
released, it is never edited or removed.

## 20260929120000_drop_old_vendor_tables

Drops the seven tables left from before the July 2026 separation from
vendor.watch (`vendor_claims`, `vendor_suggestions`, `vw_cert_evidence`,
`vw_dpa_documents`, `vw_enrichment_requests`, `vw_expert_reviews`,
`vw_vendor_questionnaires`). No model and no code reference them. Dump first:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=old-vendor-tables.dump \
  -t vendor_claims -t vendor_suggestions -t vw_cert_evidence -t vw_dpa_documents \
  -t vw_enrichment_requests -t vw_expert_reviews -t vw_vendor_questionnaires
```
