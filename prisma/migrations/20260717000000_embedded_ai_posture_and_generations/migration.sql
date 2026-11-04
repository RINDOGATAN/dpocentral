-- Embedded AI (Phase 1): per-organization AI posture + metadata-only
-- generation audit. Additive only — one new enum and two new tables; no
-- existing table, column, or row is touched.

-- CreateEnum
CREATE TYPE "AiPosture" AS ENUM ('off', 'local_gateway', 'cloud_eu', 'cloud_us');

-- CreateTable
CREATE TABLE "organization_ai_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "posture" "AiPosture" NOT NULL DEFAULT 'off',
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "model" TEXT,
    "posture" "AiPosture" NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_ai_settings_organizationId_key" ON "organization_ai_settings"("organizationId");

-- CreateIndex
CREATE INDEX "ai_generations_organizationId_createdAt_idx" ON "ai_generations"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "organization_ai_settings" ADD CONSTRAINT "organization_ai_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_ai_settings" ADD CONSTRAINT "organization_ai_settings_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
