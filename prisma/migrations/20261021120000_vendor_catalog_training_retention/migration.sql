-- Training use and retention statements from the vendor.watch catalogue.
-- Nullable, no default, no backfill: the next catalogue seed fills them from
-- snapshots that carry the fields. Additive only.
ALTER TABLE "vendor_catalog" ADD COLUMN "trainingUse" TEXT;
ALTER TABLE "vendor_catalog" ADD COLUMN "retention" TEXT;
