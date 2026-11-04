-- Record of processing (GDPR Art. 30): the controller block, the security
-- measures and the processor record.
--
-- Additive and idempotent: one new enum, nullable columns on "organizations"
-- (controller, DPO and EU representative details; the general description of
-- security measures), and on "processing_activities" the role (NOT NULL with a
-- default, so every existing activity reads as CONTROLLER, as before), the
-- joint controller, the activity's own security measures and, for processor
-- activities, the controller on whose behalf it is carried out. No rewrite of
-- existing values; a second run finds nothing to do.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcessingRole') THEN
    CREATE TYPE "ProcessingRole" AS ENUM ('CONTROLLER', 'JOINT_CONTROLLER', 'PROCESSOR');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "controllerLegalName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "controllerTaxId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "controllerAddress" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "controllerEmail" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "controllerPhone" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "dpoName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "dpoContact" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "euRepresentativeName" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "euRepresentativeContact" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "securityMeasures" TEXT;

-- AlterTable
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "role" "ProcessingRole" NOT NULL DEFAULT 'CONTROLLER';
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "jointControllerDetails" TEXT;
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "securityMeasures" TEXT;
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "clientControllerName" TEXT;
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "clientControllerContact" TEXT;
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "clientRepresentative" TEXT;
ALTER TABLE "processing_activities" ADD COLUMN IF NOT EXISTS "clientDpo" TEXT;
