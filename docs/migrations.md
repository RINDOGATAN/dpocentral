# Database migrations: forward-only, and how an upgrade is rehearsed

Dated 19 September 2026. Applies to both postures (see `docs/security.md`).

## The rule

Migrations under `prisma/migrations/` are **append-only, forever**. A
self-hosted install may jump from any published version straight to the
latest, so every migration ever published must still apply, in order, to the
database it finds.

- Never edit, rename, reorder or delete a migration that has been merged to
  `main` or published in a tag. A mistake is corrected by a new migration.
- There are no down migrations. Going back means restoring the backup taken
  before the upgrade, not reversing the schema.
- Prefer additive changes: a new nullable column, a new table, a new index.
  A change that removes or narrows something (dropping a column, making one
  required, adding a unique constraint) is done in two releases: first the
  code stops depending on the old shape and existing rows are made to fit;
  only a later release changes the schema. Before adding a unique constraint,
  count the duplicates it would reject on hosted and say how they are
  resolved.
- A migration must succeed on an empty database (fresh install) and on a
  database carrying real data (upgrade). Write it for both.

## How migrations are applied

| Posture | When | How |
|---|---|---|
| Hosted service | On every build from `main` | `npm run build` runs `scripts/assert-safe-db.ts`, then `prisma migrate deploy`, then the Next.js build. Merging a migration to `main` applies it to the hosted database |
| Self-hosted bundle | On every boot of the one-shot migrator, before the app starts | `deploy/sovereign/migrate.sh`: `prisma migrate deploy`, with automatic baselining for installs created before the migrations history existed and recovery from a half-finished first run (P3005). The app does not start unless the migrator exits 0 |
| CI | Never against a database | CI builds with `npx next build` and a dummy `DATABASE_URL`; it does not migrate |

The migrator then refreshes built-in content (catalog, system templates,
questionnaire) on installs that already have users. That refresh touches only
rows the release owns and is described in `deploy/sovereign/README.md`.

## Writing a migration

1. Change `prisma/schema.prisma`.
2. Against a local database only (never the hosted one, never a shared one):
   `docker compose up -d postgres`, then
   `export DATABASE_URL="postgresql://dpocentral:dpocentral_dev@localhost:5434/dpocentral?schema=public"`
   and `npm run db:migrate-dev -- --name <what_it_does>`.
3. Without any database, the SQL can be produced with
   `npx prisma migrate diff --from-schema-datamodel <old schema> --to-schema-datamodel prisma/schema.prisma --script`
   and saved as `prisma/migrations/<UTC timestamp>_<name>/migration.sql`.
4. Read the SQL. Check that it only adds, or that the two-release rule above
   is followed.
5. Record in the pull request whether a migration is included, because
   merging it applies it to the hosted database.

## Rehearsing an upgrade

An upgrade is rehearsed on a copy, never on the live database. The rehearsal
proves that the new migrator applies cleanly to real data and changes nothing
it should not.

**Self-hosted bundle (from a backup):**

1. Take or pick a recent backup made by `backup.sh`.
2. Start a disposable Postgres 16 bound to localhost, for example
   with the same user and database names as the bundle, so the dump's ownership
   statements apply:
   `docker run -d --name dpc-rehearsal -e POSTGRES_USER=dpocentral -e POSTGRES_DB=dpocentral -e POSTGRES_PASSWORD=rehearsal -p 127.0.0.1:5439:5432 postgres:16-alpine`.
3. Decrypt and load the backup into it, with `BACKUP_PASSPHRASE` exported from
   that install's `.env` (do not print it):
   `openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in <backup>.sql.gz.enc | gunzip | psql postgresql://dpocentral:rehearsal@127.0.0.1:5439/dpocentral`.
4. Before the upgrade, record a fingerprint of every table:
   row counts, and `md5(string_agg(t::text, '' ORDER BY t::text))` per table.
5. Build the new migrator (`docker build -f deploy/sovereign/Dockerfile --target migrator -t dpc-migrator:rehearsal .`)
   or pull the release's `ghcr.io/rindogatan/dpocentral-migrator:<tag>`, and run it
   against the copy. The image has no entrypoint of its own, so name the script:
   `docker run --rm --network host -e DATABASE_URL=postgresql://dpocentral:rehearsal@127.0.0.1:5439/dpocentral --entrypoint /bin/sh dpc-migrator:rehearsal deploy/sovereign/migrate.sh`.
6. Pass criteria: the migrator prints `[migrate] done.` and exits 0; a second
   run is a no-op; the fingerprints of the firm's own tables are unchanged
   (only built-in content rows and the new schema differ); the app image
   started against the copy answers `GET /api/health` with 200.
7. Delete the container and any decrypted file: they hold a copy of real
   data.

**Hosted service:** the same test runs on a branch of the hosted database
created from the provider's point-in-time history, with `DATABASE_URL` set to
that branch and `npx prisma migrate deploy` run from the release commit. The
branch is deleted afterwards. This needs the maintainer's access to the
database provider.

**Across the suite:** the monthly seam test in the suite kit boots the three
apps' `:latest` images together (migrators exit 0, apps answer 200). A red run
stops tagging until it is fixed.
