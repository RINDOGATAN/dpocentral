// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Where does your organisation operate?": the quick start's first step offers
 * the places of the jurisdiction catalog (owner's decision d8, 9 October 2026,
 * as AI Sentinel's quick start does), so "What applies" is done once the quick
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
  if (["EU", "UK", "CH"].includes(entry.region)) return "europe";
  return "other";
}

/** The catalog entries offered as places: every law except the AI-governance ones. */
export const PLACE_CODES: readonly string[] = JURISDICTION_CATALOG.filter(
  (j) => j.category !== "ai_governance",
).map((j) => j.code);

export function isPlaceCode(code: string): boolean {
  return PLACE_CODES.includes(code);
}

/** The places in the reader's language, in catalog order within each group. */
export function placeOptions(locale: string | null | undefined): PlaceOption[] {
  const es = locale?.split("-")[0] === "es";
  return JURISDICTION_CATALOG.filter((j) => isPlaceCode(j.code)).map((j) => {
    const text = es ? JURISDICTION_CATALOG_ES[j.code] : undefined;
    return {
      code: j.code,
      group: groupOf(j),
      place: (es ? (PLACE_ES_OVERRIDE[j.region] ?? text?.regionLabel) : PLACE_EN[j.region]) ?? j.region,
      law: (es ? text?.shortName : undefined) ?? j.shortName,
    };
  });
}

export const PLACE_GROUPS: readonly PlaceGroup[] = ["europe", "us", "other"];
