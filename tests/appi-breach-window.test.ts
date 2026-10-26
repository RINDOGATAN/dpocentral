// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The APPI sets no hour count for breach reports (PPC leakage page: a
 * preliminary report within 3 to 5 days, a final one within 30 or 60 days), so
 * no 72-hour window may be computed or shown for it, and a law with no fixed
 * hour count reads as such instead of "0h".
 */

import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { JURISDICTION_CORE_DATA } from "@/config/jurisdiction-data";
import { JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { calculateBreachNotificationDeadline } from "@/server/services/privacy/slaCalculator";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

describe("APPI breach window", () => {
  it("has no fixed hour count in the core data and the catalog", () => {
    expect(JURISDICTION_CORE_DATA.find((j) => j.code === "APPI")?.breachNotificationHours).toBe(0);
    expect(JURISDICTION_CATALOG.find((j) => j.code === "APPI")?.breachNotificationHours).toBe(0);
  });

  it("computes no hour deadline for it", () => {
    expect(calculateBreachNotificationDeadline(new Date("2026-10-26T00:00:00Z"), "APPI")).toBeNull();
  });
});

describe("a law with no fixed hour count", () => {
  const find = (o: unknown, key: string): string[] => {
    const out: string[] = [];
    const walk = (v: unknown) => {
      if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (k === key && typeof x === "string" ? out.push(x) : walk(x));
    };
    walk(o);
    return out;
  };

  it("reads as such in English and Spanish, never as 0h", () => {
    for (const [msgs, locale, word] of [[en, "en", "no fixed hour limit"], [es, "es", "sin plazo fijo en horas"]] as const) {
      for (const key of ["breachShort", "jurisdictionWindow"]) {
        for (const text of find(msgs, key)) {
          const zero = new IntlMessageFormat(text, locale).format({ hours: 0, name: "APPI" }) as string;
          expect(zero).toContain(word);
          expect(zero).not.toMatch(/0\s?h/);
          const many = new IntlMessageFormat(text, locale).format({ hours: 72, name: "GDPR" }) as string;
          expect(many).toMatch(/72\s?h/);
        }
      }
    }
  });
});
