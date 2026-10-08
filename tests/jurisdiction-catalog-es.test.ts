// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The regulations catalog and the applicability wizard read in Spanish
 * through src/config/jurisdiction-catalog-es.ts. Every jurisdiction and every
 * question has a Spanish entry of the same shape, the lookup keeps codes and
 * numbers untouched, and English stays exactly as the catalog says.
 */

import { describe, it, expect } from "vitest";
import {
  APPLICABILITY_QUESTIONS,
  JURISDICTION_CATALOG,
  jurisdictionSearchText,
  localizeJurisdiction,
  localizeQuestion,
} from "@/config/jurisdiction-catalog";
import { APPLICABILITY_QUESTIONS_ES, JURISDICTION_CATALOG_ES } from "@/config/jurisdiction-catalog-es";

describe("jurisdiction catalog in Spanish", () => {
  it("has a Spanish entry for every jurisdiction, with the same number of items", () => {
    const bad = JURISDICTION_CATALOG.filter((j) => {
      const es = JURISDICTION_CATALOG_ES[j.code];
      return (
        !es ||
        es.keyRequirements.length !== j.keyRequirements.length ||
        es.applicabilityCriteria.length !== j.applicabilityCriteria.length ||
        !es.description ||
        !es.penalties ||
        !es.regionLabel
      );
    });
    expect(bad.map((j) => j.code)).toEqual([]);
    const known = new Set(JURISDICTION_CATALOG.map((j) => j.code));
    expect(Object.keys(JURISDICTION_CATALOG_ES).filter((c) => !known.has(c))).toEqual([]);
  });

  it("has a Spanish entry for every wizard question", () => {
    expect(APPLICABILITY_QUESTIONS.filter((q) => !APPLICABILITY_QUESTIONS_ES[q.id]).map((q) => q.id)).toEqual([]);
  });

  it("uses the official Spanish names of the EU laws", () => {
    const gdpr = localizeJurisdiction(JURISDICTION_CATALOG.find((j) => j.code === "GDPR")!, "es");
    expect(gdpr.name).toBe("Reglamento General de Protección de Datos (RGPD)");
    expect(gdpr.shortName).toBe("RGPD");
    const ccpa = localizeJurisdiction(JURISDICTION_CATALOG.find((j) => j.code === "CCPA")!, "es");
    expect(ccpa.name).toBe("California Consumer Privacy Act (as amended by CPRA)");
    expect(ccpa.regionLabel).toBe("EE. UU. (California)");
  });

  it("keeps codes, regions and numbers, and leaves English untouched", () => {
    for (const j of JURISDICTION_CATALOG) {
      const es = localizeJurisdiction(j, "es");
      expect([es.code, es.region, es.dsarDeadlineDays, es.breachNotificationHours, es.category]).toEqual([
        j.code,
        j.region,
        j.dsarDeadlineDays,
        j.breachNotificationHours,
        j.category,
      ]);
      expect(localizeJurisdiction(j, "en")).toEqual({ ...j, regionLabel: j.region });
    }
    for (const q of APPLICABILITY_QUESTIONS) {
      expect(localizeQuestion(q, "en")).toEqual(q);
      expect(localizeQuestion(q, "es").relevantJurisdictions).toEqual(q.relevantJurisdictions);
    }
  });

  it("addresses the reader as tú and carries no long dash", () => {
    const texts = [
      ...Object.values(APPLICABILITY_QUESTIONS_ES).flatMap((q) => [q.question, q.helpText]),
      ...Object.values(JURISDICTION_CATALOG_ES).flatMap((j) => [
        j.description,
        j.penalties,
        ...j.keyRequirements,
        ...j.applicabilityCriteria,
      ]),
    ];
    expect(texts.filter((t) => /\busted(es)?\b|—/i.test(t))).toEqual([]);
  });

  it("finds a jurisdiction by its Spanish name", () => {
    const hits = JURISDICTION_CATALOG.filter((j) => jurisdictionSearchText(j).includes("rgpd")).map((j) => j.code);
    expect(hits).toContain("GDPR");
    expect(JURISDICTION_CATALOG.filter((j) => jurisdictionSearchText(j).includes("brasil")).map((j) => j.code)).toEqual(["LGPD"]);
  });
});
