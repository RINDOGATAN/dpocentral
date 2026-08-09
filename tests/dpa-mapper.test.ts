// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// The fact mapper proposes DPA facts from the vendor register and enforces
// the pack's §7 honesty rules: no TOMs from certifications, establishment
// only when unambiguous, declarations never fabricated.

import { describe, it, expect } from "vitest";
import { mapVendorToDpaInputs, type MapperInput } from "@/lib/dpa-engine/mapper";

function baseInput(overrides: Partial<MapperInput["vendor"]> = {}): MapperInput {
  return {
    vendor: {
      name: "CloudCo Inc.",
      dataProcessed: [],
      countries: [],
      certifications: [],
      ...overrides,
    },
  };
}

describe("data-category mapping (§9 table)", () => {
  it("maps enum categories to canonical keys without duplicates", () => {
    const { facts } = mapVendorToDpaInputs(
      baseInput({
        dataProcessed: ["IDENTIFIERS", "FINANCIAL", "LOCATION", "BEHAVIORAL", "EMPLOYMENT"],
      })
    );
    expect(facts["data-categories"]).toBe(
      "contact-details,identification-data,financial-data,location-data,usage-technical,professional-data"
    );
  });

  it("collapses all sensitive categories into special-category once", () => {
    const { facts } = mapVendorToDpaInputs(
      baseInput({ dataProcessed: ["HEALTH", "BIOMETRIC", "GENETIC", "CRIMINAL"] })
    );
    expect(facts["data-categories"]).toBe("special-category");
  });

  it("routes non-canonical categories into free-text other, skipping OTHER", () => {
    const { facts } = mapVendorToDpaInputs(
      baseInput({ dataProcessed: ["DEMOGRAPHICS", "EDUCATION", "OTHER"] })
    );
    expect(facts["data-categories"]).toBe("");
    expect(facts["data-categories-other"]).toBe("Demographic data; Education data");
  });
});

describe("establishment inference (§7.4)", () => {
  it("prefers an explicit establishment field over countries", () => {
    const { facts } = mapVendorToDpaInputs(
      baseInput({ countries: ["US"], metadata: { establishment: "EEA" } })
    );
    expect(facts["processor-establishment"]).toBe("EEA");
  });

  it("infers only when every country maps to one region", () => {
    expect(
      mapVendorToDpaInputs(baseInput({ countries: ["Germany", "France", "ES"] })).facts[
        "processor-establishment"
      ]
    ).toBe("EEA");
    expect(
      mapVendorToDpaInputs(baseInput({ countries: ["United States", "USA"] })).facts[
        "processor-establishment"
      ]
    ).toBe("US");
  });

  it("leaves establishment blank when countries span regions", () => {
    const { facts, notes } = mapVendorToDpaInputs(
      baseInput({ countries: ["US", "Germany"] })
    );
    expect(facts["processor-establishment"]).toBeUndefined();
    expect(notes.some((n) => n.en.includes("Establishment left blank"))).toBe(true);
    // Locale parity: every note ships in both languages.
    expect(notes.every((n) => n.en.trim() && n.es.trim())).toBe(true);
  });

  it("treats unknown countries as OTHER", () => {
    expect(
      mapVendorToDpaInputs(baseInput({ countries: ["India"] })).facts[
        "processor-establishment"
      ]
    ).toBe("OTHER");
  });
});

describe("evidence gating (§7.3)", () => {
  it("maps certifications to the audits-review safeguard, never to TOMs", () => {
    const { facts } = mapVendorToDpaInputs(
      baseInput({ certifications: ["ISO 27001", "SOC 2 Type II"] })
    );
    expect(facts["tia-safeguards"]).toBe("org-audits-review");
    expect(facts["toms-confirmed"]).toBeUndefined();
    expect(facts["toms-inherited"]).toBeUndefined();
  });

  it("selects the matching security-measures clause option", () => {
    expect(
      mapVendorToDpaInputs(baseInput({ certifications: ["ISO 27001"] })).selections[
        "security-measures"
      ]
    ).toBe("security-iso27001");
    expect(
      mapVendorToDpaInputs(baseInput({ certifications: ["SOC 2"] })).selections[
        "security-measures"
      ]
    ).toBe("security-soc2");
    expect(
      mapVendorToDpaInputs(baseInput()).selections["security-measures"]
    ).toBe("security-annex");
  });
});

describe("declarations (§7.5)", () => {
  it("never fabricates importer declarations without a questionnaire answer", () => {
    const { facts } = mapVendorToDpaInputs(baseInput());
    expect(facts["tia-breach-history"]).toBeUndefined();
    expect(facts["tia-gov-requests-received"]).toBeUndefined();
    expect(facts["processor-dpf-certified"]).toBeUndefined();
  });

  it("never auto-classifies breach history — surfaces the raw answer for review", () => {
    // The two seeded questionnaires give ir4 different meanings (breach
    // history textarea vs incident-drills boolean), so classifying it would
    // fabricate a representation.
    const withHistory = mapVendorToDpaInputs({
      ...baseInput(),
      questionnaireResponses: [
        {
          status: "SUBMITTED",
          submittedAt: new Date("2026-06-01"),
          responses: { ir4: "One incident in 2024, contained and notified." },
        },
      ],
    });
    expect(withHistory.facts["tia-breach-history"]).toBeUndefined();
    expect(
      withHistory.notes.some((n) => n.en.includes("One incident in 2024"))
    ).toBe(true);

    // A boolean ir4 (the other questionnaire's drills question) is ignored.
    const booleanAnswer = mapVendorToDpaInputs({
      ...baseInput(),
      questionnaireResponses: [
        { status: "APPROVED", submittedAt: new Date(), responses: { ir4: true } },
      ],
    });
    expect(booleanAnswer.facts["tia-breach-history"]).toBeUndefined();
    expect(booleanAnswer.notes.some((n) => n.en.includes("incident-related"))).toBe(false);
  });

  it("ignores unsubmitted questionnaire drafts", () => {
    const { facts, notes } = mapVendorToDpaInputs({
      ...baseInput(),
      questionnaireResponses: [
        { status: "IN_PROGRESS", responses: { ir4: "Yes, several." } },
      ],
    });
    expect(facts["tia-breach-history"]).toBeUndefined();
    expect(notes.some((n) => n.en.includes("incident-related"))).toBe(false);
  });

  it("maps the breach-notification window and DPF mechanism answers", () => {
    const mapped = mapVendorToDpaInputs({
      ...baseInput(),
      questionnaireResponses: [
        {
          status: "SUBMITTED",
          submittedAt: new Date(),
          responses: {
            ir2: "Within 48 hours",
            dt3: ["Standard Contractual Clauses (SCCs)", "EU-US Data Privacy Framework"],
          },
        },
      ],
    });
    expect(mapped.selections["breach-notification"]).toBe("breach-48h");
    expect(mapped.facts["processor-dpf-certified"]).toBe("yes");
  });
});

describe("purpose and selections", () => {
  it("draws the processing purpose from activities naming the vendor as recipient", () => {
    const { facts, notes } = mapVendorToDpaInputs({
      ...baseInput(),
      processingActivities: [
        {
          name: "Product analytics",
          purpose: "Usage analytics for product improvement.",
          recipients: ["CloudCo"],
        },
        {
          name: "Payroll",
          purpose: "Salary processing.",
          recipients: ["PayrollCo"],
        },
      ],
    });
    expect(facts["processing-purpose"]).toBe("Usage analytics for product improvement.");
    expect(notes.some((n) => n.en.includes("Product analytics"))).toBe(true);
  });

  it("does not link activities via short free-text recipient fragments", () => {
    const { facts } = mapVendorToDpaInputs({
      ...baseInput({ name: "Fitbit" }),
      processingActivities: [
        {
          name: "Corporate IT",
          purpose: "Internal IT support.",
          recipients: ["IT"],
        },
      ],
    });
    expect(facts["processing-purpose"]).toBeUndefined();
  });

  it("selects transfer and government-access clauses by establishment", () => {
    const us = mapVendorToDpaInputs(baseInput({ countries: ["US"] }));
    expect(us.selections["data-transfer"]).toBe("transfer-sccs");
    expect(us.selections["government-access-requests"]).toBe("gov-access-full");

    const eea = mapVendorToDpaInputs(baseInput({ countries: ["Ireland"] }));
    expect(eea.selections["data-transfer"]).toBe("transfer-adequacy-sccs");
    expect(eea.selections["government-access-requests"]).toBe("gov-access-none");
  });

  it("derives governing law from the org's jurisdiction regions", () => {
    expect(mapVendorToDpaInputs(baseInput()).governingLaw).toBe("SPAIN");
    expect(
      mapVendorToDpaInputs({ ...baseInput(), organizationJurisdictionRegions: ["UK"] })
        .governingLaw
    ).toBe("ENGLAND_WALES");
    const us = mapVendorToDpaInputs({
      ...baseInput(),
      organizationJurisdictionRegions: ["US-CA"],
    });
    expect(us.governingLaw).toBe("CALIFORNIA");
    expect(us.selections["governing-law-jurisdiction"]).toBe("glj-us-courts");
  });

  it("honours the primary-first ordering of jurisdiction regions", () => {
    // Primary California with a secondary UK office → California, not UK.
    expect(
      mapVendorToDpaInputs({
        ...baseInput(),
        organizationJurisdictionRegions: ["US-CA", "UK"],
      }).governingLaw
    ).toBe("CALIFORNIA");
    // Primary EU keeps the Spanish default even with a later US entry.
    expect(
      mapVendorToDpaInputs({
        ...baseInput(),
        organizationJurisdictionRegions: ["EU", "US-CA"],
      }).governingLaw
    ).toBe("SPAIN");
  });
});
