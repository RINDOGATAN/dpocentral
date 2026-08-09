// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Typed access to the read-only Dealroom contract pack. The pack folder is
 * regenerated from the Dealroom repo (`npm run pack:dpo`) and must never be
 * edited here; this module is the only place that reads it.
 */

import parametersJson from "@/lib/dealroom/contract-pack/dpa/parameters.json";
import clausesJson from "@/lib/dealroom/contract-pack/dpa/clauses.json";
import boilerplateJson from "@/lib/dealroom/contract-pack/dpa/boilerplate.json";
import derivedTextsJson from "@/lib/dealroom/contract-pack/derived-texts.json";

import type {
  DpaPack,
  DpaLang,
  Localized,
  PackBoilerplate,
  PackClause,
  PackDerivedTexts,
  PackParameter,
} from "./types";

const pack: DpaPack = {
  parameters: (parametersJson as { parameters: unknown }).parameters as PackParameter[],
  clauses: (clausesJson as { clauses: unknown }).clauses as PackClause[],
  boilerplate: boilerplateJson as unknown as PackBoilerplate,
  derivedTexts: derivedTextsJson as unknown as PackDerivedTexts,
};

export function getDpaPack(): DpaPack {
  return pack;
}

/**
 * Resolve a bilingual pack value to a flat string: requested language,
 * falling back to English, then to any present language (§1: "always read
 * the matching key of the bilingual objects").
 */
export function localize(value: Localized | undefined | null, lang: DpaLang): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || Object.values(value)[0] || "";
}
