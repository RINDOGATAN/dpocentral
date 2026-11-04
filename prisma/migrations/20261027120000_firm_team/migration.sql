-- Firm team: people in the firm of an account who are members of every
-- organisation that account owns and pays for, including organisations it
-- creates later (src/server/services/members/firm-team.ts).
--
-- Additive and idempotent: one new table, one nullable column on
-- "organization_members" (which membership came from a firm team), indexes
-- and foreign keys. No existing row changes; no table rewrite.

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "firmTeamMemberId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "firm_team_members" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "memberUserId" TEXT,
    "invitedEmail" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'PRIVACY_OFFICER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "firm_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "firm_team_members_memberUserId_idx" ON "firm_team_members"("memberUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "firm_team_members_invitedEmail_idx" ON "firm_team_members"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "firm_team_members_ownerUserId_invitedEmail_key" ON "firm_team_members"("ownerUserId", "invitedEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organization_members_firmTeamMemberId_idx" ON "organization_members"("firmTeamMemberId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_firmTeamMemberId_fkey') THEN
    ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_firmTeamMemberId_fkey"
      FOREIGN KEY ("firmTeamMemberId") REFERENCES "firm_team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'firm_team_members_ownerUserId_fkey') THEN
    ALTER TABLE "firm_team_members" ADD CONSTRAINT "firm_team_members_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'firm_team_members_memberUserId_fkey') THEN
    ALTER TABLE "firm_team_members" ADD CONSTRAINT "firm_team_members_memberUserId_fkey"
      FOREIGN KEY ("memberUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
