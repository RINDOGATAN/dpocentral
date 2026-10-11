-- Hosted service: the rights-request (DSAR) add-on per organisation, and the
-- privacy contact e-mail of the public request form. Additive only: one new
-- enum type and four new NULLABLE columns, no default, no data updated. Every
-- existing organisation reads null (no add-on), and every existing form has
-- no contact e-mail; on the self-hosted kit none of these is read.

-- CreateEnum
CREATE TYPE "DsarModuleStatus" AS ENUM ('NONE', 'ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "dsarModuleRenewsAt" TIMESTAMP(3),
ADD COLUMN     "dsarModuleStatus" "DsarModuleStatus",
ADD COLUMN     "dsarModuleSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "dsar_intake_forms" ADD COLUMN     "privacyContactEmail" TEXT;

