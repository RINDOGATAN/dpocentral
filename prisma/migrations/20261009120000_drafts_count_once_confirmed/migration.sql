-- Drafts count once confirmed (owner's decision d2, 9 October 2026).
--
-- A record the quick start, an industry template or "Start from another
-- client" created is a draft until a person confirms it, and a draft does not
-- count towards the programme's progress. A draft is
--   provenance = 'AUTO_TEMPLATE' AND confirmedAt IS NULL
-- on vendors, data_assets and processing_activities (the provenance quad added
-- by 20260928120000_template_provenance_and_superseded). Records created from
-- this release on are written that way by the code; this migration settles the
-- records that already exist.
--
--  1. Records that migration backfilled as confirmed (AUTO_TEMPLATE,
--     confirmedBy NULL, confirmedAt = updatedAt) were marked confirmed only
--     because nobody could tell whether a person had edited them. Where the
--     record has never been changed since it was created (updatedAt within
--     sixty seconds of createdAt: the time the quick start's own transaction
--     may take), nobody has: it goes back to being a draft.
--     A record a person edited, or one a person confirmed (confirmedBy set),
--     is left as it is.
--
--  2. Records copied by "Start from another client" carry the mark
--     metadata.templateCopy.pending = true but were written as USER_ENTERED.
--     They become AUTO_TEMPLATE with sourceRef 'client-template': a draft when
--     never changed since the copy, confirmed (confirmedAt = updatedAt,
--     confirmedBy NULL) when it has been edited since.
--
-- ADDITIVE ONLY in shape: no table, column or type is added, dropped, renamed
-- or retyped, and no row is deleted. The updates only write the provenance
-- columns. Idempotent: a second run finds nothing left to change.

-- 1. Back to draft: template records never changed since they were created.
UPDATE "vendors"
SET "confirmedAt" = NULL
WHERE "provenance" = 'AUTO_TEMPLATE'
  AND "confirmedBy" IS NULL
  AND "confirmedAt" IS NOT NULL
  AND "confirmedAt" = "updatedAt"
  AND "updatedAt" <= "createdAt" + INTERVAL '60 seconds';

UPDATE "data_assets"
SET "confirmedAt" = NULL
WHERE "provenance" = 'AUTO_TEMPLATE'
  AND "confirmedBy" IS NULL
  AND "confirmedAt" IS NOT NULL
  AND "confirmedAt" = "updatedAt"
  AND "updatedAt" <= "createdAt" + INTERVAL '60 seconds';

UPDATE "processing_activities"
SET "confirmedAt" = NULL
WHERE "provenance" = 'AUTO_TEMPLATE'
  AND "confirmedBy" IS NULL
  AND "confirmedAt" IS NOT NULL
  AND "confirmedAt" = "updatedAt"
  AND "updatedAt" <= "createdAt" + INTERVAL '60 seconds';

-- 2. Copies from another client: provenance made queryable.
UPDATE "vendors"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = 'client-template',
    "confirmedAt" = CASE WHEN "updatedAt" <= "createdAt" + INTERVAL '60 seconds' THEN NULL ELSE "updatedAt" END
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->'templateCopy'->>'pending' = 'true';

UPDATE "data_assets"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = 'client-template',
    "confirmedAt" = CASE WHEN "updatedAt" <= "createdAt" + INTERVAL '60 seconds' THEN NULL ELSE "updatedAt" END
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->'templateCopy'->>'pending' = 'true';

UPDATE "processing_activities"
SET "provenance" = 'AUTO_TEMPLATE',
    "sourceRef" = 'client-template',
    "confirmedAt" = CASE WHEN "updatedAt" <= "createdAt" + INTERVAL '60 seconds' THEN NULL ELSE "updatedAt" END
WHERE "provenance" = 'USER_ENTERED'
  AND "metadata"->'templateCopy'->>'pending' = 'true';
