// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Framework conformance is data, so it is tested as data: every requirement
 * the European and the Californian rules impose has a row, every row is
 * answered by a question the template actually asks, and the product never
 * reports conformance with a requirement nothing answers.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  CA_OPTION,
  CCPA_NO_TRIGGER_OPTION,
  CCPA_TRIGGERS,
  CCPA_TRIGGER_QUESTION_ID,
  CONFORMANCE_TEMPLATE_ID,
  DPIA_FRAMEWORK_ELEMENTS,
  EU_OPTION,
  FRAMEWORK_OPTIONS,
  FRAMEWORK_QUESTION_ID,
  californiaTriggerState,
  conformanceComplete,
  conformanceElementsFor,
  coverageSummary,
  frameworkCoverage,
  selectedFrameworks,
} from "@/config/assessment-frameworks";
import {
  DPIA_TEMPLATE_ID,
  DPIA_TEMPLATE_VERSION,
  dpiaFrameworkMessages,
  dpiaTemplateData,
  dpiaTemplateSections,
} from "@/config/dpia-template-v2";
import { HEALTH_ADTECH_SECTIONS } from "@/config/health-adtech-template";
import { answerMapFrom, visibleSections } from "@/lib/assessment-conditions";

type Question = { id: string; required?: boolean; type?: string; options?: string[] };

const sections = dpiaTemplateSections as unknown as Array<{
  id: string;
  showIf?: unknown;
  questions: Question[];
}>;

const allQuestions = new Map<string, Question>();
for (const s of sections) for (const q of s.questions) allQuestions.set(q.id, q);

const answersFor = (values: Record<string, unknown>) =>
  answerMapFrom(Object.entries(values).map(([questionId, response]) => ({ questionId, response })));

const visible = (answers: Record<string, unknown>) =>
  visibleSections(sections as never, answersFor(answers)) as unknown as Array<{
    id: string;
    questions: Question[];
  }>;

const answerEveryVisible = (answers: Record<string, unknown>) => {
  const ids = new Set<string>();
  for (const s of visible(answers)) for (const q of s.questions) ids.add(q.id);
  return ids;
};

// ── The requirement table ────────────────────────────────────────────────

describe("the requirement table", () => {
  it("carries every European element the rules require", () => {
    const eu = DPIA_FRAMEWORK_ELEMENTS.filter((e) => e.framework === "EU_GDPR").map((e) => e.id);
    expect(eu).toEqual([
      "gdpr_35_7_a",
      "gdpr_35_7_b",
      "gdpr_35_7_c",
      "gdpr_35_7_d",
      "gdpr_35_2",
      "gdpr_35_9",
      "gdpr_36_1",
      "gdpr_35_11",
    ]);
  });

  it("carries the Californian threshold, the nine content items and the two timing sections", () => {
    const ca = DPIA_FRAMEWORK_ELEMENTS.filter((e) => e.framework === "US_CCPA").map((e) => e.id);
    expect(ca).toEqual([
      "ccpa_7150_b",
      "ccpa_7152_a_1",
      "ccpa_7152_a_2",
      "ccpa_7152_a_3",
      "ccpa_7152_a_4",
      "ccpa_7152_a_5",
      "ccpa_7152_a_6",
      "ccpa_7152_a_7",
      "ccpa_7152_a_8",
      "ccpa_7152_a_9",
      "ccpa_7155",
      "ccpa_7157",
    ]);
    expect(ca.filter((id) => id.startsWith("ccpa_7152_a_"))).toHaveLength(9);
  });

  it("cites a primary source, in both languages, for every element", () => {
    for (const e of DPIA_FRAMEWORK_ELEMENTS) {
      expect(e.citation.en, e.id).toMatch(/^(Art\. 3[56]|11 CCR 71\d\d)/);
      expect(e.citation.es, e.id).toMatch(/^(art\. 3[56]|11 CCR 71\d\d)/);
      expect(e.label.en.length, e.id).toBeGreaterThan(10);
      expect(e.label.es.length, e.id).toBeGreaterThan(10);
      expect(e.label.es, e.id).not.toBe(e.label.en);
    }
  });

  it("answers every element with questions the template actually asks", () => {
    for (const e of DPIA_FRAMEWORK_ELEMENTS) {
      expect(e.questionIds.length, e.id).toBeGreaterThan(0);
      for (const id of e.questionIds) {
        expect(allQuestions.has(id), `${e.id} -> ${id}`).toBe(true);
      }
    }
  });

  it("belongs to the standard DPIA template and to no other", () => {
    expect(CONFORMANCE_TEMPLATE_ID).toBe(DPIA_TEMPLATE_ID);
    expect(conformanceElementsFor(DPIA_TEMPLATE_ID)).toBe(DPIA_FRAMEWORK_ELEMENTS);
    expect(conformanceElementsFor("system-lia-template")).toBeNull();
    expect(conformanceElementsFor(null)).toBeNull();
  });

  it("states the six California triggers exactly as the health-data template does", () => {
    const other = HEALTH_ADTECH_SECTIONS.flatMap((s) => s.questions).find(
      (q) => q.options && q.options.en.includes(CCPA_NO_TRIGGER_OPTION)
    );
    expect(other?.options?.en).toEqual(CCPA_TRIGGERS.en);
    expect(other?.options?.es).toEqual(CCPA_TRIGGERS.es);
    // Six activities plus "None of these".
    expect(CCPA_TRIGGERS.en).toHaveLength(7);
  });
});

// ── The template follows the choice ──────────────────────────────────────

describe("the template follows the framework chosen", () => {
  it("asks the framework question first, and requires it", () => {
    expect(sections[0].id).toBe("s0");
    expect(sections[0].questions[0].id).toBe(FRAMEWORK_QUESTION_ID);
    expect(sections[0].questions[0].required).toBe(true);
    expect(sections[0].questions[0].options).toEqual(FRAMEWORK_OPTIONS.en);
  });

  it("hides the Californian sections until California is chosen", () => {
    const euOnly = visible({ [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION]) }).map((s) => s.id);
    expect(euOnly).not.toContain("s8");
    expect(euOnly).not.toContain("s9");
    expect(euOnly).toContain("s7");
  });

  it("hides the European questions when only California is chosen", () => {
    const ids = answerEveryVisible({ [FRAMEWORK_QUESTION_ID]: JSON.stringify([CA_OPTION]) });
    expect(ids.has("q7_2")).toBe(false);
    expect(ids.has("q7_3")).toBe(false);
    expect(ids.has("q4_3")).toBe(false);
    expect(ids.has("q7_4")).toBe(false);
    expect(ids.has(CCPA_TRIGGER_QUESTION_ID)).toBe(true);
  });

  it("shows both when both are chosen", () => {
    const ids = answerEveryVisible({
      [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION, CA_OPTION]),
    });
    for (const e of DPIA_FRAMEWORK_ELEMENTS) {
      for (const id of e.questionIds) expect(ids.has(id), `${e.id} -> ${id}`).toBe(true);
    }
  });

  it("keeps the European questions on an assessment started before the choice existed", () => {
    // No answer to q0_1 at all: nothing that was visible before disappears.
    const ids = answerEveryVisible({});
    expect(ids.has("q7_2")).toBe(true);
    expect(ids.has("q7_3")).toBe(true);
    expect(ids.has("q4_3")).toBe(true);
    // The Californian sections are new, so they stay out of the way.
    expect(ids.has(CCPA_TRIGGER_QUESTION_ID)).toBe(false);
  });

  it("matches an answer saved in Spanish", () => {
    expect(selectedFrameworks(answersFor({ [FRAMEWORK_QUESTION_ID]: FRAMEWORK_OPTIONS.es[1] }))).toEqual([
      "US_CCPA",
    ]);
    expect(
      selectedFrameworks(
        answersFor({ [FRAMEWORK_QUESTION_ID]: JSON.stringify(FRAMEWORK_OPTIONS.es) })
      )
    ).toEqual(["EU_GDPR", "US_CCPA"]);
  });

  it("assumes the European framework while the question is unanswered", () => {
    expect(selectedFrameworks(answersFor({}))).toEqual(["EU_GDPR"]);
  });
});

// ── Coverage ─────────────────────────────────────────────────────────────

describe("coverage", () => {
  const coverageFor = (answers: Record<string, unknown>, answered: Set<string>) =>
    frameworkCoverage({
      elements: DPIA_FRAMEWORK_ELEMENTS,
      frameworks: selectedFrameworks(answersFor(answers)),
      visibleSections: visible(answers),
      answeredQuestionIds: answered,
    });

  it("reports nothing covered on an empty assessment", () => {
    const answers = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION]) };
    const rows = coverageFor(answers, new Set([FRAMEWORK_QUESTION_ID]));
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => !r.covered)).toBe(true);
    expect(conformanceComplete(rows)).toBe(false);
  });

  it("reports every element covered once every visible question is answered", () => {
    const answers = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION, CA_OPTION]) };
    const rows = coverageFor(answers, answerEveryVisible(answers));
    expect(rows).toHaveLength(DPIA_FRAMEWORK_ELEMENTS.length);
    expect(conformanceComplete(rows)).toBe(true);
    expect(coverageSummary(rows)).toEqual([
      { framework: "EU_GDPR", covered: 8, total: 8, complete: true },
      { framework: "US_CCPA", covered: 12, total: 12, complete: true },
    ]);
  });

  it("says so in that many words when one framework is finished and the other is not", () => {
    const answers = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION, CA_OPTION]) };
    const answered = answerEveryVisible(answers);
    answered.delete("q8_4");
    const summary = coverageSummary(coverageFor(answers, answered));
    expect(summary).toEqual([
      { framework: "EU_GDPR", covered: 8, total: 8, complete: true },
      { framework: "US_CCPA", covered: 11, total: 12, complete: false },
    ]);
  });

  it("points each outstanding row at the step and field that answers it", () => {
    const answers = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION]) };
    const answered = answerEveryVisible(answers);
    answered.delete("q7_3");
    const row = coverageFor(answers, answered).find((r) => r.element.id === "gdpr_35_2")!;
    expect(row.covered).toBe(false);
    expect(row.outstandingQuestionIds).toEqual(["q7_3"]);
    expect(row.sectionId).toBe("s7");
    expect(row.questionId).toBe("q7_3");
  });

  it("lists only the frameworks chosen", () => {
    const answers = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([CA_OPTION]) };
    const rows = coverageFor(answers, answerEveryVisible(answers));
    expect(rows.every((r) => r.element.framework === "US_CCPA")).toBe(true);
    expect(rows).toHaveLength(12);
  });

  it("never claims a requirement whose questions are all hidden", () => {
    // California selected in the table but not in the answers: the Californian
    // sections are hidden, so every Californian row is outstanding.
    const answers = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION]) };
    const rows = frameworkCoverage({
      elements: DPIA_FRAMEWORK_ELEMENTS,
      frameworks: ["EU_GDPR", "US_CCPA"],
      visibleSections: visible(answers),
      answeredQuestionIds: answerEveryVisible(answers),
    });
    const hidden = rows.filter((r) => r.element.id === "ccpa_7152_a_3");
    expect(hidden[0].covered).toBe(false);
    expect(hidden[0].questionId).toBeNull();
  });
});

// ── The Californian threshold ────────────────────────────────────────────

describe("whether a California risk assessment is required at all", () => {
  it("is unknown while the question is unanswered", () => {
    expect(californiaTriggerState(answersFor({}))).toBe("unknown");
  });

  it("is not required when the answer is only 'None of these'", () => {
    expect(
      californiaTriggerState(
        answersFor({ [CCPA_TRIGGER_QUESTION_ID]: JSON.stringify([CCPA_NO_TRIGGER_OPTION]) })
      )
    ).toBe("not-required");
  });

  it("is required as soon as one activity applies, in either language", () => {
    expect(
      californiaTriggerState(
        answersFor({ [CCPA_TRIGGER_QUESTION_ID]: JSON.stringify([CCPA_TRIGGERS.en[0]]) })
      )
    ).toBe("required");
    expect(
      californiaTriggerState(
        answersFor({ [CCPA_TRIGGER_QUESTION_ID]: JSON.stringify([CCPA_TRIGGERS.es[1]]) })
      )
    ).toBe("required");
  });
});

// ── Both languages ship together ─────────────────────────────────────────

describe("message bundles", () => {
  const bundle = (b: unknown) =>
    (b as { templates: { dpia: { template?: Record<string, unknown>; section: Record<string, unknown>; question: Record<string, unknown> } } })
      .templates.dpia;

  for (const [locale, messages] of [["en", en], ["es", es]] as const) {
    it(`carries the v${DPIA_TEMPLATE_VERSION} text in ${locale} (run scripts/sync-dpia-messages.ts)`, () => {
      const expected = dpiaFrameworkMessages(locale);
      const actual = bundle(messages);
      for (const [id, value] of Object.entries(expected.section)) {
        expect(actual.section[id], `${locale} section ${id}`).toEqual(value);
      }
      for (const [id, value] of Object.entries(expected.question)) {
        expect(actual.question[id], `${locale} question ${id}`).toEqual(value);
      }
      for (const [id, value] of Object.entries(expected.template)) {
        expect(actual.template?.[id], `${locale} template ${id}`).toEqual(value);
      }
    });
  }

  it("describes the template the same way in the data and in the bundle", () => {
    expect(dpiaTemplateData.version).toBe(DPIA_TEMPLATE_VERSION);
    expect(bundle(en).template?.[DPIA_TEMPLATE_ID]).toMatchObject({
      name: dpiaTemplateData.name,
      description: dpiaTemplateData.description,
    });
  });

  /**
   * Both texts are card copy: a short name, and one sentence with no citation
   * stack, so nothing the card clamps away carries meaning of its own.
   */
  it("names the template the generic one, in a sentence a card can hold", () => {
    const meta = (locale: "en" | "es") => dpiaFrameworkMessages(locale).template[DPIA_TEMPLATE_ID];
    expect(meta("en").name).toBe("Data Protection Impact Assessment (generic)");
    expect(meta("es").name).toBe("Evaluación de impacto en la protección de datos (genérica)");
    for (const locale of ["en", "es"] as const) {
      const description = meta(locale).description;
      expect(description.match(/\.\s/g) ?? [], locale).toHaveLength(0);
      expect(description, locale).not.toMatch(/2016\/679|11 CCR/);
      expect(description.length, locale).toBeLessThan(160);
    }
    expect(meta("es").description).not.toMatch(/\busted(es)?\b/i);
  });
});

describe("no long dash in the text added for the frameworks", () => {
  const texts = (["en", "es"] as const).flatMap((locale) => {
    const m = dpiaFrameworkMessages(locale);
    return [
      ...Object.values(m.section).flatMap((s) => [s.title, s.description]),
      ...Object.values(m.question).flatMap((q) => [q.text, q.helpText ?? "", ...(q.options ?? [])]),
      ...Object.values(m.template).flatMap((t) => [t.name, t.description]),
    ];
  });

  it("uses plain punctuation", () => {
    for (const text of texts) expect(text).not.toMatch(/[—–]/);
  });
});
