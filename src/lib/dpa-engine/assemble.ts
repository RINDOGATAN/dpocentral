// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Document assembly (INSTRUCTIONS.md §2) and the standalone TIA (§8).
 * Produces a structured document model — data, not markup; PDF rendering
 * lives in a separate layer.
 */

import { getDpaPack, localize } from "./pack";
import {
  evalShowIf,
  findUnfilledBlanks,
  interpolateCurly,
  interpolateTokens,
} from "./interpolate";
import {
  applyFactDefaults,
  buildVariables,
  formatLongDate,
  governingLawDisplay,
  missingRequiredFacts,
  NAME_PLACEHOLDER,
} from "./variables";
import type {
  AssembleInput,
  DocAnnex,
  DocArticle,
  DpaDocumentModel,
  DpaLang,
  PackAnnex,
  TiaDocumentModel,
} from "./types";

export class DpaEngineError extends Error {
  constructor(
    message: string,
    public readonly missingFacts: string[] = [],
    public readonly invalidSelections: string[] = []
  ) {
    super(message);
    this.name = "DpaEngineError";
  }
}

interface RenderedClause {
  clauseId: string;
  title: string;
  legalText: string;
  isGoverningLaw: boolean;
}

function renderClauses(
  facts: Record<string, string>,
  selections: Record<string, string>,
  lang: DpaLang
): RenderedClause[] {
  const pack = getDpaPack();
  const rendered: RenderedClause[] = [];
  const ordered = [...pack.clauses].sort((a, b) => a.order - b.order);
  // Every clause needs a valid selection: a missing or unknown option id
  // must fail generation, never silently drop an operative clause (breach
  // notification, liability, …) from a signature-ready contract. Omission
  // is only expressible through a selected option with empty legalText.
  const invalid = ordered.filter(
    (clause) => !clause.options.some((o) => o.id === selections[clause.id])
  );
  if (invalid.length) {
    throw new DpaEngineError(
      `Missing or unknown clause selections: ${invalid.map((c) => c.id).join(", ")}`,
      [],
      invalid.map((c) => c.id)
    );
  }
  for (const clause of ordered) {
    const option = clause.options.find((o) => o.id === selections[clause.id])!;
    // Empty legalText means "clause omitted" (§2.6), e.g. the "none" option
    // of government-access-requests.
    const raw = option.legalText[lang] ?? option.legalText.en ?? "";
    if (!raw.trim()) continue;
    rendered.push({
      clauseId: clause.id,
      title: localize(clause.title, lang),
      legalText: interpolateTokens(
        raw,
        facts,
        pack.parameters,
        clause.id,
        lang,
        pack.derivedTexts.tokenTranslations
      ),
      isGoverningLaw: clause.id === "governing-law-jurisdiction",
    });
  }
  return rendered;
}

function renderAnnex(
  annex: PackAnnex,
  variables: Record<string, string>,
  lang: DpaLang
): DocAnnex {
  const parts: string[] = [];
  const text = localize(annex.text, lang);
  if (text) parts.push(interpolateCurly(text, variables));
  for (const section of annex.sections ?? []) {
    if (evalShowIf(section.showIf, variables)) {
      parts.push(interpolateCurly(localize(section.text, lang), variables));
    }
  }
  return { title: localize(annex.title, lang), body: parts.join("\n\n") };
}

/** The pack's TIA annex — identified by its includeTia visibility condition. */
function findTiaAnnex(): PackAnnex | undefined {
  const pack = getDpaPack();
  return pack.boilerplate.annexes.find((a) => {
    const conditions = Array.isArray(a.showIf) ? a.showIf : a.showIf ? [a.showIf] : [];
    return conditions.some((c) => c.variable === "includeTia");
  });
}

function prepare(input: AssembleInput) {
  const pack = getDpaPack();
  const facts = applyFactDefaults(input.facts, pack.parameters);
  const missing = missingRequiredFacts(facts, pack.parameters);
  if (missing.length) {
    throw new DpaEngineError(
      `Missing required facts: ${missing.join(", ")}`,
      missing
    );
  }
  const variables = buildVariables(facts, input.selections, input.context, pack);
  return { pack, facts, variables };
}

export function assembleDpa(input: AssembleInput): DpaDocumentModel {
  const { pack, facts, variables } = prepare(input);
  const { context, selections } = input;
  const lang = context.language;
  const bp = pack.boilerplate;
  const warnings: string[] = [];

  const clauses = renderClauses(facts, selections, lang);

  // §3: warn on every [bracket] that survived interpolation — unfilled
  // parameter tokens and the pack's native fill-in blanks alike.
  for (const { clauseId, blank } of findUnfilledBlanks(clauses)) {
    const clause = pack.clauses.find((c) => c.id === clauseId);
    const title = clause ? localize(clause.title, lang) : clauseId;
    warnings.push(
      lang === "es"
        ? `Espacio en blanco sin cumplimentar en la cláusula «${title}»: ${blank}`
        : `Unfilled fill-in blank in clause "${title}": ${blank}`
    );
  }

  const resolve = (value: unknown) =>
    interpolateCurly(localize(value as never, lang), variables);

  const articles: DocArticle[] = [];
  for (const sc of bp.standardClauses) {
    articles.push({ group: "standard", title: localize(sc.title, lang), body: resolve(sc.text) });
  }
  for (const c of clauses.filter((c) => !c.isGoverningLaw)) {
    articles.push({ group: "negotiated", clauseId: c.clauseId, title: c.title, body: c.legalText });
  }
  // The governing-law clause renders as its own article after the other
  // negotiated terms, not inside the numbered list (§2.6).
  const glClause = clauses.find((c) => c.isGoverningLaw);
  if (glClause) {
    articles.push({
      group: "governingLaw",
      clauseId: glClause.clauseId,
      title: glClause.title,
      body: glClause.legalText,
    });
  }
  for (const gp of bp.generalProvisions) {
    articles.push({ group: "general", title: localize(gp.title, lang), body: resolve(gp.text) });
  }
  const jp = bp.jurisdictionProvisions[context.governingLaw];
  if (jp) {
    articles.push({ group: "jurisdiction", title: localize(jp.title, lang), body: resolve(jp.text) });
  }

  const annexes = bp.annexes
    .filter((a) => evalShowIf(a.showIf, variables))
    .map((a) => renderAnnex(a, variables, lang));

  return {
    language: lang,
    title: localize(bp.contractTitle, lang),
    cover: {
      title: localize(bp.contractTitle, lang),
      partyALabel: localize(bp.partyLabels.partyA, lang),
      partyBLabel: localize(bp.partyLabels.partyB, lang),
      partyAName: variables.partyAName ?? NAME_PLACEHOLDER,
      partyBName: variables.partyBName ?? NAME_PLACEHOLDER,
      effectiveDate: variables.effectiveDate ?? "",
      governingLaw: governingLawDisplay(facts, selections, context, pack),
    },
    preamble: resolve(bp.preamble),
    background: resolve(bp.background),
    definitions: bp.definitions.map((d) => ({
      term: localize(d.term, lang),
      definition: resolve(d.definition),
    })),
    articles,
    signatureBlock: resolve(bp.signatureBlock),
    annexes,
    warnings,
  };
}

/**
 * The standalone Transfer Impact Assessment (§8): Annex IV alone, preceded
 * by an identification header, producible on demand for disclosure to the
 * competent supervisory authority under SCC Clause 14. Returns null when
 * Annex IV does not render for these facts (no third-country transfer, or
 * the TIA was excluded).
 */
export function assembleStandaloneTia(input: AssembleInput): TiaDocumentModel | null {
  const { variables } = prepare(input);
  const { context } = input;
  const lang = context.language;

  const annex = findTiaAnnex();
  if (!annex || !evalShowIf(annex.showIf, variables)) return null;

  const rendered = renderAnnex(annex, variables, lang);
  const exporterName = variables.partyAName ?? NAME_PLACEHOLDER;
  const importerName = variables.partyBName ?? NAME_PLACEHOLDER;
  const effectiveDate = variables.effectiveDate ?? "";
  const producedDate = formatLongDate(context.producedDate ?? new Date(), lang);
  const dealName = context.dealName?.trim();

  const header =
    lang === "es"
      ? [
          `Exportador de datos (Responsable del tratamiento): ${exporterName}, ${variables.partyAAddress ?? NAME_PLACEHOLDER}.`,
          `Importador de datos (Encargado del tratamiento): ${importerName}, ${variables.partyBAddress ?? NAME_PLACEHOLDER}.`,
          dealName
            ? `Anexo IV del Acuerdo de Encargo de Tratamiento de Datos «${dealName}», de fecha ${effectiveDate}.`
            : `Anexo IV del Acuerdo de Encargo de Tratamiento de Datos entre ${exporterName} y ${importerName}, de fecha ${effectiveDate}.`,
          `Elaborado el ${producedDate}.`,
          `El presente documento reproduce sin modificación el Anexo IV de dicho Acuerdo de Encargo de Tratamiento de Datos, para su puesta a disposición de la autoridad de control competente que lo solicite conforme a la Cláusula 14 de las Cláusulas Contractuales Tipo incorporadas en dicho acuerdo.`,
        ]
      : [
          `Data exporter (Controller): ${exporterName}, ${variables.partyAAddress ?? NAME_PLACEHOLDER}.`,
          `Data importer (Processor): ${importerName}, ${variables.partyBAddress ?? NAME_PLACEHOLDER}.`,
          dealName
            ? `Annex IV to the Data Processing Agreement "${dealName}", dated ${effectiveDate}.`
            : `Annex IV to the Data Processing Agreement between ${exporterName} and ${importerName}, dated ${effectiveDate}.`,
          `Produced on ${producedDate}.`,
          `This document reproduces Annex IV of that Data Processing Agreement without modification, for disclosure to the competent supervisory authority on request under Clause 14 of the Standard Contractual Clauses incorporated in that agreement.`,
        ];

  return {
    language: lang,
    title:
      lang === "es"
        ? "EVALUACIÓN DE IMPACTO DE LA TRANSFERENCIA"
        : "TRANSFER IMPACT ASSESSMENT",
    header,
    annexTitle: rendered.title,
    body: rendered.body,
    warnings: [],
  };
}
