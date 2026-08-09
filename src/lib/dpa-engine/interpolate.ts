// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The pack's three text mechanisms (INSTRUCTIONS.md §§3, 4, 6):
 *  - [token] interpolation in clause legalText, with Spanish token spellings;
 *  - {curly} variable interpolation in boilerplate;
 *  - showIf visibility conditions on annexes and their sections.
 */

import type {
  DpaFacts,
  DpaLang,
  PackDerivedTexts,
  PackParameter,
  ShowIf,
  ShowIfCondition,
} from "./types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace `[token]` occurrences in a clause's legalText with parameter
 * values (§3). Only parameters whose scope is "*" or the clause's id apply;
 * matching is case-insensitive; in Spanish text the Spanish spelling from
 * the pack's tokenTranslations also matches (and the English token still
 * does). A missing value leaves the bracket visible — an intentional
 * fill-in blank.
 */
export function interpolateTokens(
  text: string,
  facts: DpaFacts,
  parameters: PackParameter[],
  clauseId: string,
  lang: DpaLang,
  tokenTranslations: PackDerivedTexts["tokenTranslations"]
): string {
  if (!text) return text;
  let result = text;
  for (const param of parameters) {
    if (!param.token) continue;
    if (param.scope !== "*" && param.scope !== clauseId) continue;
    const value = facts[param.id];
    if (!value) continue;

    const tokens = [param.token];
    if (lang !== "en") {
      const localized = tokenTranslations[param.token.toLowerCase()]?.[lang];
      if (localized) tokens.push(localized);
    }
    for (const token of tokens) {
      result = result.replace(
        new RegExp("\\[" + escapeRegExp(token) + "\\]", "gi"),
        value
      );
    }
  }
  return result;
}

/**
 * Replace `{curly}` variables in boilerplate text (§4). Unknown or empty
 * variables leave the brace visible, matching the Dealroom generator.
 */
export function interpolateCurly(
  text: string,
  variables: Record<string, string>
): string {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => variables[key] || match);
}

/**
 * Evaluate a showIf declaration (§6): one condition or an array, ANDed.
 * Missing variables fail closed (annex/section hidden).
 */
export function evalShowIf(
  showIf: ShowIf | null | undefined,
  variables: Record<string, string>
): boolean {
  if (!showIf) return true;
  const conditions = Array.isArray(showIf) ? showIf : [showIf];
  return conditions.every((c: ShowIfCondition) => {
    if (!c.variable) return false;
    const value = variables[c.variable] ?? "";
    if (Array.isArray(c.in)) return c.in.includes(value);
    if (typeof c.contains === "string") {
      return value
        .split(",")
        .map((s) => s.trim())
        .includes(c.contains);
    }
    if (c.present === true) return value.trim() !== "";
    return false;
  });
}

/**
 * Find declared parameters whose `[token]` still sits unfilled in the
 * rendered clause texts (§3: warn before finalizing) — the fact was never
 * recorded and the parameter has no default, so the finished document would
 * ship with a visible fill-in blank.
 */
export function findUnfilledTokens(
  clauses: Array<{ clauseId: string; legalText: string }>,
  facts: DpaFacts,
  parameters: PackParameter[],
  lang: DpaLang,
  tokenTranslations: PackDerivedTexts["tokenTranslations"]
): PackParameter[] {
  const missing: PackParameter[] = [];
  for (const param of parameters) {
    if (!param.token) continue;
    if ((facts[param.id] ?? "").trim()) continue;
    const spellings = [param.token.toLowerCase()];
    if (lang !== "en") {
      const localized = tokenTranslations[param.token.toLowerCase()]?.[lang];
      if (localized) spellings.push(localized.toLowerCase());
    }
    const present = clauses.some(
      (c) =>
        (param.scope === "*" || param.scope === c.clauseId) &&
        spellings.some((tk) => c.legalText.toLowerCase().includes(`[${tk}]`))
    );
    if (present) missing.push(param);
  }
  return missing;
}
