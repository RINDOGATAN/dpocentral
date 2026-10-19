-- Set D (security and data integrity): indexes on foreign keys that are
-- filtered or joined on request paths and had none (membership look-ups by
-- user, links by system, tasks by assignee, assessments by record and by
-- vendor, questionnaires by organisation).
--
-- Additive and idempotent: indexes only, no column or row is changed. The
-- tables are small; a plain CREATE INDEX is enough.

CREATE INDEX IF NOT EXISTS "organization_members_userId_idx" ON "organization_members"("userId");

CREATE INDEX IF NOT EXISTS "processing_activity_assets_dataAssetId_idx" ON "processing_activity_assets"("dataAssetId");

CREATE INDEX IF NOT EXISTS "dsar_tasks_assigneeId_idx" ON "dsar_tasks"("assigneeId");

CREATE INDEX IF NOT EXISTS "assessments_processingActivityId_idx" ON "assessments"("processingActivityId");

CREATE INDEX IF NOT EXISTS "assessments_vendorId_idx" ON "assessments"("vendorId");

CREATE INDEX IF NOT EXISTS "vendor_questionnaires_organizationId_idx" ON "vendor_questionnaires"("organizationId");
