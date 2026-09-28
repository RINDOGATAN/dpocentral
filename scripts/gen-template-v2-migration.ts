// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Generates the additive migration that inserts the four v2 assessment templates
 * and supersedes their v1 counterparts, from the one source in
 * src/config/assessment-templates-v2.ts, so the migration and the seed can never
 * drift apart.
 *
 * Pure text generation: it touches no database. Run it after editing the v2
 * templates:  tsx scripts/gen-template-v2-migration.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ASSESSMENT_TEMPLATES_V2,
  serializeSections,
  templateSeedData,
} from "../src/config/assessment-templates-v2";

const MIGRATION = "20260928170000_assessment_question_sets_v2";

/** A single-quoted SQL literal with embedded quotes doubled. */
const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;
const json = (v: unknown) => `${sql(JSON.stringify(v))}::jsonb`;

const SCORING = templateSeedData(ASSESSMENT_TEMPLATES_V2[0]).scoringLogic;

const header = `-- Version 2 of the four free-text assessment templates (LIA, TIA, PIA, Custom).
--
-- The consultant's point: a regulator reading a registration looks for keywords,
-- and free text hides them. v2 turns every question a regulator reads into a
-- structured one (single/multiple choice, yes-no with a follow-up, a graded
-- select, or a date as an ISO text field), each with per-question help, in the
-- vocabulary of the law. The DPIA is left alone (already structured, v3.0).
--
-- Delivered as NEW template rows, so running assessments keep their v1 template,
-- questions and answers untouched. The four v1 SYSTEM rows are marked superseded
-- so the picker (which already filters supersededAt IS NULL) offers only v2 for
-- NEW assessments. PIA has no v1 row, so nothing is superseded for it.
--
-- Question text is stored in English; the Spanish lives in the message bundles
-- (templates.<type>.…), matched by position, exactly as every other template.
--
-- ADDITIVE ONLY and idempotent: INSERT ... ON CONFLICT ("id") DO NOTHING, and the
-- supersede UPDATE is guarded on supersededAt IS NULL so a re-run never moves the
-- date. No table, column, type or row is dropped, renamed, retyped or deleted.

`;

const inserts = ASSESSMENT_TEMPLATES_V2.map((t) => {
  const data = templateSeedData(t);
  return `INSERT INTO "assessment_templates"
  ("id", "organizationId", "type", "name", "description", "version", "sections", "scoringLogic", "isSystem", "isActive", "supersededAt", "createdAt", "updatedAt")
VALUES
  (${sql(t.id)}, NULL, ${sql(String(t.type))}::"AssessmentType", ${sql(data.name)}, ${sql(data.description)}, ${sql(data.version)}, ${json(serializeSections(t))}, ${json(SCORING)}, true, true, NULL, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;`;
}).join("\n\n");

const supersededIds = ASSESSMENT_TEMPLATES_V2.map((t) => t.supersedes).filter((x): x is string => !!x);

const supersede = `-- Retire the v1 SYSTEM templates for NEW assessments only. Guarded on
-- supersededAt IS NULL so a re-run never moves the date, and scoped to the known
-- ids, isSystem and organizationId IS NULL so no org-authored template is touched.
UPDATE "assessment_templates"
SET "supersededAt" = NOW()
WHERE "id" IN (${supersededIds.map(sql).join(", ")})
  AND "isSystem" = true
  AND "organizationId" IS NULL
  AND "supersededAt" IS NULL;`;

const body = `${header}${inserts}\n\n${supersede}\n`;

const dir = join(__dirname, "..", "prisma", "migrations", MIGRATION);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), body, "utf8");
console.log(`Wrote prisma/migrations/${MIGRATION}/migration.sql`);
