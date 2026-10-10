-- Hosted service: an organisation's plan. PILOT (the free, capped pilot) or
-- EU_CLOUD (the paid EU cloud plan, which lifts the pilot caps and the
-- editing window). Additive only: one new enum type and four new columns.
-- "plan" is NOT NULL with a constant default, which PostgreSQL 11 and later
-- record in the catalogue without rewriting the table, so every existing
-- organisation reads as PILOT and keeps exactly the behaviour it had. The
-- three other columns are nullable. No data is updated.

-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('PILOT', 'EU_CLOUD');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "plan" "OrganizationPlan" NOT NULL DEFAULT 'PILOT',
ADD COLUMN     "planNote" TEXT,
ADD COLUMN     "planRenewsAt" TIMESTAMP(3),
ADD COLUMN     "planStartedAt" TIMESTAMP(3);
