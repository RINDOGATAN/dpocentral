// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "What raises the score" on the Reports page: one line per area of the
 * weighted module score that is unrated or below 100, saying what would rate
 * it or raise it, with the page where that is done.
 *
 * Pure: the page words each hint (pages.reports.raise.<area>.<kind>).
 */

export type ScoreArea = "ropa" | "assessment" | "dsar" | "incident" | "vendor";

export interface AreaFigures {
  score: number | null;
  total: number;
  compliant: number;
}

export interface ScoreHint {
  area: ScoreArea;
  /** "unrated": no data yet; "raise": rated below 100. */
  kind: "unrated" | "raise";
  /** Records still short of compliant (for "raise"). */
  count: number;
  href: string;
}

const HREF: Record<ScoreArea, string> = {
  ropa: "/privacy/data-inventory",
  assessment: "/privacy/assessments",
  dsar: "/privacy/dsar",
  incident: "/privacy/incidents",
  vendor: "/privacy/vendors",
};

/** In the order of their weight in the score. */
const ORDER: readonly ScoreArea[] = ["ropa", "dsar", "assessment", "incident", "vendor"];

export function scoreHints(
  breakdown: Partial<Record<ScoreArea, AreaFigures>>,
  options: { dsarOn: boolean },
): ScoreHint[] {
  const out: ScoreHint[] = [];
  for (const area of ORDER) {
    if (area === "dsar" && !options.dsarOn) continue;
    const f = breakdown[area];
    if (!f) continue;
    if (f.score === null) out.push({ area, kind: "unrated", count: 0, href: HREF[area] });
    else if (f.score < 100) {
      out.push({ area, kind: "raise", count: Math.max(0, f.total - f.compliant), href: HREF[area] });
    }
  }
  return out;
}
