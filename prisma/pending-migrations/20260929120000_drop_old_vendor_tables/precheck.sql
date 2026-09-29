-- Pre-check for the drop of the seven old vendor tables. Read-only.
-- Lists each table and its row count; a table already gone shows as "absent".
-- Run it before the dump, and keep the output with the dump.
--
--   psql "$DATABASE_URL" -f prisma/pending-migrations/20260929120000_drop_old_vendor_tables/precheck.sql

SELECT t.name AS table_name,
       CASE WHEN to_regclass(format('public.%I', t.name)) IS NULL THEN 'absent'
            ELSE (xpath('/row/c/text()',
                        query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.name), false, true, '')
                       ))[1]::text
       END AS row_count
FROM (VALUES
  ('vendor_claims'),
  ('vendor_suggestions'),
  ('vw_cert_evidence'),
  ('vw_dpa_documents'),
  ('vw_enrichment_requests'),
  ('vw_expert_reviews'),
  ('vw_vendor_questionnaires')
) AS t(name)
ORDER BY t.name;
