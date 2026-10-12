// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A transfer's destination is stored as a two-letter ISO 3166 country code:
 * the transfer rules and the adequacy list compare codes, so a name such as
 * "India" would never match. The forms keep what is typed in capitals and
 * accept only two letters.
 */
export function normaliseCountryCode(input: string): string {
  return input.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}
