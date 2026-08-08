# syntax=docker/dockerfile:1
# ============================================================================
# DPO Central — sovereign image (deploy/sovereign/docker-compose.yml).
# Multi-stage: deps → builder (prisma generate + standalone next build) →
# runner (minimal app), plus a standalone `migrator` stage (prisma CLI + tsx +
# migrations + seed scripts ONLY — no app build, ~300 MB vs the ~1.8 GB
# builder stage it used to be published from).
# The app code is UNCHANGED from cloud — only env differs (commandment #6).
# ============================================================================

# ---- deps: full install (dev deps included — the builder needs them) -------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
# The lockfile is written by npm 11.6; node:22's bundled npm 10 (and the
# newest npm 11.x) reject it ("Missing: … from lock file"). Pin the version
# that generated it.
RUN npm install -g npm@11.6.2
WORKDIR /app
COPY package.json package-lock.json ./
# @dpocentral/premium-skills and @dpocentral/security are PRIVATE git+ssh
# optionalDependencies — a clean container has no key for them. Strip them
# from the manifest + lockfile; the app's loaders (src/lib/skills,
# src/lib/security) degrade gracefully when the packages are absent.
RUN node -e "\
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
  delete pkg.optionalDependencies; \
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)); \
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')); \
  delete lock.packages[''].optionalDependencies; \
  for (const k of Object.keys(lock.packages)) \
    if (k.includes('@dpocentral/')) delete lock.packages[k]; \
  fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2));"
# Retry on a clean tree: under QEMU emulation (arm64 built on an amd64 CI
# runner) npm intermittently races on parallel dir creation, or simply hangs
# for hours (two 4h-hung builds on 2026-07-17). Same hardening as aisentinel.
RUN npm ci \
  || (echo "npm ci failed (emulation race?) — retrying clean" && rm -rf node_modules && npm ci) \
  || (rm -rf node_modules && npm ci)

# ---- builder: prisma client + standalone Next build ------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the bundles at BUILD time — thread
# them through as build args (compose passes them from .env). Changing any
# of these later requires: docker compose up -d --build app
ARG NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true
ARG NEXT_PUBLIC_EMAIL_AUTH_ENABLED=false
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ARG NEXT_PUBLIC_STRIPE_ENABLED=false
ARG NEXT_PUBLIC_BRAND_NAME="DPO Central"
ARG NEXT_PUBLIC_BRAND_ACCENT=""
ARG NEXT_PUBLIC_BRAND_LOGO_URL=""
ARG NEXT_PUBLIC_APP_URL="http://localhost:8485"
ARG NEXT_PUBLIC_AI_SENTINEL_URL=""
ARG NEXT_PUBLIC_AI_SENTINEL_ENABLED=true
# The expert directory is a cloud/marketplace feature: it needs the live
# Dealroom API. On a sovereign box there is no such backend, so hide the
# directory and its CTA entirely (the flag gates both).
ARG NEXT_PUBLIC_EXPERT_DIRECTORY_ENABLED=false
# Storefront for premium-skill discovery (self-host has no in-app checkout).
ARG NEXT_PUBLIC_MARKETPLACE_URL="https://todo.law/marketplace"
ENV NEXT_PUBLIC_LOCAL_AUTH_ENABLED=$NEXT_PUBLIC_LOCAL_AUTH_ENABLED \
    NEXT_PUBLIC_MARKETPLACE_URL=$NEXT_PUBLIC_MARKETPLACE_URL \
    NEXT_PUBLIC_EMAIL_AUTH_ENABLED=$NEXT_PUBLIC_EMAIL_AUTH_ENABLED \
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED \
    NEXT_PUBLIC_STRIPE_ENABLED=$NEXT_PUBLIC_STRIPE_ENABLED \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_BRAND_ACCENT=$NEXT_PUBLIC_BRAND_ACCENT \
    NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_AI_SENTINEL_URL=$NEXT_PUBLIC_AI_SENTINEL_URL \
    NEXT_PUBLIC_AI_SENTINEL_ENABLED=$NEXT_PUBLIC_AI_SENTINEL_ENABLED \
    NEXT_PUBLIC_EXPERT_DIRECTORY_ENABLED=$NEXT_PUBLIC_EXPERT_DIRECTORY_ENABLED \
    NEXT_OUTPUT_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# prisma generate needs no live DB; give next build a placeholder so nothing
# accidentally dials out during static generation.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# The repo's `npm run build` also runs `prisma migrate deploy` (for the
# hosted/Vercel lane) — that belongs to the migrator service, not an image
# build with a placeholder DATABASE_URL. Invoke the buildable steps directly,
# as separate layers so the client generation is independent of the app build.
RUN npx prisma generate
RUN npx next build

# ---- migrator: one-shot migrate + first-boot seed (published separately) ----
# Contains ONLY what deploy/sovereign/migrate.sh needs: the prisma CLI, tsx,
# the generated client, the migrations history (append-only, forever) and the
# seed scripts + their imports. The suite's compose runs it with
# working_dir /app and entrypoint ["/bin/sh", "deploy/sovereign/migrate.sh"] —
# keep that path layout stable.
# Layers are ordered most-stable-first so a typical release only re-downloads
# the few-MB tail (migrations / seed scripts / snapshot), not the deps.
FROM node:22-alpine AS migrator
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Versions pinned to package-lock.json — keep in sync when bumping
# prisma/@prisma/client/tsx there. Installed explicitly instead of copying the
# app's full node_modules (which is what made the old migrator image ~1.8 GB).
# Caches are dropped in the same RUN so they never land in a layer (they are
# ~275 MB — bigger than everything the image actually keeps).
RUN npm install --no-save --no-audit --no-fund \
      prisma@5.22.0 @prisma/client@5.22.0 tsx@4.22.3 \
    && rm -rf /root/.npm /root/.cache
# Client generation depends only on the schema, not the app build.
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate && rm -rf /root/.cache
# Most-churn tail: migrations, seed scripts and the exact files they import
# (tsx loads only what's imported — see prisma/seed.ts and scripts/seed-*.ts),
# the vendor catalog snapshot, and the entrypoint script.
COPY package.json ./
COPY prisma/migrations ./prisma/migrations
COPY prisma/seed.ts ./prisma/seed.ts
COPY scripts/assert-safe-db.ts scripts/seed-templates.ts scripts/seed-vendor-questionnaire.ts ./scripts/
COPY src/config/jurisdiction-data.ts ./src/config/jurisdiction-data.ts
COPY src/lib/seed-catalog-from-snapshot.ts src/lib/vendor-watch-mapper.ts src/lib/vendor-watch-types.ts ./src/lib/
COPY vendors/catalog-snapshot.json ./vendors/catalog-snapshot.json
COPY deploy/sovereign/migrate.sh ./deploy/sovereign/migrate.sh

# ---- runner: minimal standalone runtime -------------------------------------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
