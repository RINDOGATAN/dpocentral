// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The region an organisation was created from, on the hosted service only:
 * "EU" when the creator's request came from one of the 27 EU member states
 * (src/lib/region.ts), "OTHER" otherwise. Kept in Organization.settings as
 * `signupRegion` (no country code, no address), so that e-mails sent without
 * a visitor (the pilot reminders) can show prices by the same rule as the
 * pages. Absent on the kit, on organisations created before it was recorded,
 * and when the hosting platform sent no country.
 */

import { isEuCountry } from "@/lib/region";

export type SignupRegion = "EU" | "OTHER";

export const SIGNUP_REGION_KEY = "signupRegion";

/** The settings to store at creation, or undefined when nothing is known. */
export function signupRegionSettings(
  country: string | null | undefined,
  hosted: boolean
): { signupRegion: SignupRegion } | undefined {
  if (!hosted || !country || !country.trim()) return undefined;
  return { signupRegion: isEuCountry(country) ? "EU" : "OTHER" };
}

/** Reads the recorded region from Organization.settings, or null. */
export function signupRegionOf(settings: unknown): SignupRegion | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const v = (settings as Record<string, unknown>)[SIGNUP_REGION_KEY];
  return v === "EU" || v === "OTHER" ? v : null;
}
