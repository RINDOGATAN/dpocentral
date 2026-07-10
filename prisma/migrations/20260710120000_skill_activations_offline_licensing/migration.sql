-- Offline skill licensing: activation tracking for Ed25519 licence files.
-- Adds SkillActivation (one row per installation per entitlement) and the
-- maxActivations limit carried by storefront licences.

-- AlterTable
ALTER TABLE "skill_entitlements" ADD COLUMN     "maxActivations" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "skill_activations" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "machineHash" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_activations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_activations_customerId_idx" ON "skill_activations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_activations_entitlementId_instanceId_key" ON "skill_activations"("entitlementId", "instanceId");

-- AddForeignKey
ALTER TABLE "skill_activations" ADD CONSTRAINT "skill_activations_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "skill_entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_activations" ADD CONSTRAINT "skill_activations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
