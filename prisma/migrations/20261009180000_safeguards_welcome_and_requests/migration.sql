-- The first-visit welcome card and its safeguards question (hosted service;
-- owner's decisions O1 to O3, 9 October 2026). Additive only: two enums, four
-- nullable columns and one new table; nothing is rewritten, dropped or
-- retyped, and no existing row changes.
--
-- organizations.welcomeUserId: the person who created the organisation on the
--   hosted service and has not answered the card yet. Null for every
--   organisation that exists today, so nobody already working sees the card;
--   it is set only when a new organisation is created on the hosted service.
-- organizations.safeguardsChoice / safeguardsChoiceById / safeguardsChoiceAt:
--   the answer, who gave it and when. Null until answered.
-- safeguards_requests: one row per request for option b or c, sent to the tech
--   firm's sales inbox. Kept while open, then for six months after closedAt; the
--   daily purge (/api/cron/safeguards-requests-purge) deletes it after that.

-- CreateEnum
CREATE TYPE "SafeguardsChoice" AS ENUM ('shared_eu', 'managed', 'own_hardware', 'later');

-- CreateEnum
CREATE TYPE "SafeguardsRequestStatus" AS ENUM ('open', 'closed');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "safeguardsChoice" "SafeguardsChoice",
ADD COLUMN     "safeguardsChoiceAt" TIMESTAMP(3),
ADD COLUMN     "safeguardsChoiceById" TEXT,
ADD COLUMN     "welcomeUserId" TEXT;

-- CreateTable
CREATE TABLE "safeguards_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "choice" "SafeguardsChoice" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "userCount" TEXT NOT NULL,
    "message" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "SafeguardsRequestStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safeguards_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safeguards_requests_organizationId_status_idx" ON "safeguards_requests"("organizationId", "status");

-- CreateIndex
CREATE INDEX "safeguards_requests_status_closedAt_idx" ON "safeguards_requests"("status", "closedAt");

-- AddForeignKey
ALTER TABLE "safeguards_requests" ADD CONSTRAINT "safeguards_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
