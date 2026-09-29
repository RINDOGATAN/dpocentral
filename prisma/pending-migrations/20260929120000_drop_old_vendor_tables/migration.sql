-- Drop the seven old vendor tables.
--
-- NOT YET APPLIED ANYWHERE. This file sits in prisma/pending-migrations/ so
-- that no `prisma migrate deploy` picks it up: the hosted build and every
-- self-hosted migrator run that command on their own. The owner moves it into
-- prisma/migrations/ in the next migration window, AFTER the dump (see the
-- README beside this folder).
--
-- ORDER: DUMP FIRST. Run precheck.sql (row counts), take a pg_dump of these
-- seven tables, keep it, and only then move this migration into place.
--
-- Why: until the July 2026 separation (7 July 2026) DPO Central shared one
-- database with vendor.watch. These seven tables belonged to the vendor
-- intelligence side (vendor claims and suggestions, and the vendor.watch
-- questionnaire, evidence, DPA, enrichment and expert-review tables). The
-- baseline (0_init) still created them in DPO Central's own database, but
-- since the separation no model in prisma/schema.prisma maps them and no
-- code reads or writes them: vendor.watch is their source of truth. Nothing
-- references them by foreign key, so they drop cleanly, with their indexes.
--
-- IF EXISTS: an installation whose tables were already removed by hand still
-- migrates cleanly.

DROP TABLE IF EXISTS "vendor_claims";
DROP TABLE IF EXISTS "vendor_suggestions";
DROP TABLE IF EXISTS "vw_cert_evidence";
DROP TABLE IF EXISTS "vw_dpa_documents";
DROP TABLE IF EXISTS "vw_enrichment_requests";
DROP TABLE IF EXISTS "vw_expert_reviews";
DROP TABLE IF EXISTS "vw_vendor_questionnaires";
