// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Guarded upserts for the built-in ("system") content the seeds own: the
 * assessment templates and the vendor questionnaire.
 *
 * Existing self-host installs re-run the content seeds on every boot (see
 * deploy/sovereign/migrate.sh), so these writes land on live data. Two rules
 * keep a firm's own rows safe:
 *
 *  - Only a system row is refreshed (isSystem = true, no organization). A row
 *    with the same id that belongs to an organization is never touched.
 *  - A row is never downgraded. A template the firm installed from a signed
 *    skill package (src/server/services/skills/assessment-installer.ts) uses
 *    the same `system-<type>-template` id; when its version is newer than the
 *    seed's, it is kept as it is.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export type SystemUpsertOutcome = "created" | "updated" | "kept-newer" | "not-system";

/**
 * Compares dotted version strings numerically ("1.10" > "1.9", "1.1.0" >
 * "1.0"). Missing parts count as 0; a non-numeric part counts as 0.
 * Returns a negative number, zero or a positive number.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((p) => parseInt(p, 10) || 0);
  const pb = b.split(".").map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface ExistingSystemRow {
  version: string;
  isSystem: boolean;
  organizationId: string | null;
}

function decide(existing: ExistingSystemRow | null, version: string): SystemUpsertOutcome {
  if (!existing) return "created";
  if (!existing.isSystem || existing.organizationId !== null) return "not-system";
  if (compareVersions(existing.version, version) > 0) return "kept-newer";
  return "updated";
}

type SystemTemplateData = Omit<Prisma.AssessmentTemplateUncheckedCreateInput, "id"> & {
  version: string;
};

export async function upsertSystemTemplate(
  prisma: PrismaClient,
  id: string,
  data: SystemTemplateData
): Promise<SystemUpsertOutcome> {
  const existing = await prisma.assessmentTemplate.findUnique({
    where: { id },
    select: { version: true, isSystem: true, organizationId: true },
  });
  const outcome = decide(existing, data.version);
  if (outcome === "created") {
    await prisma.assessmentTemplate.create({ data: { id, ...data } });
  } else if (outcome === "updated") {
    await prisma.assessmentTemplate.update({ where: { id }, data });
  }
  return outcome;
}

type SystemQuestionnaireData = Omit<Prisma.VendorQuestionnaireUncheckedCreateInput, "id"> & {
  version: string;
};

export async function upsertSystemQuestionnaire(
  prisma: PrismaClient,
  id: string,
  data: SystemQuestionnaireData
): Promise<SystemUpsertOutcome> {
  const existing = await prisma.vendorQuestionnaire.findUnique({
    where: { id },
    select: { version: true, isSystem: true, organizationId: true },
  });
  const outcome = decide(existing, data.version);
  if (outcome === "created") {
    await prisma.vendorQuestionnaire.create({ data: { id, ...data } });
  } else if (outcome === "updated") {
    await prisma.vendorQuestionnaire.update({ where: { id }, data });
  }
  return outcome;
}

/** One log line per row, e.g. "  LIA template (system-lia-template): updated". */
export function describeOutcome(label: string, id: string, outcome: SystemUpsertOutcome): string {
  const note: Record<SystemUpsertOutcome, string> = {
    created: "created",
    updated: "updated",
    "kept-newer": "kept (installed version is newer than the built-in one)",
    "not-system": "skipped (row with this id is not a system row)",
  };
  return `  ${label} (${id}): ${note[outcome]}`;
}
