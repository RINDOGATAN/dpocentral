#!/bin/sh
# One-shot migrator for the sovereign bundle. Runs inside the builder image
# (prisma CLI + tsx + seed scripts present). Safe to re-run any time:
#
#   docker compose run --rm migrator
#
# Schema: the repo ships no prisma/migrations dir, so `prisma db push` is the
# canonical apply. Seed: baseline catalogs + a demo org/user — FIRST boot
# only; an instance that already has users is never re-seeded (the seed's
# upserts could otherwise clobber live edits to seeded rows).
set -eu
cd /app

echo "[migrate] applying Prisma schema (db push)…"
npx prisma db push --skip-generate

if node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>process.exit(c>0?0:1)).catch(()=>process.exit(1))"; then
  echo "[migrate] existing users found — skipping seed."
else
  echo "[migrate] first boot — seeding baseline + demo data…"
  npm run db:seed
fi

echo "[migrate] done."
