// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What finishes a step, in one sentence, from the step's own rule
 * (path-config.ts): the dashboard's next actions and the board report both
 * say it from here, so they say the same thing. Keys under `guided.finish`.
 * The assessments step follows what the organisation's answers say about a
 * DPIA (`dpiaDuty`): required, worth considering, or neither.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The steps with a sentence of their own; any other step falls back to its "why". */
const FINISH_STEPS: ReadonlySet<string> = new Set([
  "quickstart",
  "applies",
  "dataInventory",
  "ropa",
  "vendors",
  "transfers",
  "dsar",
  "incidents",
]);

export function stepFinishText(
  t: Translate,
  stepId: string,
  dpiaDuty: "applies" | "check" | null | undefined,
): string {
  if (stepId === "assessments") {
    return t(
      dpiaDuty === "applies"
        ? "finish.assessmentsDpia"
        : dpiaDuty === "check"
          ? "finish.assessmentsCheck"
          : "finish.assessments",
    );
  }
  return FINISH_STEPS.has(stepId) ? t(`finish.${stepId}`) : t(`steps.${stepId}.why`);
}
