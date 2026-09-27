// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The 30/60/90-day plan's state in words, one place for the menu, the next-step
 * card and the portfolio. Keys under `guided.plan`. Never a reproach: after the
 * last day the words are "plan complete" or the stages left, nothing else.
 */

import type { PlanState } from "./plan";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** "Day 12 of 90"; after the plan's days, "Plan complete" or the stages left. Null before it starts. */
export function planDayText(state: PlanState | null, t: Translate): string | null {
  if (!state || state.kind === "notStarted") return null;
  if (state.kind === "complete") return t("plan.complete");
  if (state.kind === "remaining") return remainingText(state.stageNumbers, t);
  return t("plan.day", { day: state.day, total: state.totalDays });
}

/** "On plan" or "Behind plan by N days"; after the plan's days, as planDayText. */
export function planPaceText(state: PlanState | null, t: Translate): string | null {
  if (!state || state.kind === "notStarted") return null;
  if (state.kind === "running") {
    return state.behindBy > 0 ? t("plan.behind", { days: state.behindBy }) : t("plan.onPlan");
  }
  return planDayText(state, t);
}

/** Both, for one cell: "Day 40 of 90 · Behind plan by 10 days". */
export function planSummaryText(state: PlanState | null, t: Translate): string {
  if (!state || state.kind === "notStarted") return t("plan.notStarted");
  if (state.kind !== "running") return planDayText(state, t) ?? "";
  return `${planDayText(state, t)} · ${planPaceText(state, t)}`;
}

function remainingText(stageNumbers: number[], t: Translate): string {
  return t("plan.remaining", { count: stageNumbers.length, stages: stageNumbers.join(", ") });
}
