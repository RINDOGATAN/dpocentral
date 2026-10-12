// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * California (CCPA) rights requests:
 * - know, delete and correct run on the organisation's deadline (45 calendar
 *   days for the CCPA alone, extendable once by 45: Civ. Code
 *   1798.130(a)(2)(A); 11 CCR 7021(b));
 * - opt-out of sale or sharing and limit of sensitive personal information
 *   run on 15 business days with no extension (11 CCR 7026(f)(1),
 *   7027(g)(1)), whatever the organisation's other laws.
 * - the help panel lists the deadline of each declared law.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  CCPA_FIFTEEN_BUSINESS_DAY_RULE,
  dsarDueDate,
  dsarExtensionState,
  dsarRuleForType,
} from "@/lib/dsar-deadline";
import { dsarDeadlineRuleFor, orgDsarRule } from "@/server/services/privacy/slaCalculator";
import { helpForPath } from "@/config/help/pages";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const CA_ONLY = [{ isPrimary: false, jurisdiction: { code: "CCPA", dsarDeadlineDays: 45 } }];

describe("CCPA clocks", () => {
  it("a California-only organisation answers know, delete and correct in 45 days, extendable by 45", () => {
    const rule = dsarRuleForType("ACCESS", orgDsarRule(CA_ONLY));
    expect(rule).toEqual({ deadline: { amount: 45, unit: "days" }, extension: { amount: 45, unit: "days" } });
    const received = new Date("2026-10-12T10:00:00Z");
    expect(dsarDueDate(received, rule).toISOString().slice(0, 10)).toBe("2026-11-26");
  });

  it("opt-out and limit run on 15 business days, with no extension", () => {
    for (const type of ["OPT_OUT_SALE_SHARING", "LIMIT_SENSITIVE_PI"]) {
      const rule = dsarRuleForType(type, orgDsarRule(CA_ONLY));
      expect(rule).toBe(CCPA_FIFTEEN_BUSINESS_DAY_RULE);
      // Monday 12 October 2026 + 15 business days = Monday 2 November.
      expect(dsarDueDate(new Date("2026-10-12T10:00:00Z"), rule).toISOString().slice(0, 10)).toBe("2026-11-02");
      const state = dsarExtensionState(
        { status: "IN_PROGRESS", receivedAt: new Date("2026-10-12"), dueDate: new Date("2026-11-02"), extendedDueDate: null },
        rule
      );
      expect(state).toEqual({ allowed: false, reason: "no_extension" });
    }
  });

  it("the GDPR rule is untouched for its own types", () => {
    const gdpr = dsarDeadlineRuleFor("GDPR");
    expect(dsarRuleForType("ACCESS", gdpr)).toBe(gdpr);
  });

  it("the router sets due dates and extensions with the type's rule", () => {
    const router = read("src/server/routers/privacy/dsar.ts");
    expect(router.match(/dsarRuleForType\(/g)?.length).toBe(4);
  });

  it("the migration only adds the two values", () => {
    const sql = read("prisma/migrations/20261012180000_dsar_ccpa_types/migration.sql");
    expect(sql).toContain(`ALTER TYPE "DSARType" ADD VALUE 'OPT_OUT_SALE_SHARING';`);
    expect(sql).toContain(`ALTER TYPE "DSARType" ADD VALUE 'LIMIT_SENSITIVE_PI';`);
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE/);
  });
});

describe("CCPA request types on the screens", () => {
  it("offers the five CCPA requests when the CCPA is declared", () => {
    const page = read("src/app/(dashboard)/privacy/dsar/new/page.tsx");
    for (const t of ["ACCESS", "ERASURE", "RECTIFICATION", "OPT_OUT_SALE_SHARING", "LIMIT_SENSITIVE_PI"]) {
      expect(page).toContain(`type: "${t}"`);
    }
    expect(page).toContain('codes.includes("CCPA")');
  });

  it("labels the new types in both languages everywhere a type is named", () => {
    for (const m of [en, es]) {
      for (const map of [m.enums.dsarType, m.pages.dsar.type, m.dsarPublic.status.typeLabels, m.pdf.dsarPerformance.dsarTypes]) {
        expect((map as Record<string, string>).OPT_OUT_SALE_SHARING).toBeTruthy();
        expect((map as Record<string, string>).LIMIT_SENSITIVE_PI).toBeTruthy();
      }
      for (const k of ["know", "delete", "correct", "optOut", "limit"] as const) {
        expect(m.ccpaRequests[k].label).toBeTruthy();
        expect(m.ccpaRequests[k].desc).toBeTruthy();
      }
    }
  });

  it("the Spanish uses the GDPR's wording and no long dash", () => {
    const text = JSON.stringify(es.ccpaRequests) + JSON.stringify(es.help.deadlines);
    expect(text).not.toContain("—");
    expect(es.docs.regulations.impact.stats.breach.subtitle).toContain("sin dilación indebida");
  });
});

describe("help: the deadline of each declared law", () => {
  it("rights requests' help lists the declared laws' deadlines, not the GDPR alone", () => {
    const help = helpForPath("/privacy/dsar/new");
    expect(help?.deadlines).toBe("dsar");
    expect(help?.purpose.en).not.toContain("Under the GDPR you have one month");
  });
});
