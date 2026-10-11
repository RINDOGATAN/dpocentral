-- Hosted service: the Stripe subscription that pays for an organisation's
-- paid EU cloud plan, recorded by the automatic upgrade so that the end of
-- the subscription returns the organisation to the pilot limits. Additive
-- only: one nullable column and one index. No data is updated; every existing
-- organisation reads NULL (a plan set by an operator, never downgraded
-- automatically).

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "planStripeSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "organizations_planStripeSubscriptionId_idx" ON "organizations"("planStripeSubscriptionId");
