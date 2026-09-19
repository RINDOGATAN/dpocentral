-- Hosted pilot clock: the 90-day editing window counts from the
-- organisation's first sign-in after the pilot went live. Additive only: one
-- nullable column, no backfill. Existing organisations stay null, so each
-- starts its window at its next sign-in (the old start was computed from
-- "createdAt" and never stored, so there is nothing to migrate). The kit
-- never writes this column.

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "pilotStartedAt" TIMESTAMP(3);
