// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The 27 EU member states, for the transfer rules (a transfer inside the EEA
 * needs no safeguard). Pure: no Next.js imports.
 */

/** The 27 EU member states, as ISO 3166-1 alpha-2 codes (Greece is "GR"). */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

const EU_SET = new Set(EU_COUNTRIES);

/** True only for the 27 EU member states. A missing or unknown code is not EU. */
export function isEuCountry(country: string | null | undefined): boolean {
  return !!country && EU_SET.has(country.trim().toUpperCase());
}
