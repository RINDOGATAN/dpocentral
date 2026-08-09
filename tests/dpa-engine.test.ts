// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// The DPA + TIA document engine assembles signature-ready documents from the
// read-only Dealroom contract pack per its INSTRUCTIONS.md. These tests pin
// the mechanisms the playbook calls out: parameter defaults, [token]
// interpolation (incl. Spanish spellings), every §5 derived-variable rule,
// §6 annex/section visibility (fail closed), clause omission, the
// governing-law override, and the §8 standalone TIA.

import { describe, it, expect } from "vitest";
import {
  assembleDpa,
  assembleStandaloneTia,
  DpaEngineError,
  applyFactDefaults,
  buildVariables,
  checkFactConsistency,
  evalShowIf,
  getDpaPack,
  interpolateTokens,
  NAME_PLACEHOLDER,
} from "@/lib/dpa-engine";
import type {
  AssembleInput,
  ClauseSelections,
  DpaContext,
  DpaFacts,
} from "@/lib/dpa-engine";

const BASE_SELECTIONS: ClauseSelections = {
  "scope-processing": "scope-standard",
  "processing-instructions": "instructions-standard",
  "subprocessor-approval": "subproc-general-30d",
  "data-transfer": "transfer-sccs",
  "security-measures": "security-annex",
  "breach-notification": "breach-72h",
  "data-subject-rights": "rights-standard",
  "audit-rights": "audit-reports",
  "data-deletion": "deletion-return-or-delete-60d",
  confidentiality: "confidentiality-standard",
  "liability-indemnification": "liability-2x",
  "breach-liability-cap": "breachcap-supercap-2x",
  "term-termination": "term-30d-cure",
  "governing-law-jurisdiction": "glj-es-madrid",
  "government-access-requests": "gov-access-full",
};

const BASE_FACTS: DpaFacts = {
  "processing-purpose": "Providing the contracted SaaS analytics service.",
  "data-categories": "contact-details,usage-technical",
  "processor-establishment": "US",
  "subprocessor-list": "AWS (hosting); Postmark (email delivery)",
};

const BASE_CONTEXT: DpaContext = {
  language: "en",
  effectiveDate: new Date("2026-08-09T12:00:00Z"),
  governingLaw: "SPAIN",
  controller: {
    name: "Acme Corporation SL",
    address: "Calle Mayor 1, 28013 Madrid, Spain",
    signatoryName: "Jane Roe",
    signatoryTitle: "DPO",
  },
  processor: {
    name: "CloudCo Inc.",
    address: "100 Main St, San Francisco, CA, USA",
  },
};

function input(overrides: {
  facts?: DpaFacts;
  selections?: ClauseSelections;
  context?: Partial<DpaContext>;
} = {}): AssembleInput {
  return {
    facts: { ...BASE_FACTS, ...overrides.facts },
    selections: { ...BASE_SELECTIONS, ...overrides.selections },
    context: { ...BASE_CONTEXT, ...overrides.context },
  };
}

function vars(overrides: Parameters<typeof input>[0] = {}) {
  const i = input(overrides);
  const pack = getDpaPack();
  return buildVariables(
    applyFactDefaults(i.facts, pack.parameters),
    i.selections,
    i.context,
    pack
  );
}

describe("fact model (§1)", () => {
  it("applies parameter defaults for absent facts", () => {
    const facts = applyFactDefaults({}, getDpaPack().parameters);
    expect(facts["include-tia"]).toBe("yes");
    expect(facts["toms-physical"]).toBe("provider-managed");
    expect(facts["include-uk-addendum"]).toBe("yes");
    expect(facts["include-swiss-adaptations"]).toBe("yes");
    expect(facts["tia-gov-requests-received"]).toBe("unknown");
    expect(facts["tia-breach-history"]).toBe("unknown");
  });

  it("throws on missing required facts, listing them", () => {
    expect(() =>
      assembleDpa({ facts: {}, selections: BASE_SELECTIONS, context: BASE_CONTEXT })
    ).toThrowError(DpaEngineError);
    try {
      assembleDpa({ facts: {}, selections: BASE_SELECTIONS, context: BASE_CONTEXT });
    } catch (e) {
      expect((e as DpaEngineError).missingFacts).toEqual(
        expect.arrayContaining(["processing-purpose", "data-categories"])
      );
    }
  });
});

describe("[token] interpolation (§3)", () => {
  const pack = getDpaPack();
  const translations = pack.derivedTexts.tokenTranslations;

  it("fills tokens case-insensitively, scoped to the clause", () => {
    const out = interpolateTokens(
      "The list: [Initial Sub-Processor List].",
      { "subprocessor-list": "AWS" },
      pack.parameters,
      "subprocessor-approval",
      "en",
      translations
    );
    expect(out).toBe("The list: AWS.");
  });

  it("does not apply a clause-scoped parameter to another clause", () => {
    const out = interpolateTokens(
      "[initial sub-processor list]",
      { "subprocessor-list": "AWS" },
      pack.parameters,
      "data-transfer",
      "en",
      translations
    );
    expect(out).toBe("[initial sub-processor list]");
  });

  it("matches the Spanish spelling and the English token in Spanish text", () => {
    const out = interpolateTokens(
      "Lista: [lista inicial de subencargados] y también [initial sub-processor list].",
      { "subprocessor-list": "AWS" },
      pack.parameters,
      "subprocessor-approval",
      "es",
      translations
    );
    expect(out).toBe("Lista: AWS y también AWS.");
  });

  it("leaves the bracket visible when the value is missing", () => {
    const out = interpolateTokens(
      "[initial sub-processor list]",
      {},
      pack.parameters,
      "subprocessor-approval",
      "en",
      translations
    );
    expect(out).toBe("[initial sub-processor list]");
  });

  it("warns before finalizing when a declared token remains unfilled", () => {
    const doc = assembleDpa(input({ facts: { "subprocessor-list": "" } }));
    expect(doc.warnings.some((w) => w.includes("blank"))).toBe(true);
  });

  it("warns about the pack's native fill-in brackets that have no parameter", () => {
    // The no-transfers option carries a literal jurisdiction election blank.
    const doc = assembleDpa(
      input({ selections: { "data-transfer": "transfer-none" } })
    );
    expect(
      doc.warnings.some((w) => w.includes("[EEA/United Kingdom/United States]"))
    ).toBe(true);
  });

  it("does not interpret $-sequences in fact values as replacement patterns", () => {
    const out = interpolateTokens(
      "List: [initial sub-processor list].",
      { "subprocessor-list": "AWS $$ backup: D&B $& Co" },
      getDpaPack().parameters,
      "subprocessor-approval",
      "en",
      getDpaPack().derivedTexts.tokenTranslations
    );
    expect(out).toBe("List: AWS $$ backup: D&B $& Co.");
  });
});

describe("showIf conditions (§6)", () => {
  it("evaluates in / contains / present and ANDs arrays", () => {
    expect(evalShowIf({ variable: "x", in: ["a", "b"] }, { x: "a" })).toBe(true);
    expect(evalShowIf({ variable: "x", in: ["a", "b"] }, { x: "c" })).toBe(false);
    expect(evalShowIf({ variable: "x", contains: "b" }, { x: "a, b ,c" })).toBe(true);
    expect(evalShowIf({ variable: "x", contains: "b" }, { x: "ab,c" })).toBe(false);
    expect(evalShowIf({ variable: "x", present: true }, { x: "  " })).toBe(false);
    expect(
      evalShowIf(
        [{ variable: "x", in: ["a"] }, { variable: "y", present: true }],
        { x: "a", y: "z" }
      )
    ).toBe(true);
    expect(
      evalShowIf(
        [{ variable: "x", in: ["a"] }, { variable: "y", present: true }],
        { x: "a" }
      )
    ).toBe(false);
  });

  it("fails closed on missing variables", () => {
    expect(evalShowIf({ variable: "nope", in: [""] }, {})).toBe(true); // "" is in list
    expect(evalShowIf({ variable: "nope", present: true }, {})).toBe(false);
    expect(evalShowIf({ variable: "nope", contains: "x" }, {})).toBe(false);
  });
});

describe("derived variables (§5)", () => {
  it("builds a lettered data-categories list with localized labels and free-text extras", () => {
    const v = vars({
      facts: {
        "data-categories": "contact-details,financial-data",
        "data-categories-other": "Telemetry beacons; Vehicle IDs",
      },
    });
    expect(v.dataCategoriesList).toBe(
      "(a) Contact details;\n(b) Financial / payment data;\n(c) Telemetry beacons;\n(d) Vehicle IDs;"
    );
  });

  it("uses the fallback when no categories are selected", () => {
    const pack = getDpaPack();
    const v = buildVariables(
      applyFactDefaults({ ...BASE_FACTS, "data-categories": "" }, pack.parameters),
      BASE_SELECTIONS,
      BASE_CONTEXT,
      pack
    );
    expect(v.dataCategoriesList).toBe(
      (pack.derivedTexts.derived.dataCategoriesFallback as { en: string }).en
    );
  });

  it("intersects toms-inherited with toms-confirmed — never attributes an unconfirmed control", () => {
    const v = vars({
      facts: {
        "toms-confirmed": "toms-encryption-rest,toms-logging",
        "toms-inherited": "toms-encryption-rest,toms-backup-dr",
      },
    });
    expect(v.tomsInherited).toBe("toms-encryption-rest");
    expect(v.tomsInheritedList).toContain("(a)");
    expect(v.tomsInheritedList).not.toContain("(b)");
  });

  it("selects the DPF statement by certification status", () => {
    const pack = getDpaPack();
    expect(vars({ facts: { "processor-dpf-certified": "yes" } }).dpfStatement).toBe(
      (pack.derivedTexts.derived.dpfStatement.certified as { en: string }).en
    );
    expect(vars().dpfStatement).toBe(
      (pack.derivedTexts.derived.dpfStatement.notCertified as { en: string }).en
    );
  });

  it("appends the contractual measure to the safeguards list ONLY via the commitments gov-access option", () => {
    const withCommitments = vars({
      facts: { "tia-safeguards": "tech-encryption-transit" },
      selections: { "government-access-requests": "gov-access-full" },
    });
    expect(withCommitments.tiaSafeguardsList).toContain("(b) Contractual —");

    const withoutClause = vars({
      facts: { "tia-safeguards": "tech-encryption-transit" },
      selections: { "government-access-requests": "gov-access-none" },
    });
    expect(withoutClause.tiaSafeguardsList).not.toContain("Contractual —");

    // A contract-* checkbox alone may never inject a contractual measure.
    const checkboxOnly = vars({
      facts: { "tia-safeguards": "contract-gov-access" },
      selections: { "government-access-requests": "gov-access-none" },
    });
    expect(checkboxOnly.tiaSafeguardsList).toBe(
      (getDpaPack().derivedTexts.derived.safeguardsEmpty as { en: string }).en
    );
  });

  it("concludes withTechnicalMeasure only when a tech-* safeguard is selected (EDPB rule)", () => {
    const pack = getDpaPack();
    expect(
      vars({ facts: { "tia-safeguards": "tech-encryption-rest" } }).tiaConclusion
    ).toBe((pack.derivedTexts.derived.tiaConclusion.withTechnicalMeasure as { en: string }).en);
    expect(
      vars({ facts: { "tia-safeguards": "org-request-policy" } }).tiaConclusion
    ).toBe((pack.derivedTexts.derived.tiaConclusion.residualRisk as { en: string }).en);
    expect(vars().tiaConclusion).toBe(
      (pack.derivedTexts.derived.tiaConclusion.residualRisk as { en: string }).en
    );
  });

  it("surfaces an EEA-residency claim in the processing purpose", () => {
    const v = vars({ facts: { "tia-safeguards": "tech-eu-residency" } });
    expect(v.processingPurpose).toContain(BASE_FACTS["processing-purpose"]);
    expect(v.processingPurpose).toContain("data-center regions located within the EEA");
  });

  it("selects importer statements from declarations, defaulting to unknown/yes", () => {
    const pack = getDpaPack();
    const v = vars();
    expect(v.tiaEcspStatement).toBe(
      (pack.derivedTexts.importerStatements.ecsp.yes as { en: string }).en
    );
    expect(v.tiaRequestHistoryStatement).toBe(
      (pack.derivedTexts.importerStatements.requestHistory.unknown as { en: string }).en
    );
    const declared = vars({
      facts: { "tia-gov-requests-received": "none", "tia-breach-history": "some" },
    });
    expect(declared.tiaRequestHistoryStatement).toBe(
      (pack.derivedTexts.importerStatements.requestHistory.none as { en: string }).en
    );
    expect(declared.tiaBreachHistoryStatement).toBe(
      (pack.derivedTexts.importerStatements.breachHistory.some as { en: string }).en
    );
  });

  it("picks the transfer-addenda variant from the UK/Swiss flags (defaults yes/yes)", () => {
    const pack = getDpaPack();
    expect(vars().transferAddendaSections).toBe(
      (pack.derivedTexts.transferAddendaSections["uk-yes_swiss-yes"] as { en: string }).en
    );
    expect(
      vars({ facts: { "include-uk-addendum": "no", "include-swiss-adaptations": "no" } })
        .transferAddendaSections
    ).toBe((pack.derivedTexts.transferAddendaSections["uk-no_swiss-no"] as { en: string }).en);
  });

  it("overrides the governing-law display everywhere when the custom option carries free text", () => {
    const doc = assembleDpa(
      input({
        selections: { "governing-law-jurisdiction": "glj-custom" },
        facts: {
          "custom-governing-law": "the laws of Ireland",
          "custom-courts": "the courts of Dublin",
        },
      })
    );
    expect(doc.cover.governingLaw).toBe("the laws of Ireland");
  });

  it("displays the deal's governing law on the cover otherwise", () => {
    expect(assembleDpa(input()).cover.governingLaw).toBe("Kingdom of Spain");
    expect(
      assembleDpa(input({ context: { language: "es" } })).cover.governingLaw
    ).toBe("Reino de España");
  });
});

describe("document assembly (§2)", () => {
  it("orders articles: standard, negotiated, governing-law article, general, jurisdiction", () => {
    const doc = assembleDpa(input());
    const groups = doc.articles.map((a) => a.group);
    const firstNegotiated = groups.indexOf("negotiated");
    const govLaw = groups.indexOf("governingLaw");
    const firstGeneral = groups.indexOf("general");
    expect(groups[0]).toBe("standard");
    expect(firstNegotiated).toBeGreaterThan(groups.lastIndexOf("standard"));
    expect(govLaw).toBeGreaterThan(groups.lastIndexOf("negotiated"));
    expect(firstGeneral).toBeGreaterThan(govLaw);
    expect(groups[groups.length - 1]).toBe("jurisdiction");
  });

  it("renders the governing-law clause as its own article, not a negotiated term", () => {
    const doc = assembleDpa(input());
    expect(
      doc.articles.filter((a) => a.clauseId === "governing-law-jurisdiction")
    ).toHaveLength(1);
    expect(
      doc.articles.find((a) => a.clauseId === "governing-law-jurisdiction")?.group
    ).toBe("governingLaw");
  });

  it("refuses to assemble with a missing or unknown clause selection", () => {
    // A silently dropped operative clause (liability, breach notification…)
    // must never ship in a signature-ready contract.
    const partial = Object.fromEntries(
      Object.entries(BASE_SELECTIONS).filter(([id]) => id !== "breach-notification")
    );
    expect(() =>
      assembleDpa({ facts: BASE_FACTS, selections: partial, context: BASE_CONTEXT })
    ).toThrowError(/breach-notification/);
    expect(() =>
      assembleDpa(
        input({ selections: { "breach-notification": "no-such-option" } })
      )
    ).toThrowError(DpaEngineError);
  });

  it("omits a clause whose selected option has empty legalText", () => {
    const doc = assembleDpa(
      input({ selections: { "government-access-requests": "gov-access-none" } })
    );
    expect(
      doc.articles.some((a) => a.clauseId === "government-access-requests")
    ).toBe(false);
  });

  it("interpolates the preamble parties and never renders an email as a party name", () => {
    const doc = assembleDpa(
      input({ context: { processor: { name: "bob@example.com" } } })
    );
    expect(doc.preamble).toContain("Acme Corporation SL");
    expect(doc.preamble).not.toContain("bob@example.com");
    expect(doc.preamble).toContain(NAME_PLACEHOLDER);
    expect(doc.cover.partyBName).toBe(NAME_PLACEHOLDER);
  });

  it("assembles a complete Spanish document", () => {
    const doc = assembleDpa(input({ context: { language: "es" } }));
    expect(doc.title).toBe("ACUERDO DE ENCARGO DE TRATAMIENTO DE DATOS");
    expect(doc.cover.partyALabel).toBe("Responsable");
    expect(doc.preamble).toContain("9 de agosto de 2026");
    expect(doc.definitions.length).toBeGreaterThan(0);
    expect(doc.articles.length).toBeGreaterThan(10);
    // No unresolved {curly} variables anywhere in the assembled output.
    const everything = [
      doc.preamble,
      doc.background,
      doc.signatureBlock,
      ...doc.articles.map((a) => a.body),
      ...doc.annexes.map((a) => a.body),
    ].join("\n");
    expect(everything).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});

describe("conditional annexes (§6)", () => {
  it("always renders Annexes I and II; renders III and IV for a US processor", () => {
    const doc = assembleDpa(input());
    expect(doc.annexes).toHaveLength(4);
  });

  it("hides Annexes III and IV for an EEA processor", () => {
    const doc = assembleDpa(input({ facts: { "processor-establishment": "EEA" } }));
    expect(doc.annexes).toHaveLength(2);
  });

  it("hides Annex IV when the TIA is excluded", () => {
    const doc = assembleDpa(input({ facts: { "include-tia": "no" } }));
    expect(doc.annexes).toHaveLength(3);
  });

  it("shows the expressly-excluded section of Annex I only when dataExcluded is present", () => {
    const without = assembleDpa(input());
    const withExcluded = assembleDpa(
      input({ facts: { "data-excluded": "No special-category data." } })
    );
    expect(without.annexes[0]!.body).not.toContain("EXPRESSLY EXCLUDED");
    expect(withExcluded.annexes[0]!.body).toContain("EXPRESSLY EXCLUDED");
    expect(withExcluded.annexes[0]!.body).toContain("No special-category data.");
  });

  it("composes Annex II from the baseline plus confirmed measures and the physical variant", () => {
    const baseline = assembleDpa(input());
    const confirmed = assembleDpa(
      input({ facts: { "toms-confirmed": "toms-encryption-rest,toms-testing" } })
    );
    expect(confirmed.annexes[1]!.body.length).toBeGreaterThan(
      baseline.annexes[1]!.body.length
    );
  });

  it("shows the inherited-controls section only when the post-intersection value is non-empty", () => {
    const unconfirmedOnly = assembleDpa(
      input({ facts: { "toms-inherited": "toms-backup-dr" } })
    );
    const confirmedInherited = assembleDpa(
      input({
        facts: {
          "toms-confirmed": "toms-backup-dr",
          "toms-inherited": "toms-backup-dr",
        },
      })
    );
    expect(confirmedInherited.annexes[1]!.body.length).toBeGreaterThan(
      unconfirmedOnly.annexes[1]!.body.length
    );
  });
});

describe("standalone TIA (§8)", () => {
  it("renders Annex IV alone with the identification header", () => {
    const tia = assembleStandaloneTia(input({ context: { producedDate: new Date("2026-08-09T12:00:00Z"), dealName: "CloudCo DPA" } }));
    expect(tia).not.toBeNull();
    expect(tia!.title).toBe("TRANSFER IMPACT ASSESSMENT");
    expect(tia!.header.join("\n")).toContain("Data exporter (Controller): Acme Corporation SL");
    expect(tia!.header.join("\n")).toContain("Data importer (Processor): CloudCo Inc.");
    expect(tia!.header.join("\n")).toContain('"CloudCo DPA", dated August 9, 2026');
    expect(tia!.header.join("\n")).toContain("Clause 14");
    expect(tia!.body).toContain("EDPB Recommendations 01/2020");
    expect(tia!.body).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it("returns null when Annex IV does not render (EEA processor or TIA excluded)", () => {
    expect(
      assembleStandaloneTia(input({ facts: { "processor-establishment": "EEA" } }))
    ).toBeNull();
    expect(
      assembleStandaloneTia(input({ facts: { "include-tia": "no" } }))
    ).toBeNull();
  });

  it("renders in Spanish", () => {
    const tia = assembleStandaloneTia(input({ context: { language: "es" } }));
    expect(tia!.title).toBe("EVALUACIÓN DE IMPACTO DE LA TRANSFERENCIA");
    expect(tia!.header.join("\n")).toContain("Exportador de datos (Responsable");
    expect(tia!.body).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});

describe("consistency rules (§7)", () => {
  it("flags pseudonymization claimed over directly identifying categories", () => {
    const issues = checkFactConsistency({
      ...BASE_FACTS,
      "tia-safeguards": "tech-pseudonymization",
    });
    expect(issues.map((i) => i.code)).toContain("pseudonymization-identifying-data");
  });

  it("flags EEA residency claimed for a non-EEA processor", () => {
    const issues = checkFactConsistency({
      ...BASE_FACTS,
      "tia-safeguards": "tech-eu-residency",
    });
    expect(issues.map((i) => i.code)).toContain("eu-residency-noneea-processor");
  });

  it("is silent when the facts are coherent", () => {
    expect(
      checkFactConsistency({
        ...BASE_FACTS,
        "data-categories": "usage-technical",
        "tia-safeguards": "tech-pseudonymization",
      })
    ).toEqual([]);
    expect(checkFactConsistency(BASE_FACTS)).toEqual([]);
  });
});
