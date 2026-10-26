// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shows the records a catalogue transfer pack wrote
 * (src/server/services/catalogue-transfer-pack.ts) in the reader's
 * language, whatever language the screen that added the vendor used.
 *
 * Only records whose metadata.source names a pack are touched. A text the
 * customer has not edited (equal to the pack's text in English or Spanish)
 * is replaced by the pack's text in the reader's language; an edited text is
 * shown as typed. Select answers are the template's options, so they are
 * shown as the same option in the reader's language. Nothing is written.
 */

import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";
import {
  packText,
  transferPackBySource,
  type CatalogueTransferPack,
  type PackLocale,
} from "@/config/catalogue-transfer-packs";
import { checklistAnswersOf, type ChecklistAnswers } from "@/lib/transfer-checklist";

type TemplateQuestion = { id: string; options?: { en: string; es: string }[] };

const TIA_QUESTIONS: Map<string, TemplateQuestion> = new Map(
  (
    (ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as {
      sections: { questions: TemplateQuestion[] }[];
    })?.sections ?? []
  ).flatMap((s) => s.questions.map((q) => [q.id, q] as const)),
);

function packOf(metadata: unknown): CatalogueTransferPack | null {
  if (!metadata || typeof metadata !== "object") return null;
  return transferPackBySource((metadata as Record<string, unknown>).source);
}

/** A transfer row with the pack's texts in `locale`. Other rows come back unchanged. */
export function localizePackTransfer<
  T extends { metadata?: unknown; name: string; description?: string | null; safeguards?: string | null },
>(transfer: T, locale: PackLocale): T {
  const pack = packOf(transfer.metadata);
  if (!pack) return transfer;
  const t = pack.transfer;
  return {
    ...transfer,
    name: packText(transfer.name, t.name, locale) ?? transfer.name,
    ...(transfer.description !== undefined ? { description: packText(transfer.description, t.description, locale) } : {}),
    ...(transfer.safeguards !== undefined ? { safeguards: packText(transfer.safeguards, t.safeguards, locale) } : {}),
  };
}

/** The Schrems II answers of a pack transfer, with the pack's notes in `locale`. */
export function localizedChecklistAnswers(metadata: unknown, locale: PackLocale): ChecklistAnswers {
  const answers = checklistAnswersOf(metadata);
  const pack = packOf(metadata);
  if (!pack) return answers;
  const out: ChecklistAnswers = {};
  for (const [id, answer] of Object.entries(answers)) {
    const note = pack.checklist[id]?.note;
    out[id] = note && answer.note ? { ...answer, note: packText(answer.note, note, locale) ?? answer.note } : answer;
  }
  return out;
}

function optionInLocale(question: TemplateQuestion | undefined, stored: unknown, locale: PackLocale): unknown {
  if (!question?.options || typeof stored !== "string") return stored;
  const option = question.options.find((o) => o.en === stored || o.es === stored);
  return option ? option[locale] : stored;
}

/** An assessment with its name, description and answers in `locale`, when a pack wrote it. */
export function localizePackAssessment<
  A extends {
    metadata?: unknown;
    name: string;
    description?: string | null;
    responses?: { questionId: string; response: unknown }[];
  },
>(assessment: A, locale: PackLocale): A {
  const pack = packOf(assessment.metadata);
  if (!pack) return assessment;
  const title = pack.tia.title;
  return {
    ...assessment,
    name: packText(assessment.name, title.name, locale) ?? assessment.name,
    ...(assessment.description !== undefined
      ? { description: packText(assessment.description, title.description, locale) }
      : {}),
    ...(assessment.responses
      ? {
          responses: assessment.responses.map((r) => {
            const q = TIA_QUESTIONS.get(r.questionId);
            let response: unknown = r.response;
            if (Array.isArray(response)) response = response.map((v) => optionInLocale(q, v, locale));
            else if (typeof response === "string" && q?.options) response = optionInLocale(q, response, locale);
            else if (typeof response === "string") {
              const en = pack.tia.text.en[r.questionId];
              const es = pack.tia.text.es[r.questionId];
              if (en && es) response = packText(response, { en, es }, locale);
            }
            return { ...r, response };
          }),
        }
      : {}),
  };
}
