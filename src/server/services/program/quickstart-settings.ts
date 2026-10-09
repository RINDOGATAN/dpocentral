// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What a completed quick start leaves in the organisation's settings JSON.
 *
 * `settings.quickstart.completedAt` is what the program path's quick start
 * step reads (path-counts.ts) and what day 1 of the 30/60/90-day plan falls
 * back to (plan-start.ts). The first completion is kept, so running the quick
 * start again never moves day 1. Every other key in the settings is kept as it
 * was; the programme's name is saved when one is given.
 *
 * Pure, so the rule is tested without a database.
 */

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function quickstartSettingsAfterRun(
  current: unknown,
  run: {
    now: Date;
    programName?: string;
  },
): Record<string, unknown> {
  const settings = settingsObject(current);
  const previous = settingsObject(settings.quickstart);
  const completedAt =
    typeof previous.completedAt === "string" ? previous.completedAt : run.now.toISOString();
  const name = run.programName?.trim();
  return {
    ...settings,
    ...(name ? { programName: name } : {}),
    quickstart: {
      ...previous,
      completedAt,
      lastRunAt: run.now.toISOString(),
    },
  };
}
