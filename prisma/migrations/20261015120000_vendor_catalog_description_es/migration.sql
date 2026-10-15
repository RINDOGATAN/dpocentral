-- Spanish vendor description from the vendor.watch catalogue (descriptionEs).
-- Nullable, no default, no backfill: the next catalogue seed fills it from
-- snapshots that carry the field. Additive only.
ALTER TABLE "vendor_catalog" ADD COLUMN "descriptionEs" TEXT;
