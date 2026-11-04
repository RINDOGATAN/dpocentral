// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Timezone-safe helpers for `<input type="date">` values.
 *
 * `new Date("2026-07-17")` parses as UTC midnight, so in any timezone west
 * of UTC the value renders back as 7/16 — the classic date-only off-by-one.
 * These helpers keep date-only round-trips in the user's LOCAL calendar:
 * parse "YYYY-MM-DD" as local midnight, and derive input values from local
 * date components (never `toISOString()`).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse an `<input type="date">` value as a LOCAL date (midnight local time). */
export function parseDateInput(value: string): Date {
  const m = DATE_ONLY.exec(value.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  // Not date-only (defensive): let the platform parse it.
  return new Date(value);
}

/** Format a date as the local-calendar "YYYY-MM-DD" an `<input type="date">` expects. */
export function toDateInputValue(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
