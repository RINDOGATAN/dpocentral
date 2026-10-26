// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Every string the TODO.LAW automation writes into a hosted organisation's
 * programme, in both languages, as one pack for src/lib/system-content/:
 * the vendor, the processing agreement and the transfer
 * (./todolaw-processor-text.ts), and the ready-made TIA with its supplementary
 * measures checklist (./todolaw-transfer-assessment.ts). A stored string that
 * is one of these, in either language, is shown in the reader's language.
 */

import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";
import type { BilingualText, SystemContentPack } from "@/lib/system-content/localize";
import {
  TODOLAW_CHECKLIST,
  TODOLAW_TIA_CHOICES,
  TODOLAW_TIA_TEXT,
  TODOLAW_TIA_TITLE,
} from "@/config/todolaw-transfer-assessment";
import { TODOLAW_LINKS, TODOLAW_PROCESSOR_TEXT } from "@/config/todolaw-processor-text";

const en = TODOLAW_PROCESSOR_TEXT.en;
const es = TODOLAW_PROCESSOR_TEXT.es;

type TemplateQuestion = { id: string; options?: BilingualText[] };
type TemplateSection = { questions: TemplateQuestion[] };

function tiaQuestionOptions(): Record<string, BilingualText[]> {
  const tia = ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as
    | { sections: TemplateSection[] }
    | undefined;
  const out: Record<string, BilingualText[]> = {};
  for (const section of tia?.sections ?? [])
    for (const q of section.questions)
      if (q.id in TODOLAW_TIA_CHOICES && q.options?.length) out[q.id] = q.options;
  return out;
}

export const TODOLAW_CONTENT_PACK: SystemContentPack = {
  id: "todo-law",
  texts: [
    { en: en.description, es: es.description },
    { en: en.transferName, es: es.transferName },
    { en: en.transferDescription, es: es.transferDescription },
    { en: en.safeguards, es: es.safeguards },
    { en: TODOLAW_LINKS.dpa.en, es: TODOLAW_LINKS.dpa.es },
    { en: TODOLAW_LINKS.subprocessors.en, es: TODOLAW_LINKS.subprocessors.es },
    { en: TODOLAW_TIA_TITLE.en.name, es: TODOLAW_TIA_TITLE.es.name },
    { en: TODOLAW_TIA_TITLE.en.description, es: TODOLAW_TIA_TITLE.es.description },
    ...Object.keys(TODOLAW_TIA_TEXT.en)
      .filter((id) => TODOLAW_TIA_TEXT.es[id])
      .map((id) => ({ en: TODOLAW_TIA_TEXT.en[id], es: TODOLAW_TIA_TEXT.es[id] })),
    ...Object.values(TODOLAW_CHECKLIST).map((item) => ({ en: item.note.en, es: item.note.es })),
  ],
  patterns: [
    { en: en.contractName("{version}"), es: es.contractName("{version}") },
    { en: en.contractDescription("{subprocessors}"), es: es.contractDescription("{subprocessors}") },
  ],
  questionOptions: tiaQuestionOptions(),
};
