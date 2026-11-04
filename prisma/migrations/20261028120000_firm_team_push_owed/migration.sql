-- Firm team: an empty list still owed to AI Sentinel, so the hourly push
-- retries it until it is accepted (src/server/services/suite/firm-team-push.ts).
--
-- Additive and idempotent: one new table and its foreign key. No existing row
-- changes; no table rewrite.

-- CreateTable
CREATE TABLE IF NOT EXISTS "firm_team_push_owed" (
    "ownerUserId" TEXT NOT NULL,
    "owedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firm_team_push_owed_pkey" PRIMARY KEY ("ownerUserId")
);

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "firm_team_push_owed" ADD CONSTRAINT "firm_team_push_owed_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
