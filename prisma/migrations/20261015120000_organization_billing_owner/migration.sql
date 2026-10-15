-- Hosted service: one plan, one pilot window and one set of pilot allowances
-- per paying customer. Every organisation gets a billing owner, the account
-- that created it; organisations with the same billing owner share the plan
-- columns and "pilotStartedAt" (src/server/services/pilot/umbrella.ts).
--
-- Additive and idempotent: one nullable column, one index, one foreign key
-- (ON DELETE SET NULL), then a backfill that only ever moves an organisation
-- to a state at least as open as the one it had for paid access:
--   1. billing owner = the organisation's earliest OWNER (the creator, unless
--      the creator has since left), only where still null;
--   2. paid plan: in a group where at least one organisation is on EU_CLOUD,
--      every organisation still on PILOT takes the plan of the group's paid
--      organisation with the latest renewal (no renewal date, an operator's
--      open-ended plan, counts as the latest), with one PLAN_CHANGE audit
--      entry each. Organisations already on EU_CLOUD are not touched, so each
--      keeps its own subscription link;
--   3. pilot window: every organisation of a group takes the group's earliest
--      recorded "pilotStartedAt" (one window per customer).
-- A second run finds nothing to do. Tables touched are small; no rewrite.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billingOwnerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organizations_billingOwnerId_idx" ON "organizations"("billingOwnerId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_billingOwnerId_fkey'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_billingOwnerId_fkey"
      FOREIGN KEY ("billingOwnerId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill 1: the billing owner.
UPDATE "organizations" o
SET "billingOwnerId" = m."userId"
FROM (
  SELECT DISTINCT ON ("organizationId") "organizationId", "userId"
  FROM "organization_members"
  WHERE "role" = 'OWNER'
  ORDER BY "organizationId", "joinedAt" ASC, "id" ASC
) m
WHERE o."id" = m."organizationId"
  AND o."billingOwnerId" IS NULL;

-- Backfill 2: the paid plan covers the whole group.
WITH best AS (
  SELECT DISTINCT ON ("billingOwnerId")
    "billingOwnerId", "planStartedAt", "planRenewsAt", "planStripeSubscriptionId"
  FROM "organizations"
  WHERE "billingOwnerId" IS NOT NULL AND "plan" = 'EU_CLOUD'
  ORDER BY "billingOwnerId", "planRenewsAt" DESC NULLS FIRST, "planStartedAt" ASC NULLS LAST, "id" ASC
),
lifted AS (
  UPDATE "organizations" o
  SET "plan" = 'EU_CLOUD',
      "planStartedAt" = b."planStartedAt",
      "planRenewsAt" = b."planRenewsAt",
      "planStripeSubscriptionId" = b."planStripeSubscriptionId"
  FROM best b, "organizations" old
  WHERE o."billingOwnerId" = b."billingOwnerId"
    AND old."id" = o."id"
    AND o."plan" = 'PILOT'
  RETURNING o."id",
    old."planStartedAt" AS "beforeStartedAt", old."planRenewsAt" AS "beforeRenewsAt",
    o."planStartedAt" AS "afterStartedAt", o."planRenewsAt" AS "afterRenewsAt",
    o."planStripeSubscriptionId" AS "subscriptionId"
)
INSERT INTO "audit_logs" ("id", "organizationId", "userId", "entityType", "entityId", "action", "changes", "metadata", "createdAt")
SELECT
  'umbrella-plan-' || l."id",
  l."id",
  NULL,
  'Organization',
  l."id",
  'PLAN_CHANGE',
  jsonb_build_object(
    'before', jsonb_build_object(
      'plan', 'PILOT',
      'planStartedAt', to_char(l."beforeStartedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'planRenewsAt', to_char(l."beforeRenewsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'after', jsonb_build_object(
      'plan', 'EU_CLOUD',
      'planStartedAt', to_char(l."afterStartedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'planRenewsAt', to_char(l."afterRenewsAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'planNoteChanged', false
  ),
  jsonb_strip_nulls(jsonb_build_object(
    'source', 'migration-billing-owner',
    'subscriptionId', l."subscriptionId"
  )),
  CURRENT_TIMESTAMP
FROM lifted l
ON CONFLICT ("id") DO NOTHING;

-- Backfill 3: one pilot window per group, from its earliest recorded start.
WITH firsts AS (
  SELECT "billingOwnerId", MIN("pilotStartedAt") AS "startedAt"
  FROM "organizations"
  WHERE "billingOwnerId" IS NOT NULL
  GROUP BY "billingOwnerId"
  HAVING COUNT(*) > 1 AND MIN("pilotStartedAt") IS NOT NULL
)
UPDATE "organizations" o
SET "pilotStartedAt" = f."startedAt"
FROM firsts f
WHERE o."billingOwnerId" = f."billingOwnerId"
  AND o."pilotStartedAt" IS DISTINCT FROM f."startedAt";
