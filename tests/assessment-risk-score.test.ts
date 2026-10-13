// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The risk score and level of an assessment come from the answers its template
 * records, and agree with the assessment's own risk conclusion. Saved
 * responses carry no per-answer score, so a score averaged over that field was
 * always 0 ("Low").
 */

import { describe, expect, it } from "vitest";
import { dpiaTemplateData } from "@/config/dpia-template-v2";
import { EU_OPTION, FRAMEWORK_QUESTION_ID } from "@/config/assessment-frameworks";
import { ASSESSMENT_TEMPLATES_V2, serializeSections } from "@/config/assessment-templates-v2";
import {
  INDICATORS,
  LEVEL_QUESTIONS,
  calculateRiskScore,
  deriveAssessmentRisk,
  withDerivedRisk,
} from "@/server/services/assessment/risk-score";

const dpia = { type: "DPIA", sections: dpiaTemplateData.sections, scoringLogic: dpiaTemplateData.scoringLogic };

function v2(type: string) {
  const t = ASSESSMENT_TEMPLATES_V2.find((x) => x.type === type)!;
  return { type: t.type, sections: serializeSections(t), scoringLogic: null };
}

const answers = (map: Record<string, unknown>) =>
  Object.entries(map).map(([questionId, response]) => ({ questionId, response }));

/** A credit-scoring DPIA: automated decisions on a large scale, residual risk medium. */
const creditScoring = {
  [FRAMEWORK_QUESTION_ID]: JSON.stringify([EU_OPTION]),
  q1_1: "Automated creditworthiness scoring of loan applicants.",
  q5_1: "Yes",
  q5_2: "No",
  q5_3: "No",
  q5_4: "Yes",
  q5_5: "Yes",
  q5_6: "Risk 1: Discriminatory scoring. Likelihood: Possible. Severity: Significant.",
  q6_1: JSON.stringify(["Encryption at rest", "Access controls / RBAC", "Audit logging"]),
  q7_1: "Medium",
  q7_2: "No — residual risk has been sufficiently mitigated",
  q7_3: "The DPO advises the processing may proceed with human review of refusals.",
};

describe("DPIA risk score", () => {
  it("a credit-scoring DPIA with medium residual risk scores Medium, not 0% Low", () => {
    const risk = calculateRiskScore(answers(creditScoring), dpia);
    expect(risk.level).toBe("MEDIUM");
    // (2 + 1.5 + 1.5 + 2 x 1/3) / 12.5 = 45%
    expect(risk.score).toBe(45);
  });

  it("matches answers saved in Spanish and booleans saved as true/false", () => {
    const risk = calculateRiskScore(
      answers({
        ...creditScoring,
        q5_1: true,
        q5_2: false,
        q7_1: "Medio",
        q7_2: "No: el riesgo residual se ha mitigado suficientemente",
      }),
      dpia
    );
    expect(risk).toEqual({ score: 45, level: "MEDIUM" });
  });

  it("the recorded conclusion sets the level and the score stays in its band", () => {
    const low = calculateRiskScore(answers({ ...creditScoring, q5_1: "No", q5_4: "No", q5_5: "No", q7_1: "High" }), dpia);
    expect(low.level).toBe("HIGH");
    expect(low.score).toBe(51);

    const high = calculateRiskScore(
      answers({ ...creditScoring, q5_2: "Yes", q5_3: "Yes", q7_1: "Low", q7_2: "Yes — high residual risk that cannot be sufficiently mitigated" }),
      dpia
    );
    expect(high.level).toBe("LOW");
    expect(high.score).toBe(25);
  });

  it("follows the score bands when no conclusion is recorded yet", () => {
    const risk = deriveAssessmentRisk(dpia, answers({ q5_1: "Yes", q5_2: "Yes", q5_3: "No", q5_4: "Yes", q5_5: "No" }));
    // (2 + 2 + 1.5) / 8.5 = 65%
    expect(risk).toEqual({ score: 65, level: "HIGH" });
  });

  it("has nothing to derive from free text alone", () => {
    expect(deriveAssessmentRisk(dpia, answers({ q1_1: "Description only." }))).toBeNull();
    expect(calculateRiskScore([], dpia)).toEqual({ score: 0, level: "LOW" });
  });
});

describe("TIA, PIA, LIA and Custom risk score", () => {
  it("TIA v2: likelihood and severity set the level on a 4 x 4 matrix", () => {
    const tia = v2("TIA");
    const base = {
      tiav2_1_5: "No",
      tiav2_2_1: "No adequacy decision",
      tiav2_2_2: "Access exists but with effective oversight and safeguards",
      tiav2_2_3: "Possible: operates in a sector that may be targeted",
      tiav2_2_4: "Partial: administrative remedies only",
      tiav2_4_3: "Yes, with conditions",
    };
    expect(calculateRiskScore(answers({ ...base, tiav2_4_1: "Medium", tiav2_4_2: "Medium" }), tia).level).toBe("MEDIUM");
    expect(calculateRiskScore(answers({ ...base, tiav2_4_1: "Medium", tiav2_4_2: "High" }), tia).level).toBe("HIGH");
    expect(calculateRiskScore(answers({ ...base, tiav2_4_1: "Low", tiav2_4_2: "Negligible" }), tia).level).toBe("LOW");
    // A transfer that cannot proceed is at least High.
    const refused = calculateRiskScore(
      answers({ ...base, tiav2_4_1: "Low", tiav2_4_2: "Low", tiav2_4_3: "No: residual risk too high, suspend or find another route" }),
      tia
    );
    expect(refused.level).toBe("HIGH");
    expect(refused.score).toBeGreaterThanOrEqual(51);
  });

  it("PIA v2: the overall privacy risk after measures is the level", () => {
    const pia = v2("PIA");
    const risk = calculateRiskScore(
      answers({ piav2_1_3: "No", piav2_2_3: "Yes", piav2_3_2: "Yes", piav2_3_3: "Yes", piav2_4_1: "Yes", piav2_4_3: "No", piav2_5_2: "Medium" }),
      pia
    );
    expect(risk.level).toBe("MEDIUM");
    expect(risk.score).toBeGreaterThanOrEqual(26);
    expect(risk.score).toBeLessThanOrEqual(50);
  });

  it("LIA v2: no level question, so the balancing answers give the score", () => {
    const lia = v2("LIA");
    const favourable = calculateRiskScore(
      answers({
        liav2_1_3: "Yes, on all three",
        liav2_2_1: "Essential",
        liav2_2_2: "No, this is the least intrusive means",
        liav2_2_3: "Yes",
        liav2_3_1: "No special category or criminal-offence data",
        liav2_3_2: "Clearly expected",
        liav2_3_3: "Positive or neutral",
        liav2_3_4: "No",
        liav2_3_5: "The interest prevails",
        liav2_4_2: "Yes",
      }),
      lia
    );
    expect(favourable).toEqual({ score: 0, level: "LOW" });

    const adverse = calculateRiskScore(
      answers({
        liav2_1_3: "Partly",
        liav2_2_1: "Convenient but not necessary",
        liav2_2_2: "A less intrusive means is available",
        liav2_2_3: "No",
        liav2_3_1: "Includes special category or criminal-offence data",
        liav2_3_2: "Would not expect it",
        liav2_3_3: "Significant negative",
        liav2_3_4: "Yes",
        liav2_3_5: "The individual's rights prevail (do not rely on legitimate interest)",
        liav2_4_2: "No",
      }),
      lia
    );
    expect(adverse.level).toBe("CRITICAL");
  });

  it("Custom v2: the overall risk level is the level", () => {
    const risk = calculateRiskScore(
      answers({ customv2_2_2: "High", customv2_3_2: "Acceptable with conditions" }),
      v2("CUSTOM")
    );
    expect(risk.level).toBe("HIGH");
  });

  it("every graded label and level label names a real option of its template", () => {
    const options = new Map<string, string[]>();
    for (const s of dpiaTemplateData.sections as Array<{ questions: Array<{ id: string; type: string; options?: string[] }> }>) {
      for (const q of s.questions) options.set(q.id, q.type === "boolean" ? ["Yes", "No"] : q.options ?? []);
    }
    for (const t of ASSESSMENT_TEMPLATES_V2) {
      for (const s of serializeSections(t) as Array<{ questions: Array<{ id: string; type: string; options?: string[] }> }>) {
        for (const q of s.questions) options.set(q.id, q.type === "boolean" ? ["Yes", "No"] : q.options ?? []);
      }
    }
    for (const [id, indicator] of Object.entries(INDICATORS)) {
      expect(options.has(id), id).toBe(true);
      for (const label of Object.keys(indicator.grades ?? {})) expect(options.get(id), `${id}: ${label}`).toContain(label);
    }
    for (const [id, labels] of Object.entries(LEVEL_QUESTIONS)) {
      if (id === "custom2_2") continue; // v1 Custom template, kept for running assessments
      for (const label of Object.keys(labels)) expect(options.get(id), `${id}: ${label}`).toContain(label);
    }
  });
});

describe("derived on display", () => {
  it("an assessment stored as 0% Low before the fix shows the derived figures", () => {
    const stored = { id: "a1", riskLevel: "LOW" as const, riskScore: 0 };
    expect(withDerivedRisk(stored, dpia, answers(creditScoring))).toMatchObject({ riskLevel: "MEDIUM", riskScore: 45 });
  });

  it("an assessment not yet scored stays unscored", () => {
    const draft = { id: "a2", riskLevel: null, riskScore: null };
    expect(withDerivedRisk(draft, dpia, answers(creditScoring))).toEqual(draft);
  });
});
