// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The risk score and risk level of an assessment, derived from the answers its
 * template records.
 *
 * Templates do not carry a per-answer risk score: saved responses have no
 * `riskScore`, so a score averaged over that field was always 0 ("Low"). The
 * score is computed here from the answers themselves:
 *
 *  1. Indicators. A scored question contributes a grade between 0 and 1,
 *     weighted. Its weight is the template's `riskWeight`, or the weight in
 *     INDICATORS below (the v2 templates carry no `riskWeight`). A boolean
 *     grades "Yes" as 1 unless INDICATORS says otherwise; a select grades by
 *     option position (first option 0, last option 1) unless INDICATORS gives
 *     a grade per option. Free text is not scored. The score is the weighted
 *     average, as a percentage.
 *  2. Conclusion. Where the template records the assessment's own risk
 *     conclusion (a residual or overall risk level, or a likelihood and a
 *     severity), that conclusion sets the level, and the score is kept inside
 *     that level's band. The figure shown therefore never contradicts the
 *     conclusion written in the assessment.
 *  3. Otherwise the level follows the score bands (0-25 Low, 26-50 Medium,
 *     51-75 High, 76-100 Critical).
 *
 * Questions hidden by `showIf` are left out. Answers saved in Spanish, or in an
 * earlier wording, are matched to the stored English options by position.
 * The health-data advertising template keeps its own result.
 */

import { RiskLevel, type AssessmentStatus } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import {
  answerMapFrom,
  answerValues,
  canonicalValues,
  hasConditions,
  visibleSections,
  type ConditionalSection,
} from "@/lib/assessment-conditions";
import { computeHealthAdtechResult, isHealthAdtechTemplate } from "@/lib/health-adtech/results";
import { allLocalizedSections } from "./template-locales";

export interface RiskTemplate {
  type: string;
  sections: unknown;
  scoringLogic?: unknown;
}

export interface RiskResponse {
  questionId: string;
  response: unknown;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
}

type Question = {
  id: string;
  text: string;
  type?: string;
  options?: string[];
  riskWeight?: number;
};

type Section = ConditionalSection & { title: string; questions?: Question[] };

const LEVELS: RiskLevel[] = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];

/** The score band of each level, inclusive. */
export const LEVEL_BANDS: Record<RiskLevel, { min: number; max: number }> = {
  LOW: { min: 0, max: 25 },
  MEDIUM: { min: 26, max: 50 },
  HIGH: { min: 51, max: 75 },
  CRITICAL: { min: 76, max: 100 },
};

const BAND_MIDPOINT: Record<RiskLevel, number> = { LOW: 13, MEDIUM: 38, HIGH: 63, CRITICAL: 88 };

export function levelForScore(score: number): RiskLevel {
  if (score <= LEVEL_BANDS.LOW.max) return RiskLevel.LOW;
  if (score <= LEVEL_BANDS.MEDIUM.max) return RiskLevel.MEDIUM;
  if (score <= LEVEL_BANDS.HIGH.max) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

// ── Scored questions the templates do not weight themselves ──────────────

interface Indicator {
  weight: number;
  /** Grade per stored (English) option label; booleans use "Yes" and "No". */
  grades?: Record<string, number>;
}

const YES_IS_GOOD = { Yes: 0, No: 1 };

/**
 * Indicators of the v2 LIA, TIA, PIA and Custom templates. A question named
 * here and also weighted by its template uses this entry.
 */
export const INDICATORS: Record<string, Indicator> = {
  // LIA v2
  liav2_1_3: { weight: 1.5 },
  liav2_2_1: { weight: 1.5 },
  liav2_2_2: { weight: 1.5 },
  liav2_2_3: { weight: 1, grades: YES_IS_GOOD },
  liav2_3_1: { weight: 2 },
  liav2_3_2: { weight: 2 },
  liav2_3_3: { weight: 2 },
  liav2_3_4: { weight: 2 },
  liav2_3_5: { weight: 2 },
  liav2_4_2: { weight: 1, grades: YES_IS_GOOD },
  // TIA v2 ("Unknown" is graded as high as the worst known answer)
  tiav2_1_5: { weight: 1.5 },
  tiav2_2_1: { weight: 1 },
  tiav2_2_2: { weight: 2 },
  tiav2_2_3: {
    weight: 2,
    grades: {
      "No: never received such a request": 0,
      "Possible: operates in a sector that may be targeted": 0.5,
      "Yes: transparency reports confirm requests": 1,
      Unknown: 1,
    },
  },
  tiav2_2_4: {
    weight: 1.5,
    grades: {
      "Yes: independent judicial review": 0,
      "Partial: administrative remedies only": 0.5,
      "No effective remedies": 1,
      Unknown: 1,
    },
  },
  tiav2_4_1: { weight: 2 },
  tiav2_4_2: { weight: 2 },
  tiav2_4_3: { weight: 2 },
  // PIA v2
  piav2_1_3: { weight: 2 },
  piav2_2_3: { weight: 1, grades: YES_IS_GOOD },
  piav2_3_2: { weight: 1, grades: YES_IS_GOOD },
  piav2_3_3: { weight: 1 },
  piav2_4_1: { weight: 1, grades: YES_IS_GOOD },
  piav2_4_3: { weight: 2 },
  piav2_5_2: { weight: 2 },
  // Custom v2
  customv2_2_2: { weight: 2 },
  customv2_3_2: { weight: 1.5 },
};

// ── The assessment's own risk conclusion ─────────────────────────────────

const LOW_TO_CRITICAL = { Low: RiskLevel.LOW, Medium: RiskLevel.MEDIUM, High: RiskLevel.HIGH, Critical: RiskLevel.CRITICAL };

/**
 * Questions whose answer is the assessment's risk level, by question id and
 * stored (English) option label. An answer that matches no label is ignored,
 * so a custom template reusing an id with other options is not misread.
 */
export const LEVEL_QUESTIONS: Record<string, Record<string, RiskLevel>> = {
  q7_1: LOW_TO_CRITICAL, // DPIA: overall residual risk after mitigations
  piav2_5_2: { Low: RiskLevel.LOW, Medium: RiskLevel.MEDIUM, High: RiskLevel.HIGH }, // PIA v2
  customv2_2_2: LOW_TO_CRITICAL, // Custom v2: overall risk level
  custom2_2: LOW_TO_CRITICAL, // Custom v1: overall risk level
};

/**
 * Likelihood and severity pairs (TIA v2 and v1), combined on a 4 x 4 matrix.
 * Options are graded by position: negligible, low, medium, high.
 */
const MATRIX_PAIRS: Array<{ likelihood: string; severity: string; refusal?: { questionId: string; prefix: string } }> = [
  { likelihood: "tiav2_4_1", severity: "tiav2_4_2", refusal: { questionId: "tiav2_4_3", prefix: "No" } },
  { likelihood: "tia4_1", severity: "tia4_2", refusal: { questionId: "tia4_3", prefix: "No" } },
];

const L = RiskLevel.LOW;
const M = RiskLevel.MEDIUM;
const H = RiskLevel.HIGH;
const C = RiskLevel.CRITICAL;

/** Rows: likelihood negligible to high. Columns: severity negligible to high. */
const MATRIX: RiskLevel[][] = [
  [L, L, L, M],
  [L, L, M, M],
  [L, M, M, H],
  [M, M, H, C],
];

// ── Computation ──────────────────────────────────────────────────────────

function sectionsOf(template: RiskTemplate): Section[] {
  return Array.isArray(template.sections) ? (template.sections as Section[]) : [];
}

function isYes(raw: unknown): boolean | null {
  if (raw === true) return true;
  if (raw === false) return false;
  const text = typeof raw === "string" ? raw.trim().toLowerCase() : null;
  if (text === "yes" || text === "true" || text === "sí" || text === "si") return true;
  if (text === "no" || text === "false") return false;
  return null;
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
}

/**
 * The derived risk of an assessment, or null when no answer it holds is
 * scored (nothing to derive a figure from).
 */
export function deriveAssessmentRisk(
  template: RiskTemplate,
  responses: ReadonlyArray<RiskResponse>
): RiskResult | null {
  if (isHealthAdtechTemplate(template)) {
    const result = computeHealthAdtechResult(responses);
    if (result.riskLevel && result.riskScore != null) {
      return { score: result.riskScore, level: RiskLevel[result.riskLevel] };
    }
    return null;
  }

  const stored = sectionsOf(template);
  const answers = answerMapFrom(responses.filter((r) => !r.questionId.includes("::")));
  const localized = allLocalizedSections(template.type, stored);
  const visible = hasConditions(stored) ? visibleSections(stored, answers, localized) : stored;

  const localizedOptions = (questionId: string) =>
    localized.map((sections) => {
      for (const s of sections) for (const q of (s.questions ?? []) as Question[]) if (q.id === questionId) return q.options;
      return undefined;
    });

  const questions = new Map<string, Question>();
  for (const s of visible) for (const q of s.questions ?? []) questions.set(q.id, q);

  /** The answer as the stored (English) option label, or null. */
  const choice = (q: Question): string | null => {
    const raw = answers[q.id];
    if (raw == null) return null;
    if (q.type === "boolean") {
      const yes = isYes(raw);
      return yes == null ? null : yes ? "Yes" : "No";
    }
    const values = canonicalValues(answerValues(raw), q.options, localizedOptions(q.id));
    return values.length === 1 ? values[0] : null;
  };

  // 1. Indicators
  let weightSum = 0;
  let weighted = 0;
  for (const q of questions.values()) {
    if (q.type !== "boolean" && q.type !== "select") continue;
    const indicator = INDICATORS[q.id];
    const weight = indicator?.weight ?? (typeof q.riskWeight === "number" ? q.riskWeight : 0);
    if (!(weight > 0)) continue;
    const value = choice(q);
    if (value == null) continue;

    let grade: number | undefined = indicator?.grades?.[value];
    if (grade === undefined) {
      if (q.type === "boolean") grade = value === "Yes" ? 1 : 0;
      else {
        const options = q.options ?? [];
        const i = options.indexOf(value);
        if (i < 0) continue;
        grade = options.length > 1 ? i / (options.length - 1) : 0;
      }
    }
    weightSum += weight;
    weighted += weight * grade;
  }
  const indicatorScore = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : null;

  // 2. Conclusion
  let conclusion: RiskLevel | null = null;
  for (const [questionId, labels] of Object.entries(LEVEL_QUESTIONS)) {
    const q = questions.get(questionId);
    const value = q ? choice(q) : null;
    if (value && labels[value]) {
      conclusion = labels[value];
      break;
    }
  }
  if (!conclusion) {
    for (const pair of MATRIX_PAIRS) {
      const lq = questions.get(pair.likelihood);
      const sq = questions.get(pair.severity);
      const lv = lq ? choice(lq) : null;
      const sv = sq ? choice(sq) : null;
      const li = lv ? (lq!.options ?? []).indexOf(lv) : -1;
      const si = sv ? (sq!.options ?? []).indexOf(sv) : -1;
      if (li < 0 || si < 0 || li > 3 || si > 3) continue;
      conclusion = MATRIX[li][si];
      const rq = pair.refusal ? questions.get(pair.refusal.questionId) : undefined;
      const refusal = rq ? choice(rq) : null;
      if (refusal?.startsWith(pair.refusal!.prefix)) conclusion = maxLevel(conclusion, RiskLevel.HIGH);
      break;
    }
  }

  if (conclusion) {
    const band = LEVEL_BANDS[conclusion];
    const score =
      indicatorScore == null ? BAND_MIDPOINT[conclusion] : Math.min(band.max, Math.max(band.min, indicatorScore));
    return { score, level: conclusion };
  }

  // 3. Score bands
  if (indicatorScore == null) return null;
  return { score: indicatorScore, level: levelForScore(indicatorScore) };
}

/** The value stored when an assessment is scored (submit, approve). */
export function calculateRiskScore(
  responses: ReadonlyArray<RiskResponse>,
  template: RiskTemplate
): RiskResult {
  return deriveAssessmentRisk(template, responses) ?? { score: 0, level: RiskLevel.LOW };
}

/**
 * The assessment with its risk figures derived from its answers. Only an
 * assessment already scored (a stored level) is rescored, so a draft stays
 * unscored; one scored before this derivation existed shows the derived
 * figures without any stored change.
 */
export function withDerivedRisk<
  A extends { riskLevel: RiskLevel | null; riskScore: number | null },
>(assessment: A, template: RiskTemplate | null | undefined, responses: ReadonlyArray<RiskResponse>): A {
  if (assessment.riskLevel == null || !template) return assessment;
  const derived = calculateRiskScore(responses, template);
  return { ...assessment, riskScore: derived.score, riskLevel: derived.level };
}

/**
 * Every scored assessment of an organisation with its derived risk figures,
 * for counts and rankings that cannot read the stored columns.
 */
export async function scoredAssessmentsWithDerivedRisk(
  prisma: Db,
  organizationId: string
): Promise<Array<{ id: string; name: string; status: AssessmentStatus; riskLevel: RiskLevel; riskScore: number }>> {
  const rows = await prisma.assessment.findMany({
    where: { organizationId, riskLevel: { not: null } },
    select: {
      id: true,
      name: true,
      status: true,
      riskLevel: true,
      riskScore: true,
      template: { select: { type: true, sections: true, scoringLogic: true } },
      responses: { select: { questionId: true, response: true } },
    },
  });
  return rows.map(({ template, responses, ...a }) => {
    const derived = withDerivedRisk(a, template, responses);
    return { ...derived, riskLevel: derived.riskLevel!, riskScore: derived.riskScore ?? 0 };
  });
}
