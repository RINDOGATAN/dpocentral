-- DPIA risk register and frozen approval figures.
--
-- Additive and idempotent: five nullable columns on "assessments" (inherent
-- and residual risk kept apart, the time the figures were frozen at approval,
-- and the version written then), one new enum and one new table holding one
-- row per identified risk with its likelihood and severity before and after
-- measures. No existing row changes; a second run finds nothing to do.

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "inherentRiskLevel" "RiskLevel";
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "inherentRiskScore" DOUBLE PRECISION;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "residualRiskLevel" "RiskLevel";
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "riskFrozenAt" TIMESTAMP(3);
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "approvedVersion" INTEGER;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentRiskStatus') THEN
    CREATE TYPE "AssessmentRiskStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "assessment_risks" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rightsAffected" TEXT,
    "likelihood" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "residualLikelihood" INTEGER,
    "residualSeverity" INTEGER,
    "status" "AssessmentRiskStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assessment_risks_assessmentId_idx" ON "assessment_risks"("assessmentId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_risks_assessmentId_fkey'
  ) THEN
    ALTER TABLE "assessment_risks"
      ADD CONSTRAINT "assessment_risks_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
