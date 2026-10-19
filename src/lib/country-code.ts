// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A transfer's destination is stored as a two-letter ISO 3166-1 country code:
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

/**
 * The officially assigned ISO 3166-1 alpha-2 codes, plus XK (Kosovo, the
 * user-assigned code in general use). "UK" and "EL" are not on the list:
 * they are common aliases of GB and GR, which `canonicalCountryCode` maps.
 */
export const ISO_COUNTRY_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

const ISO_SET = new Set(ISO_COUNTRY_CODES);

/** Aliases in common use for two ISO codes. */
const COUNTRY_ALIASES: Record<string, string> = { UK: "GB", EL: "GR" };

/**
 * The stored form of a destination: trimmed, in capitals, with the aliases
 * UK and EL mapped to GB and GR. Anything else is returned as given (in
 * capitals), so `isIsoCountryCode` can reject it.
 */
export function canonicalCountryCode(input: string | null | undefined): string {
  const c = (input ?? "").trim().toUpperCase();
  return COUNTRY_ALIASES[c] ?? c;
}

/** True for an assigned ISO 3166-1 alpha-2 code (after `canonicalCountryCode`). */
export function isIsoCountryCode(value: string | null | undefined): boolean {
  return ISO_SET.has(canonicalCountryCode(value));
}

/** The country's name in `locale` (Intl), or the code when the runtime has none. */
export function countryName(code: string, locale: string): string {
  const c = canonicalCountryCode(code);
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(c) ?? c;
  } catch {
    return c;
  }
}
