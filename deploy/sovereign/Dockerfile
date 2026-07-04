# syntax=docker/dockerfile:1
# ============================================================================
# DPO Central — sovereign image (deploy/sovereign/docker-compose.yml).
# Multi-stage: deps → builder (prisma generate + standalone next build) →
# runner (minimal). The `builder` stage doubles as the one-shot migrator
# (it has the prisma CLI, tsx and the seed scripts).
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
RUN npm ci

# ---- builder: prisma client + standalone Next build (also the migrator) ----
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
ENV NEXT_PUBLIC_LOCAL_AUTH_ENABLED=$NEXT_PUBLIC_LOCAL_AUTH_ENABLED \
    NEXT_PUBLIC_EMAIL_AUTH_ENABLED=$NEXT_PUBLIC_EMAIL_AUTH_ENABLED \
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED \
    NEXT_PUBLIC_STRIPE_ENABLED=$NEXT_PUBLIC_STRIPE_ENABLED \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_BRAND_ACCENT=$NEXT_PUBLIC_BRAND_ACCENT \
    NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_OUTPUT_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# prisma generate needs no live DB; give next build a placeholder so nothing
# accidentally dials out during static generation.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build

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
