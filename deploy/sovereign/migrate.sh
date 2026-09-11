#!/bin/sh
# One-shot migrator for the sovereign bundle. Runs inside the slim `migrator`
# image (prisma CLI + tsx + migrations + seed scripts present). Safe to re-run
# any time:
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
# Seed: first boot gets the full baseline (demo org/user only with
# DEMO_SEED=true). An instance that already has users gets a content-only
# refresh on every boot (built-in catalog and templates, rows we own only),
# then the untouched demo organization of older installs is removed.
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
  # Existing install: refresh the BUILT-IN content on every boot, so upgrades
  # ship catalog and template improvements, not just code. Every write is an
  # upsert by a stable identifier that touches only rows we own: catalog rows
  # from our own sources, and system templates/questionnaire (never one the
  # firm installed at a newer version). Catalog rows retired upstream are
  # pruned with the same scoped rule as `db:seed-vendors -- --prune`, so an
  # upgraded install matches a fresh one. SEED_CONTENT_ONLY stops before any
  # account or demo data, so nothing is (re)planted into a firm's database.
  # A failure here is logged and the app still starts on the content it has.
  echo "[migrate] existing users found — refreshing built-in content (content only)…"
  if SEED_CONTENT_ONLY=true npm run db:seed \
      && npm run db:seed-templates \
      && npm run db:seed-questionnaire; then
    echo "[migrate] built-in content refreshed."
  else
    echo "[migrate] WARNING: content refresh failed — the app starts on the content it already has."
  fi
  # Installs seeded before demo data needed DEMO_SEED=true carry a sample demo
  # organization. Remove it, but only if nobody has used it (the script
  # checks strictly and keeps it on any doubt).
  if [ "${DEMO_SEED:-}" != "true" ]; then
    npm run db:remove-untouched-demo \
      || echo "[migrate] WARNING: demo cleanup failed — the demo organization was left in place."
  fi
else
  # First boot: catalog, jurisdictions, skill packages and system templates.
  # The demo organization, user and sample records are seeded only with
  # DEMO_SEED=true. db:seed carries the minimal baseline; the assessment
  # templates (LIA/CUSTOM/TIA) + the vendor questionnaire live in their own
  # seed scripts. Without these, the assessment wizards render empty.
  # (Premium DPIA/PIA templates are installed from signed skill packages, so
  # none ship in the self-hosted image by design.)
  echo "[migrate] first boot — seeding baseline content…"
  npm run db:seed
  npm run db:seed-templates
  npm run db:seed-questionnaire
fi

echo "[migrate] done."
