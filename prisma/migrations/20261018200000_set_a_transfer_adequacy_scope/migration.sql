-- Partial adequacy scope on a transfer record (additive, nullable).
ALTER TABLE "data_transfers" ADD COLUMN "adequacyScopeConfirmed" BOOLEAN;
ALTER TABLE "data_transfers" ADD COLUMN "adequacyScopeReference" TEXT;
ALTER TABLE "data_transfers" ADD COLUMN "adequacyScopeCheckedAt" TIMESTAMP(3);

-- The vendor that receives the data (optional link; cleared if the vendor is deleted).
ALTER TABLE "data_transfers" ADD COLUMN "vendorId" TEXT;
CREATE INDEX "data_transfers_vendorId_idx" ON "data_transfers"("vendorId");
ALTER TABLE "data_transfers" ADD CONSTRAINT "data_transfers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
