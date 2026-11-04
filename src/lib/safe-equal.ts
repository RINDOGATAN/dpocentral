// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Constant-time string comparison for static secrets (API keys, the cron
 * bearer token). A plain `===` or `Array.includes` returns as soon as the
 * first byte differs, which leaks how much of a guess was right. Node
 * runtime only (route handlers, never the edge middleware).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { timingSafeEqual } from "node:crypto";

/** True when `a` and `b` are the same string; the time taken does not depend on where they differ. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still do a comparison so a length mismatch costs the same as a
    // content mismatch, then reject.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * True when `candidate` equals ANY of `accepted`. Every entry is compared,
 * even after a match, so the time taken does not reveal which entry (if
 * any) matched.
 */
export function safeEqualAny(candidate: string, accepted: readonly string[]): boolean {
  let matched = false;
  for (const key of accepted) {
    if (safeEqual(candidate, key)) matched = true;
  }
  return matched;
}
