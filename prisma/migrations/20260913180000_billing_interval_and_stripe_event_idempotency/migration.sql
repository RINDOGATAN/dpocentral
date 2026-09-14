-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "skill_packages" ADD COLUMN     "billingInterval" "BillingInterval" NOT NULL DEFAULT 'YEAR';

-- CreateTable
CREATE TABLE "processed_stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("id")
);

