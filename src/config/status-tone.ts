// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One severity vocabulary for the whole product.
 *
 * The PDF reports already worked this way: five semantic tones in
 * src/server/services/export/design-system/tokens.ts, with a risk tier mapped
 * onto a tone before anything is painted. The screen now uses the same five
 * names and the same mapping functions, so a vendor that prints as "danger" in
 * a report is the same tone on the page that produced it.
 *
 * The rules a tone has to obey:
 *
 *  1. Text meets 4.5 to 1 against the surface it sits on.
 *  2. Colour never carries meaning on its own. A tone always appears with a
 *     word and with a shape: an icon, a border or a marker. Someone who cannot
 *     tell the hues apart reads the same information from the same screen.
 *  3. Body text stays in the body text colour, inside alerts and warnings too.
 *     The severity shows in the icon, the border and the heading word, never by
 *     tinting the sentence.
 *  4. A non-text mark that carries meaning meets 3 to 1 against its background.
 *
 * The class strings for the screen live in src/config/status-palette.ts. The
 * ratios are computed and asserted in tests/contrast.test.ts.
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const STATUS_TONES: readonly StatusTone[] = [
  "success",
  "warning",
  "danger",
  "info",
  "neutral",
] as const;

/**
 * Risk tier to tone. Kept separate from raw criticality so the mapping can
 * differ per report context without moving the tone definitions.
 */
export function toneForRiskTier(tier: string | null | undefined): StatusTone {
  switch (tier) {
    case "CRITICAL":
      return "danger";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "info";
    case "LOW":
      return "success";
    default:
      return "neutral";
  }
}

export function toneForVendorStatus(status: string): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
    case "TERMINATED":
      return "danger";
    case "UNDER_REVIEW":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * A percentage score to a tone. The thresholds were already hard-coded on the
 * reports page; they live here now so the screen and any future report agree.
 */
export function toneForScore(score: number): StatusTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

/** The AI Act risk levels, which run the same four steps as a risk tier. */
export function toneForAiRiskLevel(level: string | null | undefined): StatusTone {
  switch (level) {
    case "UNACCEPTABLE":
      return "danger";
    case "HIGH_RISK":
      return "warning";
    case "LIMITED":
      return "info";
    case "MINIMAL":
      return "success";
    default:
      return "neutral";
  }
}

/** How sensitive a data element is, from public through special category. */
export function toneForSensitivity(level: string | null | undefined): StatusTone {
  switch (level) {
    case "SPECIAL_CATEGORY":
      return "danger";
    case "RESTRICTED":
      return "warning";
    case "CONFIDENTIAL":
      return "info";
    default:
      return "neutral";
  }
}

/** Where a record sits in a review workflow: registered, reviewed, decided. */
export function toneForComplianceStatus(status: string | null | undefined): StatusTone {
  switch (status) {
    case "COMPLIANT":
    case "RESOLVED":
    case "COMPLETED":
    case "APPROVED":
      return "success";
    case "NON_COMPLIANT":
    case "OVERDUE":
    case "REJECTED":
      return "danger";
    case "UNDER_REVIEW":
    case "IN_PROGRESS":
    case "INVESTIGATING":
    case "PENDING":
      return "warning";
    case "REGISTERED":
    case "OPEN":
    case "NEW":
      return "info";
    default:
      return "neutral";
  }
}
