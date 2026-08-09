// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The {curly} variable dictionary (INSTRUCTIONS.md §§4–5): context values,
 * parameters exposing a boilerplateVariable, and the derived variables whose
 * texts live in the pack's derived-texts.json. The §5 rules ported here are
 * the generator's brain — keep each one aligned with the table in the
 * INSTRUCTIONS before changing anything.
 */

import { localize } from "./pack";
import { splitMulti } from "./multi";
import type {
  ClauseSelections,
  DpaContext,
  DpaFacts,
  DpaLang,
  DpaPack,
  DpaParty,
  PackParameter,
} from "./types";

/** Fill-in placeholder used when a party name/detail is unavailable (§4b). */
export const NAME_PLACEHOLDER = "[_________________]";

const GOVERNING_LAW_DISPLAY: Record<string, Record<DpaLang, string>> = {
  CALIFORNIA: {
    en: "State of California, United States of America",
    es: "Estado de California, EE.UU.",
  },
  ENGLAND_WALES: {
    en: "England and Wales, United Kingdom",
    es: "Inglaterra y Gales, Reino Unido",
  },
  SPAIN: {
    en: "Kingdom of Spain",
    es: "Reino de España",
  },
};

/** Apply parameter defaults to absent facts (§1). Returns a new map. */
export function applyFactDefaults(
  facts: DpaFacts,
  parameters: PackParameter[]
): DpaFacts {
  const out: DpaFacts = { ...facts };
  for (const param of parameters) {
    if (param.default !== undefined && !(out[param.id] ?? "").trim()) {
      out[param.id] = param.default;
    }
  }
  return out;
}

/** Ids of required parameters that are missing after defaults (§1). */
export function missingRequiredFacts(
  facts: DpaFacts,
  parameters: PackParameter[]
): string[] {
  return parameters
    .filter((p) => p.required && !(facts[p.id] ?? "").trim())
    .map((p) => p.id);
}


function letteredList(items: string[]): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  return items.map((l, i) => `(${letters[i] || i + 1}) ${l};`).join("\n");
}

function optionLabel(param: PackParameter | undefined, key: string, lang: DpaLang): string {
  const label = param?.optionLabels?.[key];
  return label ? localize(label, lang) : key;
}

/** A login email is never a party or signatory name (§4b). */
function nonEmail(v: string | null | undefined): string | undefined {
  return v && !v.includes("@") ? v : undefined;
}

function signatureLabels(lang: DpaLang) {
  // The signature-line labels are app-authored (the pack's signature block
  // only contains {partyXSignatureBlock} slots); localized for ES parity.
  return lang === "es"
    ? { onBehalf: "En nombre y representación de", signature: "Firma", name: "Nombre", title: "Cargo", date: "Fecha" }
    : { onBehalf: "For and on behalf of", signature: "Signature", name: "Name", title: "Title", date: "Date" };
}

function buildSignatureBlock(party: DpaParty, lang: DpaLang): string {
  const l = signatureLabels(lang);
  const name = party.name?.trim() && nonEmail(party.name) ? party.name.trim() : NAME_PLACEHOLDER;
  const signatory = nonEmail(party.signatoryName?.trim()) || NAME_PLACEHOLDER;
  const title = party.signatoryTitle?.trim() || NAME_PLACEHOLDER;
  return `${l.onBehalf} ${name}:\n\n${l.signature}: _______________________________\n\n${l.name}: ${signatory}\n\n${l.title}: ${title}\n\n${l.date}: ___________________________________`;
}

export function formatLongDate(date: Date, lang: DpaLang): string {
  // Dates arrive as date-only values (UTC midnight); format in UTC so the
  // rendered day never shifts with the server's timezone.
  return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function selectedOptionCode(
  pack: DpaPack,
  selections: ClauseSelections,
  clauseId: string
): string | undefined {
  const clause = pack.clauses.find((c) => c.id === clauseId);
  const optionId = selections[clauseId];
  if (!clause || !optionId) return undefined;
  return clause.options.find((o) => o.id === optionId)?.code;
}

/**
 * The free-text governing law when the custom forum option is selected
 * (§5 {governingLaw} override) — it must replace the jurisdiction-derived
 * display EVERYWHERE the governing law renders, cover included.
 */
export function customGoverningLaw(
  facts: DpaFacts,
  selections: ClauseSelections,
  pack: DpaPack
): string {
  const code = selectedOptionCode(pack, selections, "governing-law-jurisdiction");
  return code === "custom" ? (facts["custom-governing-law"] ?? "").trim() : "";
}

export function governingLawDisplay(
  facts: DpaFacts,
  selections: ClauseSelections,
  context: DpaContext,
  pack: DpaPack
): string {
  return (
    customGoverningLaw(facts, selections, pack) ||
    GOVERNING_LAW_DISPLAY[context.governingLaw]?.[context.language] ||
    GOVERNING_LAW_DISPLAY[context.governingLaw]?.en ||
    context.governingLaw
  );
}

/**
 * Build the complete variable dictionary for {curly} interpolation and
 * showIf evaluation. `facts` must already have defaults applied.
 */
export function buildVariables(
  facts: DpaFacts,
  selections: ClauseSelections,
  context: DpaContext,
  pack: DpaPack
): Record<string, string> {
  const lang = context.language;
  const { derived, importerStatements, transferAddendaSections } = pack.derivedTexts;
  const param = (id: string) => pack.parameters.find((p) => p.id === id);

  // ── Context variables (§4b) ──
  const controllerName = nonEmail(context.controller.name?.trim()) || NAME_PLACEHOLDER;
  const processorName = nonEmail(context.processor.name?.trim()) || NAME_PLACEHOLDER;
  const variables: Record<string, string> = {
    effectiveDate: formatLongDate(context.effectiveDate, lang),
    governingLaw: governingLawDisplay(facts, selections, context, pack),
    partyAName: controllerName,
    partyBName: processorName,
    partyAAddress: context.controller.address?.trim() || NAME_PLACEHOLDER,
    partyBAddress: context.processor.address?.trim() || NAME_PLACEHOLDER,
    partyAId: context.controller.taxId?.trim() || "",
    partyBId: context.processor.taxId?.trim() || "",
    partyASignatureBlock: buildSignatureBlock(context.controller, lang),
    partyBSignatureBlock: buildSignatureBlock(context.processor, lang),
  };

  // ── Parameters with boilerplateVariable (§4a) ──
  for (const p of pack.parameters) {
    if (p.boilerplateVariable && facts[p.id]) {
      variables[p.boilerplateVariable] = facts[p.id];
    }
  }

  // ── Derived variables (§5) — override the raw values above ──

  // {dataCategoriesList}: lettered localized list + free-text "other" entries.
  const dcParam = param("data-categories");
  const dcKeys = splitMulti(facts["data-categories"]);
  const dcLabels = dcKeys.map((k) => optionLabel(dcParam, k, lang));
  const dcOther = (facts["data-categories-other"] ?? "").trim();
  if (dcOther) {
    dcLabels.push(...dcOther.split(";").map((s) => s.trim()).filter(Boolean));
  }
  variables.dataCategoriesList = dcLabels.length
    ? letteredList(dcLabels)
    : localize(derived.dataCategoriesFallback, lang);

  // {tomsInherited} / {tomsInheritedList}: only measures BOTH confirmed and
  // marked inherited count — never attribute an unconfirmed control.
  const confirmedToms = splitMulti(facts["toms-confirmed"]);
  const inheritedToms = splitMulti(facts["toms-inherited"]).filter((k) =>
    confirmedToms.includes(k)
  );
  variables.tomsInherited = inheritedToms.join(",");
  if (inheritedToms.length) {
    variables.tomsInheritedList = letteredList(
      inheritedToms.map((k) => optionLabel(param("toms-confirmed"), k, lang))
    );
  }

  // {processorEstablishmentDisplay}
  const establishment = (facts["processor-establishment"] ?? "").trim();
  variables.processorEstablishmentDisplay = localize(
    derived.establishmentDisplay[establishment] ?? derived.establishmentDisplay.OTHER,
    lang
  );

  // {dpfStatement}
  variables.dpfStatement = localize(
    facts["processor-dpf-certified"] === "yes"
      ? derived.dpfStatement.certified
      : derived.dpfStatement.notCertified,
    lang
  );

  // {tiaSafeguardsList}: technical/organizational selections pass through;
  // a contractual measure may ONLY appear derived from the agreed
  // government-access clause (code "commitments"), never from a checkbox.
  const sgKeys = splitMulti(facts["tia-safeguards"]).filter(
    (k) => !k.startsWith("contract-")
  );
  const sgLabels = sgKeys.map((k) => optionLabel(param("tia-safeguards"), k, lang));
  const govCommitments =
    selectedOptionCode(pack, selections, "government-access-requests") === "commitments";
  if (govCommitments) {
    sgLabels.push(localize(derived.govAccessDerivedMeasure, lang));
  }
  variables.tiaSafeguardsList = sgLabels.length
    ? letteredList(sgLabels)
    : localize(derived.safeguardsEmpty, lang);

  // {processingPurpose}: an EEA-residency claim is a statement about where
  // processing happens, so it must surface in the processing description
  // (Annex I §2 and Annex IV §1), not only as a TIA bullet.
  if (sgKeys.includes("tech-eu-residency") && variables.processingPurpose) {
    variables.processingPurpose += localize(derived.euResidencyNote, lang);
  }

  // {tiaConclusion}: EDPB Recommendations 01/2020 — without at least one
  // technical measure the conclusion documents residual risk. Never soften.
  variables.tiaConclusion = localize(
    sgKeys.some((k) => k.startsWith("tech-"))
      ? derived.tiaConclusion.withTechnicalMeasure
      : derived.tiaConclusion.residualRisk,
    lang
  );

  // Importer statements (declarations default "unknown", never fabricated).
  variables.tiaEcspStatement = localize(
    importerStatements.ecsp[facts["tia-importer-hosted"] ?? "yes"] ??
      importerStatements.ecsp.unknown,
    lang
  );
  variables.tiaRequestHistoryStatement = localize(
    importerStatements.requestHistory[facts["tia-gov-requests-received"] ?? "unknown"] ??
      importerStatements.requestHistory.unknown,
    lang
  );
  variables.tiaBreachHistoryStatement = localize(
    importerStatements.breachHistory[facts["tia-breach-history"] ?? "unknown"] ??
      importerStatements.breachHistory.unknown,
    lang
  );

  // {transferAddendaSections}: keyed "uk-<yes|no>_swiss-<yes|no>".
  const ukKey = facts["include-uk-addendum"] === "no" ? "no" : "yes";
  const swissKey = facts["include-swiss-adaptations"] === "no" ? "no" : "yes";
  variables.transferAddendaSections = localize(
    transferAddendaSections[`uk-${ukKey}_swiss-${swissKey}`],
    lang
  );

  return variables;
}
