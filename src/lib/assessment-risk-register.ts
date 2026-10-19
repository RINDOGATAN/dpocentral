// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The risk register of an assessment: one row per risk to the rights and
 * freedoms of data subjects (GDPR Art. 35(7)(c)), each graded for likelihood
 * and severity on the same four-level scale (negligible, limited,
 * significant, maximum), before measures (inherent) and after them
 * (residual). The level of a pair is read from one 4 x 4 matrix, the same one
 * the transfer assessments use (src/server/services/assessment/risk-score.ts).
 *
 * Pure functions, shared by the router, the assessment page and the report.
 */

export type RegisterLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const REGISTER_LEVELS: RegisterLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** The four grades of both axes, 1 (negligible) to 4 (maximum). */
export const RISK_GRADES = [1, 2, 3, 4] as const;
export type RiskGrade = (typeof RISK_GRADES)[number];

const L: RegisterLevel = "LOW";
const M: RegisterLevel = "MEDIUM";
const H: RegisterLevel = "HIGH";
const C: RegisterLevel = "CRITICAL";

/** Rows: likelihood 1 to 4. Columns: severity 1 to 4. */
export const RISK_MATRIX: RegisterLevel[][] = [
  [L, L, L, M],
  [L, L, M, M],
  [L, M, M, H],
  [M, M, H, C],
];

export function isGrade(value: unknown): value is RiskGrade {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 4;
}

/** The level of a likelihood and severity pair, or null when either is missing. */
export function matrixLevel(
  likelihood: number | null | undefined,
  severity: number | null | undefined
): RegisterLevel | null {
  if (!isGrade(likelihood) || !isGrade(severity)) return null;
  return RISK_MATRIX[likelihood - 1][severity - 1];
}

export function levelRank(level: RegisterLevel | null | undefined): number {
  return level ? REGISTER_LEVELS.indexOf(level) : -1;
}

export function maxRegisterLevel(
  levels: ReadonlyArray<RegisterLevel | null | undefined>
): RegisterLevel | null {
  let best: RegisterLevel | null = null;
  for (const l of levels) if (l && levelRank(l) > levelRank(best)) best = l;
  return best;
}

export interface RegisterRisk {
  id: string;
  likelihood: number;
  severity: number;
  residualLikelihood: number | null;
  residualSeverity: number | null;
  status: string;
}

export interface RegisterMeasure {
  riskId: string;
  status: string;
}

export interface RegisterRow<R extends RegisterRisk = RegisterRisk> {
  risk: R;
  inherent: RegisterLevel | null;
  /** After measures; null while the residual grades are not given. */
  residual: RegisterLevel | null;
  measures: number;
  implementedMeasures: number;
}

const DONE = new Set(["IMPLEMENTED", "VERIFIED"]);

export function registerRows<R extends RegisterRisk>(
  risks: ReadonlyArray<R>,
  measures: ReadonlyArray<RegisterMeasure>
): RegisterRow<R>[] {
  return risks.map((risk) => {
    const own = measures.filter((m) => m.riskId === risk.id);
    return {
      risk,
      inherent: matrixLevel(risk.likelihood, risk.severity),
      residual: matrixLevel(risk.residualLikelihood, risk.residualSeverity),
      measures: own.length,
      implementedMeasures: own.filter((m) => DONE.has(m.status)).length,
    };
  });
}

export interface RegisterSummary {
  /** Highest inherent level of the register, null when it is empty. */
  inherent: RegisterLevel | null;
  /**
   * Highest residual level. A risk whose residual is not graded counts at its
   * inherent level: no reduction is assumed that nobody has assessed.
   */
  residual: RegisterLevel | null;
  /** Rows whose residual is two or more levels below the inherent level with no implemented measure. */
  unsupportedReductions: string[];
}

export function registerSummary(rows: ReadonlyArray<RegisterRow>): RegisterSummary {
  return {
    inherent: maxRegisterLevel(rows.map((r) => r.inherent)),
    residual: maxRegisterLevel(rows.map((r) => r.residual ?? r.inherent)),
    unsupportedReductions: rows
      .filter(
        (r) =>
          r.residual != null &&
          levelRank(r.inherent) - levelRank(r.residual) >= 2 &&
          r.implementedMeasures === 0
      )
      .map((r) => r.risk.id),
  };
}

export type CloseRefusal = "NO_MEASURE" | "NO_RESIDUAL";

/**
 * Why a risk cannot be closed, or null when it can: a risk is closed only
 * once at least one measure addresses it and its residual is graded.
 */
export function closeRefusal(
  risk: Pick<RegisterRisk, "id" | "residualLikelihood" | "residualSeverity">,
  measures: ReadonlyArray<RegisterMeasure>
): CloseRefusal | null {
  if (!measures.some((m) => m.riskId === risk.id)) return "NO_MEASURE";
  if (matrixLevel(risk.residualLikelihood, risk.residualSeverity) == null) return "NO_RESIDUAL";
  return null;
}
