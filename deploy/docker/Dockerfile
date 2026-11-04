# syntax=docker/dockerfile:1
# ============================================================================
# DPO Central community edition: Docker image (deploy/docker/docker-compose.yml).
# Multi-stage: deps -> builder (prisma generate + standalone next build) ->
# runner (minimal app), plus a `migrator` stage (prisma CLI + tsx +
# migrations + seed script only).
# ============================================================================

# ---- deps: full install (dev deps included: the builder needs them) --------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
# The lockfile is written by npm 11; pin the version that reads it.
RUN npm install -g npm@11.6.2
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci || (rm -rf node_modules && npm ci)

# ---- builder: prisma client + standalone Next build ------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the bundles at BUILD time: they are
# passed as build args (compose passes them from .env). Changing any of them
# later requires: docker compose up -d --build app
ARG NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true
ARG NEXT_PUBLIC_EMAIL_AUTH_ENABLED=false
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ARG NEXT_PUBLIC_BRAND_NAME="DPO Central"
ARG NEXT_PUBLIC_BRAND_ACCENT=""
ARG NEXT_PUBLIC_BRAND_LOGO_URL=""
ARG NEXT_PUBLIC_APP_URL="http://localhost:8485"
ARG NEXT_PUBLIC_DSAR_ENABLED=""
# The commit /api/health reports (.git is not in the build context).
ARG SOURCE_COMMIT=""
ENV SOURCE_COMMIT=$SOURCE_COMMIT \
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED=$NEXT_PUBLIC_LOCAL_AUTH_ENABLED \
    NEXT_PUBLIC_EMAIL_AUTH_ENABLED=$NEXT_PUBLIC_EMAIL_AUTH_ENABLED \
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_BRAND_ACCENT=$NEXT_PUBLIC_BRAND_ACCENT \
    NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_DSAR_ENABLED=$NEXT_PUBLIC_DSAR_ENABLED \
    NEXT_OUTPUT_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# prisma generate needs no live database; next build gets a placeholder so
# nothing dials out during static generation.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate
RUN npx next build

# ---- migrator: one-shot migrate + first-boot seed ---------------------------
# Contains only what deploy/docker/migrate.sh needs: the prisma CLI, tsx, the
# generated client, the migrations and the seed script with its import.
FROM node:22-alpine AS migrator
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Versions pinned to package-lock.json: keep in sync when bumping them there.
RUN npm install --no-save --no-audit --no-fund \
      prisma@5.22.0 @prisma/client@5.22.0 tsx@4.22.3 \
    && rm -rf /root/.npm /root/.cache
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate && rm -rf /root/.cache
COPY package.json ./
COPY prisma/migrations ./prisma/migrations
COPY prisma/seed.ts ./prisma/seed.ts
COPY src/config/jurisdiction-data.ts ./src/config/jurisdiction-data.ts
COPY deploy/docker/migrate.sh ./deploy/docker/migrate.sh

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
