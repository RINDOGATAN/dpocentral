-- Template-item provenance + a superseded marker on assessment templates.
--
-- Stage 3 of the Guided work. Two additive changes:
--
--  1. A provenance quad on the three record types the quick start and the
--     industry templates create silently (vendors, data assets, processing
--     activities), so "Remove all template items" can clear the rows nobody has
--     edited — and only those. Every pre-existing row defaults to USER_ENTERED
--     and is therefore never removed automatically; rows the quick start / a
--     template already stamped in their `metadata` are backfilled to
--     AUTO_TEMPLATE so the marker is queryable rather than buried in JSON.
--
--  2. A nullable `supersededAt` on assessment_templates, so a newer version of a
--     system template can retire the old one for NEW assessments while an
--     assessment already using the old one keeps it, its questions and its
--     answers untouched.
--
-- ADDITIVE ONLY. New enum; new nullable / defaulted columns; a backfill that
-- only writes the new column. No table, column, type or row is dropped,
-- renamed, retyped or deleted. Idempotent to re-run: the backfill is a plain
-- UPDATE and setting a value it already holds is a no-op.

-- 1. The provenance enum.
CREATE TYPE "Provenance" AS ENUM ('USER_ENTERED', 'AUTO_TEMPLATE');

-- 2. The provenance quad on the three template-created record types.
ALTER TABLE "vendors"
  ADD COLUMN "provenance" "Provenance" NOT NULL DEFAULT 'USER_ENTERED',
  ADD COLUMN "sourceRef" TEXT,
  ADD COLUMN "confirmedBy" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TABLE "data_assets"
  ADD COLUMN "provenance" "Provenance" NOT NULL DEFAULT 'USER_ENTERED',
  ADD COLUMN "sourceRef" TEXT,
  ADD COLUMN "confirmedBy" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TABLE "processing_activities"
  ADD COLUMN "provenance" "Provenance" NOT NULL DEFAULT 'USER_ENTERED',
  ADD COLUMN "sourceRef" TEXT,
  ADD COLUMN "confirmedBy" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- 3. Backfill: a row the quick start or an industry template created carries
--    `metadata.source` = 'quickstart' or 'template'. Keep that fact in the new
--    queryable column, and remember which template made it. Everything else
--    stays USER_ENTERED (the default) and is never auto-removed.
UPDATE "vendors"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = COALESCE("metadata"->>'templateId', "metadata"->>'source')
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->>'source' IN ('quickstart', 'template');

UPDATE "data_assets"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = COALESCE("metadata"->>'templateId', "metadata"->>'source')
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->>'source' IN ('quickstart', 'template');

UPDATE "processing_activities"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = COALESCE("metadata"->>'templateId', "metadata"->>'source')
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->>'source' IN ('quickstart', 'template');

-- 4. The superseded marker on assessment templates (nullable; nothing is
--    superseded by this migration — the marker exists for a newer version to
--    set when it lands).
ALTER TABLE "assessment_templates"
  ADD COLUMN "supersededAt" TIMESTAMP(3);
