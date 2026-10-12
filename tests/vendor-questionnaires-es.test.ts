// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The built-in vendor questionnaire reads in Spanish on Spanish screens: every
 * string of both versions has a Spanish entry, answers keep their English
 * option values, and English and organisation-written text pass through.
 */

import { describe, it, expect } from "vitest";
import {
  VENDOR_QUESTIONNAIRE_V1,
  VENDOR_QUESTIONNAIRE_V2,
  type SystemQuestionnaireContent,
} from "@/config/vendor-questionnaires";
import {
  VENDOR_QUESTIONNAIRES_ES,
  QUESTION_TYPE_LABELS,
  localizeQuestionnaire,
} from "@/config/vendor-questionnaires-es";

const VERSIONS: SystemQuestionnaireContent[] = [VENDOR_QUESTIONNAIRE_V1, VENDOR_QUESTIONNAIRE_V2];

function strings(q: SystemQuestionnaireContent): string[] {
  const out = [q.name, q.description];
  for (const s of q.sections) {
    out.push(s.title);
    if (s.description) out.push(s.description);
    for (const x of s.questions) out.push(x.text, ...(x.options ?? []));
  }
  return out;
}

describe("vendor questionnaire library in Spanish", () => {
  it("every string of both versions has a Spanish entry", () => {
    const missing = VERSIONS.flatMap(strings).filter((s) => !(s in VENDOR_QUESTIONNAIRES_ES));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("every question type has a label in both languages", () => {
    const types = new Set(VERSIONS.flatMap((q) => q.sections.flatMap((s) => s.questions.map((x) => x.type))));
    for (const t of types) {
      expect(QUESTION_TYPE_LABELS.en[t]).toBeTruthy();
      expect(QUESTION_TYPE_LABELS.es[t]).toBeTruthy();
    }
  });

  it("Spanish shows Spanish text and keeps option values and ids", () => {
    const es = localizeQuestionnaire(VENDOR_QUESTIONNAIRE_V2, "es");
    expect(es.name).toBe("Evaluación de seguridad y privacidad de proveedores");
    const sections = es.sections as unknown as {
      id: string;
      title: string;
      questions: { id: string; text: string; options?: string[]; optionLabels?: string[] }[];
    }[];
    expect(sections.map((s) => s.id)).toEqual(VENDOR_QUESTIONNAIRE_V2.sections.map((s) => s.id));
    const ir2 = sections.flatMap((s) => s.questions).find((q) => q.id === "ir2")!;
    expect(ir2.options?.[0]).toBe("Without undue delay (under 24 hours)");
    expect(ir2.optionLabels?.[0]).toBe("Sin dilación indebida (menos de 24 horas)");
  });

  it("English and organisation-written questionnaires pass through", () => {
    expect(localizeQuestionnaire(VENDOR_QUESTIONNAIRE_V1, "en")).toBe(VENDOR_QUESTIONNAIRE_V1);
    const own = { name: "Nuestro cuestionario", description: null, sections: [{ id: "a", title: "Mine", questions: [{ id: "q", text: "Own question", type: "text" }] }] };
    const es = localizeQuestionnaire(own, "es");
    expect(es.name).toBe("Nuestro cuestionario");
    expect((es.sections as { questions: { text: string }[] }[])[0]!.questions[0]!.text).toBe("Own question");
  });

  it("the Spanish text uses tú, no long dash, and the Spanish GDPR terms", () => {
    const es = Object.values(VENDOR_QUESTIONNAIRES_ES).join("\n");
    expect(es).not.toMatch(/[–—]/);
    expect(es).not.toMatch(/\busted(es)?\b|\bvosotros\b|\bprestadores?\b|\bindustria\b|\bGDPR\b|\bDPIA\b/);
  });
});
