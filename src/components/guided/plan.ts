// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The 30/60/90-day plan laid over the program path.
 *
 * Product-neutral, like ./path.ts: a product supplies the windows (which
 * stages belong to which days; AI Sentinel's are PLAN_WINDOWS in
 * ./path-config.ts), the day the plan started and the step statuses, and gets
 * one state back. The menu, the next-step card and the portfolio all read it
 * from here, so they cannot disagree.
 *
 * Day 1 is the day the plan started (for AI Sentinel, the day the quick start
 * was first completed: src/server/services/program/plan-start.ts). Days are
 * whole calendar days counted in UTC, so the figure does not change with the
 * reader's time zone.
 *
 * Quiet by design: the plan never nags. Before the end it says "on plan" or
 * "behind plan by N days"; after the end it says "plan complete" or which
 * stages remain, and nothing about lateness.
 *
 * Pure: no React, no Prisma, no Next.
 */

import { stageProgress, type PathConfig, type PathStatuses } from "./path";

export interface PlanWindow {
  /** The last day of the window: 30, 60, 90. */
  untilDay: number;
  /** The stage ids due by then. */
  stages: string[];
}

export type PlanState =
  /** No start date yet (the quick start has not been completed). */
  | { kind: "notStarted" }
  /** Within the plan's days. `behindBy` is 0 when on plan. */
  | { kind: "running"; day: number; totalDays: number; behindBy: number }
  /** Every stage in the plan is done, whatever the day. */
  | { kind: "complete"; day: number; totalDays: number }
  /** Past the last day, with stages left (their 1-based numbers, in order). */
  | { kind: "remaining"; day: number; totalDays: number; stageNumbers: number[] };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * The plan day for `today`: 1 on the start day, 2 the next calendar day, and
 * so on. A start date in the future (a clock set wrong) reads as day 1.
 */
export function planDay(start: Date, today: Date): number {
  const days = Math.floor((utcMidnight(today) - utcMidnight(start)) / DAY_MS);
  return Math.max(1, days + 1);
}

/**
 * A stage counts as done for the plan when its counted steps are all done,
 * or when it has no counted step at all for this organisation (nothing is
 * owed there).
 */
function stageDone<C>(config: PathConfig<C>, stageId: string, statuses: PathStatuses): boolean {
  const stage = config.stages.find((s) => s.id === stageId);
  if (!stage) return true;
  const p = stageProgress(stage, statuses);
  return p.total === 0 || p.state === "done";
}

export function planState<C>(
  config: PathConfig<C>,
  windows: readonly PlanWindow[],
  statuses: PathStatuses,
  start: Date | string | null,
  today: Date,
): PlanState {
  if (!start) return { kind: "notStarted" };
  const startDate = typeof start === "string" ? new Date(start) : start;
  if (Number.isNaN(startDate.getTime())) return { kind: "notStarted" };

  const day = planDay(startDate, today);
  const totalDays = windows.reduce((max, w) => Math.max(max, w.untilDay), 0);
  const stageIds = windows.flatMap((w) => w.stages);
  const open = stageIds.filter((id) => !stageDone(config, id, statuses));

  if (open.length === 0) return { kind: "complete", day, totalDays };

  if (day > totalDays) {
    const stageNumbers = config.stages
      .map((stage, index) => ({ id: stage.id, number: index + 1 }))
      .filter((s) => open.includes(s.id))
      .map((s) => s.number);
    return { kind: "remaining", day, totalDays, stageNumbers };
  }

  // Behind by the days since the earliest window that ended with a stage of
  // it still open. Today's own window is never late: day 30 is still on plan.
  let behindBy = 0;
  for (const window of windows) {
    if (day > window.untilDay && window.stages.some((id) => open.includes(id))) {
      behindBy = Math.max(behindBy, day - window.untilDay);
    }
  }
  return { kind: "running", day, totalDays, behindBy };
}
