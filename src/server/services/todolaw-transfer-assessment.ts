// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pre-fills the TODO.LAW transfer of a hosted organisation (added by
 * ./todolaw-processor.ts) with the work the organisation should not have to
 * do itself, because TODO.LAW knows its own transfer best:
 *
 *   - the supplementary measures that apply (src/config/todolaw-transfer-assessment.ts);
 *   - the Schrems II checklist answered, with a note per point;
 *   - the status "compliant", on a record that stays a draft until a person
 *     confirms TODO.LAW;
 *   - a transfer impact assessment (TIA, in Spanish EIT) on the system
 *     template, answered in the organisation's language, waiting for the
 *     organisation's approval (status PENDING_APPROVAL). It is never approved
 *     on the organisation's behalf: the organisation is the controller.
 *
 * Idempotent: a transfer that already has an assessment, or that carries the
 * pre-fill marker, is left alone. Never on the self-hosted kit (no TODO.LAW
 * transfer exists there).
 */

import { AssessmentStatus, AssessmentType, type Prisma } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import type { PilotDpaLocale } from "@/config/pilot-dpa";
import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";
import {
  TODOLAW_CHECKLIST,
  TODOLAW_SUPPLEMENTARY_MEASURES,
  TODOLAW_TIA_CHOICES,
  TODOLAW_TIA_TEXT,
  TODOLAW_TIA_TITLE,
  TODOLAW_TIA_VERSION,
} from "@/config/todolaw-transfer-assessment";
import { withChecklistAnswer } from "@/lib/transfer-checklist";
import { TODOLAW_SOURCE_REF } from "@/lib/todolaw-source";

export const TODOLAW_TIA_MARKER = "todolawTia";

type TemplateQuestion = { id: string; type: string; options?: { en: string; es: string }[] };
type TemplateSection = { id: string; questions: TemplateQuestion[] };

const TIA_TEMPLATE = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as {
  sections: TemplateSection[];
};

/** An English option label in `locale`, through the template's option list (same position). */
function optionIn(question: TemplateQuestion, english: string, locale: PilotDpaLocale): string {
  const option = question.options?.find((o) => o.en === english);
  if (!option) throw new Error(`TIA option not in template: ${question.id} "${english}"`);
  return option[locale];
}

/** The answers to save, one per question: [sectionId, questionId, response]. */
export function todoLawTiaResponses(
  locale: PilotDpaLocale,
  now: Date = new Date(),
): Array<{ sectionId: string; questionId: string; response: Prisma.InputJsonValue }> {
  const out: Array<{ sectionId: string; questionId: string; response: Prisma.InputJsonValue }> = [];
  const nextReview = new Date(now);
  nextReview.setUTCFullYear(nextReview.getUTCFullYear() + 1);
  for (const section of TIA_TEMPLATE.sections) {
    for (const q of section.questions) {
      const choice = TODOLAW_TIA_CHOICES[q.id];
      const text = TODOLAW_TIA_TEXT[locale][q.id];
      let response: Prisma.InputJsonValue | undefined;
      if (typeof choice === "boolean") response = choice;
      else if (Array.isArray(choice)) response = choice.map((c) => optionIn(q, c, locale));
      else if (typeof choice === "string") response = optionIn(q, choice, locale);
      else if (text) response = text;
      else if (q.id === "tiav2_5_2") response = nextReview.toISOString().slice(0, 10);
      if (response !== undefined) out.push({ sectionId: section.id, questionId: q.id, response });
    }
  }
  return out;
}

export type TodoLawTiaResult =
  | { prefilled: true; transferId: string; assessmentId: string }
  | { prefilled: false; reason: "no-transfer" | "done" | "no-template" };

/** The organisation's TODO.LAW transfer, if it has one. */
async function todoLawTransfer(db: Db, organizationId: string) {
  return db.dataTransfer.findFirst({
    where: { organizationId, vendor: { sourceRef: TODOLAW_SOURCE_REF } },
    select: { id: true, name: true, metadata: true, processingActivityId: true, _count: { select: { assessments: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function prefillTodoLawTransfer(
  db: Db,
  organizationId: string,
  locale: PilotDpaLocale,
  now: Date = new Date(),
): Promise<TodoLawTiaResult> {
  const transfer = await todoLawTransfer(db, organizationId);
  if (!transfer) return { prefilled: false, reason: "no-transfer" };
  const meta = (transfer.metadata ?? {}) as Record<string, unknown>;
  if (meta[TODOLAW_TIA_MARKER] || transfer._count.assessments > 0) return { prefilled: false, reason: "done" };

  const template = await db.assessmentTemplate.findFirst({
    where: { type: AssessmentType.TIA, isActive: true, supersededAt: null, isSystem: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!template) return { prefilled: false, reason: "no-template" };

  let metadata: Record<string, unknown> = { ...meta };
  for (const [itemId, answer] of Object.entries(TODOLAW_CHECKLIST)) {
    metadata = withChecklistAnswer(metadata, itemId, { state: answer.state, note: answer.note[locale], at: now.toISOString() });
  }
  metadata[TODOLAW_TIA_MARKER] = TODOLAW_TIA_VERSION;
  const measures = Object.fromEntries(TODOLAW_SUPPLEMENTARY_MEASURES.map((m) => [m, true]));
  const title = TODOLAW_TIA_TITLE[locale];
  const responses = todoLawTiaResponses(locale, now);

  const assessmentId = await db.$transaction(async (tx) => {
    await tx.dataTransfer.update({
      where: { id: transfer.id },
      data: {
        supplementaryMeasures: measures,
        complianceStatus: "COMPLIANT",
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    const assessment = await tx.assessment.create({
      data: {
        organizationId,
        templateId: template.id,
        dataTransferId: transfer.id,
        processingActivityId: transfer.processingActivityId ?? undefined,
        name: title.name,
        description: title.description,
        status: AssessmentStatus.PENDING_APPROVAL,
        submittedAt: now,
        metadata: { source: TODOLAW_SOURCE_REF, [TODOLAW_TIA_MARKER]: TODOLAW_TIA_VERSION, locale },
      },
      select: { id: true },
    });
    await tx.assessmentResponse.createMany({
      data: responses.map((r) => ({ assessmentId: assessment.id, ...r })),
    });
    return assessment.id;
  });
  return { prefilled: true, transferId: transfer.id, assessmentId };
}

// ── Backfill (scripts/backfill-todolaw-tia.ts) ─────────────────────────

export interface TodoLawTiaBackfillRow {
  organizationId: string;
  outcome: "prefill" | "prefilled" | "done" | "no-transfer" | "no-template";
}

/** Organisations whose TODO.LAW transfer would be (dry run) or was (execute) pre-filled. Counts only. */
export async function backfillTodoLawTia(
  db: Db,
  opts: { execute: boolean; localeOf: (organizationId: string) => Promise<PilotDpaLocale> },
): Promise<TodoLawTiaBackfillRow[]> {
  const orgs = await db.organization.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
  const rows: TodoLawTiaBackfillRow[] = [];
  for (const { id } of orgs) {
    const transfer = await todoLawTransfer(db, id);
    if (!transfer) {
      rows.push({ organizationId: id, outcome: "no-transfer" });
      continue;
    }
    const meta = (transfer.metadata ?? {}) as Record<string, unknown>;
    if (meta[TODOLAW_TIA_MARKER] || transfer._count.assessments > 0) {
      rows.push({ organizationId: id, outcome: "done" });
      continue;
    }
    if (!opts.execute) {
      rows.push({ organizationId: id, outcome: "prefill" });
      continue;
    }
    const result = await prefillTodoLawTransfer(db, id, await opts.localeOf(id));
    rows.push({ organizationId: id, outcome: result.prefilled ? "prefilled" : result.reason });
  }
  return rows;
}
