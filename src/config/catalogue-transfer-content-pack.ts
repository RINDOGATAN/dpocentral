// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Every string the catalogue transfer packs write
 * (./catalogue-transfer-packs.ts), in both languages, as packs for
 * src/lib/system-content/: the transfer's name, description and safeguards,
 * the checklist notes, and the TIA's title, note and text answers, with the
 * option lists of the questions the packs answer. A stored string that is one
 * of these, in either language, is shown in the reader's language.
 */

import { ASSESSMENT_TEMPLATES_V2 } from "@/config/assessment-templates-v2";
import type { BilingualText, SystemContentPack } from "@/lib/system-content/localize";
import { CATALOGUE_TRANSFER_PACKS, type CatalogueTransferPack } from "@/config/catalogue-transfer-packs";

type TemplateQuestion = { id: string; options?: BilingualText[] };

const TIA_QUESTIONS = (
  (ASSESSMENT_TEMPLATES_V2.find((t) => t.type === "TIA") as unknown as { sections: { questions: TemplateQuestion[] }[] } | undefined)
    ?.sections ?? []
).flatMap((s) => s.questions);

export function contentPackFor(pack: CatalogueTransferPack): SystemContentPack {
  const { transfer: t, tia } = pack;
  const questionOptions: Record<string, BilingualText[]> = {};
  for (const q of TIA_QUESTIONS) if (q.id in tia.choices && q.options?.length) questionOptions[q.id] = q.options;
  return {
    id: pack.sourceRef,
    texts: [
      t.name,
      t.description,
      t.safeguards,
      tia.title.name,
      tia.title.description,
      ...Object.keys(tia.text.en)
        .filter((id) => tia.text.es[id])
        .map((id) => ({ en: tia.text.en[id]!, es: tia.text.es[id]! })),
      ...Object.values(pack.checklist).map((c) => c.note),
    ],
    questionOptions,
  };
}

export const CATALOGUE_TRANSFER_CONTENT_PACKS: readonly SystemContentPack[] =
  Object.values(CATALOGUE_TRANSFER_PACKS).map(contentPackFor);
