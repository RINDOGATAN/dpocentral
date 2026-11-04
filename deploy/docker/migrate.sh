#!/bin/sh
# One-shot migrator for the Docker install. Runs inside the slim `migrator`
# image (prisma CLI + tsx + migrations + seed script present). Safe to re-run
# any time:
#
#   docker compose run --rm migrator
#
# Schema: `prisma migrate deploy` applies the committed prisma/migrations
# history. Three cases:
#   fresh DB          -> migrate deploy applies the whole history;
#   pre-migrations DB -> tables exist but there is no _prisma_migrations
#                       table: baseline (mark every migration applied
#                       without running it), then deploy the rest;
#   migrated DB       -> migrate deploy applies whatever is new.
# Recovery: a deploy failing with P3005 ("schema is not empty") falls back to
# baselining and deploys again.
# Seed: first boot gets the baseline (the jurisdiction catalogue; a demo
# organization only with DEMO_SEED=true). An instance that already has users
# gets a content-only refresh of the jurisdiction catalogue on every boot.
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
  echo "[migrate] existing users found: refreshing the built-in content (content only)…"
  if SEED_CONTENT_ONLY=true npx tsx prisma/seed.ts; then
    echo "[migrate] built-in content refreshed."
  else
    echo "[migrate] WARNING: content refresh failed; the app starts on the content it already has."
  fi
else
  echo "[migrate] first boot: seeding the baseline content…"
  npx tsx prisma/seed.ts
fi

echo "[migrate] done."
