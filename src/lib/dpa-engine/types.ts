// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Types for the DPA + TIA document engine.
 *
 * The engine assembles signature-ready documents from the read-only Dealroom
 * contract pack (`src/lib/dealroom/contract-pack/`) and one flat map of facts,
 * per the pack's INSTRUCTIONS.md. Output is a structured document model
 * (data, not markup); PDF rendering is a separate layer.
 */

export type DpaLang = "en" | "es";

/** Bilingual string as stored in the pack ({ en, es }) or a plain string. */
export type Localized = string | { [lang: string]: string };

// ── Pack shapes ─────────────────────────────────────────────────────────

export interface PackParameter {
  id: string;
  /** Fills [token] occurrences in clause legalText (§3). */
  token?: string;
  /** "*" or a clause id the token applies to. */
  scope?: string;
  type: string;
  required?: boolean;
  default?: string;
  /** Exposes the value under this name for {curly} interpolation (§4a). */
  boilerplateVariable?: string;
  label: Localized;
  hint?: Localized;
  placeholder?: Localized;
  options?: string[];
  optionLabels?: Record<string, Localized>;
}

export interface PackClauseOption {
  id: string;
  /** Semantic code ("commitments", "custom") — rules match on this, not id. */
  code: string;
  label: Localized;
  order: number;
  /** Empty text for a language means "clause omitted" (§2.6). */
  legalText: Record<string, string>;
  plainDescription?: Localized;
}

export interface PackClause {
  id: string;
  order: number;
  title: Localized;
  isRequired?: boolean;
  options: PackClauseOption[];
}

export interface ShowIfCondition {
  variable?: string;
  in?: string[];
  contains?: string;
  present?: boolean;
}

export type ShowIf = ShowIfCondition | ShowIfCondition[];

export interface PackAnnexSection {
  showIf?: ShowIf | null;
  text: Localized;
}

export interface PackAnnex {
  title: Localized;
  text: Localized;
  showIf?: ShowIf | null;
  sections?: PackAnnexSection[];
}

export interface PackTitledText {
  title: Localized;
  text: Localized;
}

export interface PackDefinition {
  term: Localized;
  definition: Localized;
}

export interface PackBoilerplate {
  contractTitle: Localized;
  preamble: Localized;
  background: Localized;
  definitions: PackDefinition[];
  standardClauses: PackTitledText[];
  generalProvisions: PackTitledText[];
  jurisdictionProvisions: Record<string, PackTitledText>;
  signatureBlock: Localized;
  partyLabels: { partyA: Localized; partyB: Localized };
  annexes: PackAnnex[];
}

export interface PackDerivedTexts {
  schema: string;
  derived: {
    dataCategoriesFallback: Localized;
    dpfStatement: { certified: Localized; notCertified: Localized };
    establishmentDisplay: Record<string, Localized>;
    euResidencyNote: Localized;
    govAccessDerivedMeasure: Localized;
    safeguardsEmpty: Localized;
    tiaConclusion: { withTechnicalMeasure: Localized; residualRisk: Localized };
  };
  importerStatements: {
    ecsp: Record<string, Localized>;
    requestHistory: Record<string, Localized>;
    breachHistory: Record<string, Localized>;
  };
  transferAddendaSections: Record<string, Localized>;
  tokenTranslations: Record<string, { [lang: string]: string }>;
}

export interface DpaPack {
  parameters: PackParameter[];
  clauses: PackClause[];
  boilerplate: PackBoilerplate;
  derivedTexts: PackDerivedTexts;
}

// ── Engine inputs ───────────────────────────────────────────────────────

/** Parameter values keyed by parameter id; multi-selects comma-joined (§1). */
export type DpaFacts = Record<string, string>;

/** One selected option id per clause id (§1). */
export type ClauseSelections = Record<string, string>;

export type GoverningLawKey = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

export interface DpaParty {
  name?: string | null;
  address?: string | null;
  taxId?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
}

export interface DpaContext {
  language: DpaLang;
  effectiveDate: Date;
  governingLaw: GoverningLawKey;
  /** Party A of the DPA — always the Controller (§4b). */
  controller: DpaParty;
  /** Party B of the DPA — always the Processor (§4b). */
  processor: DpaParty;
  /** Agreement name used on the cover and in the standalone-TIA header. */
  dealName?: string;
  /** Date the standalone TIA is produced (§8); defaults to now. */
  producedDate?: Date;
}

export interface AssembleInput {
  facts: DpaFacts;
  selections: ClauseSelections;
  context: DpaContext;
}

// ── Output model ────────────────────────────────────────────────────────

export type ArticleGroup =
  | "standard"
  | "negotiated"
  | "governingLaw"
  | "general"
  | "jurisdiction";

export interface DocArticle {
  group: ArticleGroup;
  /** Source clause id for negotiated terms; undefined for boilerplate. */
  clauseId?: string;
  title: string;
  body: string;
}

export interface DocAnnex {
  title: string;
  body: string;
}

export interface DpaCover {
  title: string;
  partyALabel: string;
  partyBLabel: string;
  partyAName: string;
  partyBName: string;
  effectiveDate: string;
  governingLaw: string;
}

export interface DpaDocumentModel {
  language: DpaLang;
  title: string;
  cover: DpaCover;
  preamble: string;
  background: string;
  definitions: { term: string; definition: string }[];
  articles: DocArticle[];
  signatureBlock: string;
  /** Each annex renders on its own page after the signatures (§2.10). */
  annexes: DocAnnex[];
  /** Human-reviewable issues (e.g. unfilled fill-in blanks, §3). */
  warnings: string[];
}

export interface TiaDocumentModel {
  language: DpaLang;
  title: string;
  /** Identification header paragraphs (§8), in order. */
  header: string[];
  /** The Annex IV title as it appears in the DPA. */
  annexTitle: string;
  /** Annex IV body, reproduced without modification (§8). */
  body: string;
  warnings: string[];
}

/** A §7 consistency issue that requires explicit human confirmation. */
export interface ConsistencyIssue {
  code:
    | "pseudonymization-identifying-data"
    | "eu-residency-noneea-processor";
  message: { en: string; es: string };
}
