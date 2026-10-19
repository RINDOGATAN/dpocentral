// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Coverage reads what the answers say, not only that an answer exists, and
 * Article 36 pairs that cannot stand together are caught: a high residual
 * risk with "no prior consultation", or a consultation still "under
 * consideration".
 */

import { describe, it, expect } from "vitest";
import {
  DPIA_FRAMEWORK_ELEMENTS,
  EU_OPTION,
  FRAMEWORK_QUESTION_ID,
  art36Conflict,
  consultationAnswer,
  frameworkCoverage,
  priorConsultationRequired,
  selectedFrameworks,
} from "@/config/assessment-frameworks";
import { dpiaTemplateSections } from "@/config/dpia-template-v2";
import { answerMapFrom, visibleSections } from "@/lib/assessment-conditions";
import { assessmentCompleteness } from "@/lib/assessment-completeness";

type Q = { id: string; options?: string[]; required?: boolean; text: string };
const sections = dpiaTemplateSections as unknown as Array<{ id: string; title: string; questions: Q[] }>;
const option = (qid: string, i: number) =>
  sections.flatMap((s) => s.questions).find((q) => q.id === qid)!.options![i];

const NO = option("q7_2", 0);
const UNDER = option("q7_2", 1);
const YES = option("q7_2", 2);

function answersWith(extra: Record<string, unknown>) {
  const base: Record<string, unknown> = { [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION]), ...extra };
  const map = answerMapFrom(Object.entries(base).map(([questionId, response]) => ({ questionId, response })));
  const visible = visibleSections(sections as never, map) as unknown as typeof sections;
  // Every visible question answered: what remains is the content of the answers.
  const responses = visible.flatMap((s) =>
    s.questions.map((q) => ({ questionId: q.id, response: base[q.id] ?? q.options?.[0] ?? "Answered" }))
  );
  return { map: answerMapFrom(responses), visible, responses };
}

function row36(extra: Record<string, unknown>, registerResidual: "LOW" | "HIGH" | null = null) {
  const { map, visible, responses } = answersWith(extra);
  const rows = frameworkCoverage({
    elements: DPIA_FRAMEWORK_ELEMENTS,
    frameworks: selectedFrameworks(map),
    visibleSections: visible,
    answeredQuestionIds: new Set(responses.map((r) => r.questionId)),
    answers: map,
    registerRisks: 1,
    registerResidual,
  });
  return { row: rows.find((r) => r.element.id === "gdpr_36_1")!, rows, map };
}

describe("Article 36 coverage depends on the answer", () => {
  it("is covered when no consultation is needed and the residual risk is not high", () => {
    expect(row36({ q7_1: "Medium", q7_2: NO }).row.covered).toBe(true);
  });

  it("is not covered with a high or critical residual risk and 'no consultation'", () => {
    for (const level of ["High", "Critical"]) {
      const { row, map } = row36({ q7_1: level, q7_2: NO });
      expect(row.covered).toBe(false);
      expect(row.ruleNotMet).toBe(true);
      expect(art36Conflict(map)).toBe("HIGH_RESIDUAL_NO_CONSULTATION");
    }
  });

  it("counts the register's highest residual as well as the stated level", () => {
    const { row, map } = row36({ q7_1: "Low", q7_2: NO }, "HIGH");
    expect(row.covered).toBe(false);
    expect(art36Conflict(map, "HIGH")).toBe("HIGH_RESIDUAL_NO_CONSULTATION");
  });

  it("is never covered while 'under consideration'", () => {
    const { row, map } = row36({ q7_1: "Low", q7_2: UNDER });
    expect(row.covered).toBe(false);
    expect(art36Conflict(map)).toBe("CONSULTATION_UNDECIDED");
  });

  it("is covered when consultation is required only once it is recorded", () => {
    const { map } = answersWith({ q7_1: "High", q7_2: YES });
    expect(priorConsultationRequired(map)).toBe(true);
    expect(art36Conflict(map)).toBeNull();
    // answersWith answers every visible question, q7_5 included.
    expect(row36({ q7_1: "High", q7_2: YES }).row.covered).toBe(true);
    const { visible } = answersWith({ q7_1: "High", q7_2: YES });
    expect(visible.flatMap((s) => s.questions.map((q) => q.id))).toContain("q7_5");
  });

  it("reads the Spanish and the older English wordings by their first word", () => {
    const at = (v: string) => answerMapFrom([{ questionId: "q7_2", response: v }]);
    expect(consultationAnswer(at("Sí: riesgo residual alto que no puede mitigarse suficientemente"))).toBe("required");
    expect(consultationAnswer(at("En estudio: se necesita un análisis adicional"))).toBe("under-consideration");
    expect(consultationAnswer(at("No: residual risk has been sufficiently mitigated"))).toBe("not-required");
  });
});

describe("the verdict never claims what the answers deny", () => {
  it("is not complete when every question is answered but Article 36 is not met", () => {
    const { visible, responses } = answersWith({ q7_1: "High", q7_2: NO });
    const c = assessmentCompleteness({
      templateId: "system-dpia-template",
      visibleSections: visible,
      responses,
      registerRisks: 1,
    });
    expect(c.outstandingQuestions).toHaveLength(0);
    expect(c.summary[0].complete).toBe(false);
    expect(c.art36).toBe("HIGH_RESIDUAL_NO_CONSULTATION");
    expect(c.complete).toBe(false);
  });

  it("asks for the risk register before claiming Art. 35(7)(c)", () => {
    const { visible, responses } = answersWith({ q7_1: "Low", q7_2: NO });
    const without = assessmentCompleteness({ templateId: "system-dpia-template", visibleSections: visible, responses, registerRisks: 0 });
    expect(without.outstandingRequirements.map((r) => r.element.id)).toContain("gdpr_35_7_c");
    const withRows = assessmentCompleteness({ templateId: "system-dpia-template", visibleSections: visible, responses, registerRisks: 2 });
    expect(withRows.complete).toBe(true);
  });

  it("asks for the legitimate interest when the basis is Art. 6(1)(f)", () => {
    const li = option("q1_3", 5);
    const { visible } = answersWith({ q1_3: li });
    expect(visible.flatMap((s) => s.questions.map((q) => q.id))).toContain("q1_7");
    const other = answersWith({ q1_3: option("q1_3", 1) }).visible;
    expect(other.flatMap((s) => s.questions.map((q) => q.id))).not.toContain("q1_7");
  });
});
