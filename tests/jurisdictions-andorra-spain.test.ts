// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { APPLICABILITY_QUESTIONS, JURISDICTION_CATALOG, getApplicableJurisdictions } from "@/config/jurisdiction-catalog";
import { JURISDICTION_CATALOG_ES } from "@/config/jurisdiction-catalog-es";
import { bringersOf, impliedBy, isPlaceCode, placeOptions, withImpliedLaws } from "@/config/jurisdiction-places";

const entry = (code: string) => JURISDICTION_CATALOG.find((j) => j.code === code)!;

describe("Andorra (LQPD) and Spain (LOPDGDD) in the catalog", () => {
  it("both entries exist in English and Spanish with every text field", () => {
    for (const code of ["LQPD", "LOPDGDD"]) {
      const en = entry(code);
      const es = JURISDICTION_CATALOG_ES[code];
      expect(en.category).toBe("comprehensive");
      expect(en.breachNotificationHours).toBe(72);
      expect(en.keyRequirements.length).toBe(5);
      expect(es.keyRequirements.length).toBe(en.keyRequirements.length);
      expect(es.applicabilityCriteria.length).toBe(en.applicabilityCriteria.length);
      for (const text of [en.description, en.penalties, es.description, es.penalties, es.regionLabel]) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\u2014/);
      }
    }
    expect(entry("LQPD")).toMatchObject({ region: "AD", effectiveDate: "2022-05-17", dpaUrl: "https://www.apda.ad" });
    expect(entry("LOPDGDD")).toMatchObject({ region: "ES", effectiveDate: "2018-12-07", dpaUrl: "https://www.aepd.es" });
  });

  it("both are places in the Europe group, in both languages", () => {
    expect(isPlaceCode("LQPD")).toBe(true);
    expect(isPlaceCode("LOPDGDD")).toBe(true);
    const es = placeOptions("es");
    const en = placeOptions("en");
    expect(es.find((o) => o.code === "LQPD")).toMatchObject({ group: "europe", place: "Andorra" });
    expect(es.find((o) => o.code === "LOPDGDD")).toMatchObject({ group: "europe", place: "España" });
    expect(en.find((o) => o.code === "LOPDGDD")).toMatchObject({ group: "europe", place: "Spain" });
  });

  it("choosing Spain also applies the GDPR; Andorra brings nothing else", () => {
    expect(withImpliedLaws(["LOPDGDD"])).toEqual(["LOPDGDD", "GDPR"]);
    expect(withImpliedLaws(["GDPR", "LOPDGDD"])).toEqual(["GDPR", "LOPDGDD"]);
    expect(withImpliedLaws(["LQPD"])).toEqual(["LQPD"]);
    expect(impliedBy(["LOPDGDD", "GDPR"])).toEqual(["GDPR"]);
    expect(impliedBy(["GDPR"])).toEqual([]);
  });

  it("the GDPR cannot be removed on its own while Spain is applied; Spain can", () => {
    expect(bringersOf("GDPR", ["GDPR", "LOPDGDD"])).toEqual(["LOPDGDD"]);
    expect(bringersOf("GDPR", ["GDPR", "LQPD"])).toEqual([]);
    expect(bringersOf("LOPDGDD", ["GDPR", "LOPDGDD"])).toEqual([]);
  });

  it("the applicability wizard can suggest each of them", () => {
    const suggests = (code: string) =>
      APPLICABILITY_QUESTIONS.filter((q) => q.relevantJurisdictions.includes(code)).map((q) => q.id);
    expect(suggests("LQPD")).toEqual(["andorra_presence"]);
    expect(suggests("LOPDGDD")).toEqual(["spain_presence"]);
    expect(getApplicableJurisdictions({ andorra_presence: true }).map((j) => j.code)).toEqual(["LQPD"]);
  });
});
