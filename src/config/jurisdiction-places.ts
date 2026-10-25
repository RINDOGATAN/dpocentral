// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Where does your organisation operate?": the quick start's first step offers
 * the places of the jurisdiction catalog (as AI Sentinel's quick start does), so "What applies" is done once the quick
 * start is.
 *
 * One choice per data-protection law of the catalog, labelled by its place
 * ("California", "Brasil") with the law's short name. AI-governance entries
 * (the EU AI Act) are not places and are left out; they stay on the "What
 * applies" page. Pure: read by the picker and by the server, which accepts
 * only these codes.
 */

import { JURISDICTION_CATALOG, type JurisdictionEntry } from "./jurisdiction-catalog";
import { JURISDICTION_CATALOG_ES } from "./jurisdiction-catalog-es";

export type PlaceGroup = "europe" | "us" | "other";

/** English place names by catalog region (Spanish ones are in the Spanish catalog). */
const PLACE_EN: Record<string, string> = {
  EU: "European Union",
  UK: "United Kingdom",
  CH: "Switzerland",
  AD: "Andorra",
  ES: "Spain",
  "US-CA": "California",
  "US-VA": "Virginia",
  "US-CO": "Colorado",
  "US-CT": "Connecticut",
  "US-UT": "Utah",
  "US-IA": "Iowa",
  "US-TX": "Texas",
  "US-FL": "Florida",
  "US-MT": "Montana",
  "US-OR": "Oregon",
  "US-TN": "Tennessee",
  "US-IN": "Indiana",
  "US-KY": "Kentucky",
  "US-NJ": "New Jersey",
  "US-NH": "New Hampshire",
  "US-DE": "Delaware",
  "US-MN": "Minnesota",
  "US-MD": "Maryland",
  "US-NE": "Nebraska",
  BR: "Brazil",
  CA: "Canada",
  MX: "Mexico",
  CN: "China",
  JP: "Japan",
  SG: "Singapore",
  TH: "Thailand",
  IN: "India",
  AU: "Australia",
  NZ: "New Zealand",
  MY: "Malaysia",
  KR: "South Korea",
  ZA: "South Africa",
  SA: "Saudi Arabia",
  NG: "Nigeria",
  AR: "Argentina",
  PH: "Philippines",
  KE: "Kenya",
};

/** Where the Spanish catalog's region label is an abbreviation, the place in full. */
const PLACE_ES_OVERRIDE: Record<string, string> = { EU: "Unión Europea" };

export interface PlaceOption {
  code: string;
  group: PlaceGroup;
  place: string;
  law: string;
}

function groupOf(entry: JurisdictionEntry): PlaceGroup {
  if (entry.region.startsWith("US-")) return "us";
  if (["EU", "UK", "CH", "AD", "ES"].includes(entry.region)) return "europe";
  return "other";
}

/**
 * National laws kept in the catalog but not offered as a choice. The EU is
 * offered as one place, so one member state's national law (Spain's
 * LOPDGDD) is not listed beside it, and Andorra's LQPD is not listed either.
 * An organisation that applied one of them before keeps it: its deadlines,
 * texts and reports still read the catalog entry, and choosing places never
 * removes it (setJurisdictions touches PLACE_CODES only).
 */
export const NOT_OFFERED_CODES: readonly string[] = ["LQPD", "LOPDGDD"];

export function isOfferedCode(code: string): boolean {
  return !NOT_OFFERED_CODES.includes(code);
}

/** The catalog entries offered as places: every law except the AI-governance and the not-offered ones. */
export const PLACE_CODES: readonly string[] = JURISDICTION_CATALOG.filter(
  (j) => j.category !== "ai_governance" && isOfferedCode(j.code),
).map((j) => j.code);

export function isPlaceCode(code: string): boolean {
  return PLACE_CODES.includes(code);
}

/**
 * Laws that only apply together with another: the LOPDGDD complements the
 * GDPR and never applies without it, so an organisation that has Spain
 * applied also has the GDPR, and the GDPR cannot be removed on its own.
 */
export const IMPLIED_LAWS: Readonly<Record<string, readonly string[]>> = { LOPDGDD: ["GDPR"] };

/** The codes chosen plus every law they bring with them, without repeats, in order. */
export function withImpliedLaws(codes: readonly string[]): string[] {
  const out: string[] = [];
  for (const code of codes) for (const c of [code, ...(IMPLIED_LAWS[code] ?? [])]) if (!out.includes(c)) out.push(c);
  return out;
}

/** Codes that another chosen code brings with it (shown as included, not removable on their own). */
export function impliedBy(codes: readonly string[]): string[] {
  return withImpliedLaws(codes).filter((c) => codes.some((k) => (IMPLIED_LAWS[k] ?? []).includes(c)));
}

/**
 * The chosen codes that bring `code` with them (Spain's LOPDGDD for the GDPR).
 * While one is applied, `code` cannot be removed on its own.
 */
export function bringersOf(code: string, codes: readonly string[]): string[] {
  return codes.filter((k) => k !== code && (IMPLIED_LAWS[k] ?? []).includes(code));
}

function placeOptionOf(j: JurisdictionEntry, es: boolean): PlaceOption {
  const text = es ? JURISDICTION_CATALOG_ES[j.code] : undefined;
  return {
    code: j.code,
    group: groupOf(j),
    place: (es ? (PLACE_ES_OVERRIDE[j.region] ?? text?.regionLabel) : PLACE_EN[j.region]) ?? j.region,
    law: (es ? text?.shortName : undefined) ?? j.shortName,
  };
}

/** The places in the reader's language, in catalog order within each group. */
export function placeOptions(locale: string | null | undefined): PlaceOption[] {
  const es = locale?.split("-")[0] === "es";
  return JURISDICTION_CATALOG.filter((j) => isPlaceCode(j.code)).map((j) => placeOptionOf(j, es));
}

/**
 * The place of any catalog law in the reader's language, offered or not
 * ("Spain" for an organisation that applied the LOPDGDD before it stopped
 * being offered). Undefined for a code the catalog does not hold.
 */
export function placeOf(code: string, locale: string | null | undefined): PlaceOption | undefined {
  const entry = JURISDICTION_CATALOG.find((j) => j.code === code);
  return entry ? placeOptionOf(entry, locale?.split("-")[0] === "es") : undefined;
}

export const PLACE_GROUPS: readonly PlaceGroup[] = ["europe", "us", "other"];
