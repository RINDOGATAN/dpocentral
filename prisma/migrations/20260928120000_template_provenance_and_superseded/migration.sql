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
--     The removal candidate is { provenance = AUTO_TEMPLATE, confirmedAt = NULL }.
--     Nothing records whether a client edited a pre-existing template row before
--     this migration, so we must assume they might have. The backfill therefore
--     also sets `confirmedAt` = `updatedAt` (leaving `confirmedBy` NULL): every
--     record that exists on deploy keeps an honest "From the template" badge but
--     is never a removal candidate. Only records created AFTER this deploy, by the
--     code that stamps AUTO_TEMPLATE with confirmedAt NULL, can be removed. This
--     matches AI Sentinel's rule (PR 61): existing rows are "possibly edited" and
--     are never removed automatically.
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
--
--    `confirmedAt` is set to `updatedAt` (confirmedBy stays NULL): these rows
--    predate this deploy and may already have been edited by a client, with no
--    record that they were, so they are marked confirmed and can never be a
--    removal candidate. Only rows created after this deploy are removable.
UPDATE "vendors"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = COALESCE("metadata"->>'templateId', "metadata"->>'source'),
    "confirmedAt" = "updatedAt"
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->>'source' IN ('quickstart', 'template');

UPDATE "data_assets"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = COALESCE("metadata"->>'templateId', "metadata"->>'source'),
    "confirmedAt" = "updatedAt"
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->>'source' IN ('quickstart', 'template');

UPDATE "processing_activities"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = COALESCE("metadata"->>'templateId', "metadata"->>'source'),
    "confirmedAt" = "updatedAt"
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->>'source' IN ('quickstart', 'template');

-- 4. The superseded marker on assessment templates (nullable; nothing is
--    superseded by this migration — the marker exists for a newer version to
--    set when it lands).
ALTER TABLE "assessment_templates"
  ADD COLUMN "supersededAt" TIMESTAMP(3);
