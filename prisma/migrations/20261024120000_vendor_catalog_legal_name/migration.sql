-- Legal name of the company behind each catalogue product, from the vendor.watch
-- catalogue. Nullable, no default, no backfill: the next catalogue seed fills it.
-- Additive only.
ALTER TABLE "vendor_catalog" ADD COLUMN "legalName" TEXT;
