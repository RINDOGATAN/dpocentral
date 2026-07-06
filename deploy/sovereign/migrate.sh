#!/bin/sh
# One-shot migrator for the sovereign bundle. Runs inside the builder image
# (prisma CLI + tsx + migrations + seed scripts present). Safe to re-run any
# time:
#
#   docker compose run --rm migrator
#
# Schema: the repo ships a real prisma/migrations history (baseline 0_init
# generated from the full schema), so `prisma migrate deploy` is the
# canonical apply. Three cases:
#   fresh DB          → migrate deploy applies the whole history (0_init
#                       bootstraps an empty database);
#   pre-migrations DB → tables exist from the old `db push` era but there is
#                       no _prisma_migrations table: baseline (mark 0_init
#                       applied without running it), then deploy the rest;
#   migrated DB       → migrate deploy applies whatever is new. No-op
#                       otherwise.
# Recovery: a deploy failing with P3005 ("schema is not empty") means tables
# exist but were never baselined (e.g. a previous run died mid-way) — it
# falls back to baselining and re-deploys, so a half-initialized DB heals
# instead of blocking the app (compose gates app start on this service).
# Seed: baseline catalogs + a demo org/user — FIRST boot only; an instance
# that already has users is never re-seeded (the seed's upserts could
# otherwise clobber live edits to seeded rows).
set -eu
cd /app

table_exists() {
  node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"SELECT to_regclass('public.$1')::text AS r\").then(rows=>process.exit(rows[0].r?0:1)).catch(()=>process.exit(1))"
}

# Mark every repo migration as applied, oldest first. Re-runnable: a
# migration already recorded (mid-baseline crash recovery) is skipped; any
# real failure surfaces on the `migrate deploy` that always follows.
baseline() {
  echo "[migrate] baselining migration history…"
  for d in prisma/migrations/*/; do
    npx prisma migrate resolve --applied "$(basename "$d")" >/dev/null 2>&1 \
      || echo "[migrate]   $(basename "$d"): already recorded — skipping"
  done
}

# `migrate deploy` with a P3005 net: an existing-but-unbaselined schema is
# recovered by baselining, then deploying again. Any other failure is fatal.
deploy() {
  if out=$(npx prisma migrate deploy 2>&1); then
    echo "$out"
  else
    echo "$out"
    case "$out" in
      *P3005*)
        echo "[migrate] P3005 — schema exists without migration history; recovering via baseline…"
        baseline
        npx prisma migrate deploy
        ;;
      *)
        exit 1
        ;;
    esac
  fi
}

if table_exists _prisma_migrations; then
  echo "[migrate] migration history found — applying prisma/migrations (migrate deploy)…"
  deploy
elif table_exists users; then
  echo "[migrate] pre-migrations schema detected (db push era) — baselining, then deploying…"
  baseline
  npx prisma migrate deploy
else
  echo "[migrate] fresh database — applying full migration history (migrate deploy)…"
  deploy
fi

if node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>process.exit(c>0?0:1)).catch(()=>process.exit(1))"; then
  echo "[migrate] existing users found — skipping seed."
else
  echo "[migrate] first boot — seeding baseline + demo data…"
  npm run db:seed
fi

echo "[migrate] done."
