// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Step 5's breach-readiness confirmation: the per-law deadlines (only
 * verified ones stated, neutral wording otherwise, in both languages), the
 * record kept in the settings, the step rule and the board report row.
 */
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { readinessLaws, sameLaws, VERIFIED_BREACH_DEADLINES } from "@/config/breach-readiness";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS, type PathCounts } from "@/components/guided/path-config";
import { evaluatePath } from "@/components/guided/path";
import {
  BREACH_READINESS_ACTION,
  confirmBreachReadiness,
  isReadinessCurrent,
  readBreachReadiness,
} from "@/server/services/program/breach-readiness";

const status = (over: Partial<PathCounts>) => evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, ...over }).incidents;

describe("the deadlines shown per declared law", () => {
  it("states the GDPR's 72 hours and Art. 34 in English and Spanish", () => {
    const [enLaw] = readinessLaws(["GDPR"], "en");
    const [esLaw] = readinessLaws(["GDPR"], "es");
    expect(enLaw.verified).toBe(true);
    expect(enLaw.authority).toContain("72 hours");
    expect(enLaw.individuals).toContain("Art. 34");
    expect(esLaw.authority).toContain("72 horas");
    expect(esLaw.individuals).toContain("art. 34");
  });

  it("gives every verified entry a source with the date it was read", () => {
    for (const [code, entry] of Object.entries(VERIFIED_BREACH_DEADLINES)) {
      expect(entry.source, code).toMatch(/^https:\/\/\S+ \(read \d{1,2} \w+ 20\d\d\)$/);
    }
  });

  it("never states a figure for a law it has not verified", () => {
    const [ca] = readinessLaws(["CCPA"], "en");
    expect(ca.verified).toBe(false);
    expect(ca.authority).toMatch(/^Check the deadline/);
    expect(ca.authority).toContain("separate breach notification law");
    expect(ca.authority).not.toMatch(/\d+ (days|hours)/);
    const [br] = readinessLaws(["LGPD"], "es");
    expect(br.verified).toBe(false);
    expect(br.authority).toMatch(/^Comprueba el plazo/);
  });

  it("states the APPI's two reports as the PPC sets them, with no hour count", () => {
    const [jp] = readinessLaws(["APPI"], "en");
    expect(jp.verified).toBe(true);
    expect(jp.authority).toContain("3 to 5 days");
    expect(jp.authority).toContain("30 days");
    expect(jp.authority).toContain("60 days");
    expect(jp.authority).not.toMatch(/72/);
    const [jpEs] = readinessLaws(["APPI"], "es");
    expect(jpEs.authority).toContain("3 a 5 días");
  });

  it("leaves out the AI Act and unknown codes, and repeats nothing", () => {
    const laws = readinessLaws(["GDPR", "EU_AI_ACT", "NOPE", "GDPR"], "en");
    expect(laws.map((l) => l.code)).toEqual(["GDPR"]);
  });

  it("names the authority in the reader's language", () => {
    const [esLaw] = readinessLaws(["LOPDGDD"], "es");
    expect(esLaw.authority).toContain("AEPD");
  });

  it("compares law sets regardless of order", () => {
    expect(sameLaws(["GDPR", "CCPA"], ["CCPA", "GDPR"])).toBe(true);
    expect(sameLaws(["GDPR"], ["GDPR", "UK-GDPR"])).toBe(false);
    expect(sameLaws(["GDPR", "EU_AI_ACT"], ["GDPR"])).toBe(true);
  });

  it("uses no long dashes in either language", () => {
    for (const code of Object.keys(VERIFIED_BREACH_DEADLINES)) {
      for (const loc of ["en", "es"] as const) {
        const [law] = readinessLaws([code], loc);
        expect(`${law.authority} ${law.individuals}`).not.toMatch(/[—–]/);
      }
    }
    expect(JSON.stringify(en.breachReadiness) + JSON.stringify(es.breachReadiness)).not.toMatch(/[—–]/);
  });
});

describe("the record and the step", () => {
  const record = { breachReadiness: { confirmedAt: "2026-10-26T08:00:00.000Z", confirmedBy: "u1", laws: ["GDPR"], contact: "dpo@x" } };

  it("reads a confirmation and ignores a malformed one", () => {
    expect(readBreachReadiness(record)?.laws).toEqual(["GDPR"]);
    expect(readBreachReadiness({ breachReadiness: { confirmedAt: "x" } })).toBeNull();
    expect(readBreachReadiness(null)).toBeNull();
  });

  it("counts only for the laws declared now", () => {
    const r = readBreachReadiness(record);
    expect(isReadinessCurrent(r, ["GDPR"])).toBe(true);
    expect(isReadinessCurrent(r, ["GDPR", "LOPDGDD"])).toBe(false);
    expect(isReadinessCurrent(null, ["GDPR"])).toBe(false);
  });

  it("stays ready until confirmed, and is done once confirmed or after an incident", () => {
    expect(status({ processingActivitiesComplete: 1 })).toBe("ready");
    expect(status({ processingActivitiesComplete: 1, breachReadinessConfirmed: true })).toBe("done");
    expect(status({ breachReadinessConfirmed: true })).toBe("done");
    expect(status({ incidents: 1 })).toBe("done");
    expect(status({})).toBe("todo");
  });

  it("saves the declared laws with the confirmation and writes the activity log", async () => {
    const update = vi.fn();
    const create = vi.fn();
    const db = {
      organizationJurisdiction: {
        findMany: vi.fn().mockResolvedValue([
          { isPrimary: false, jurisdiction: { code: "LOPDGDD" } },
          { isPrimary: true, jurisdiction: { code: "GDPR" } },
        ]),
      },
      organization: { findFirst: vi.fn().mockResolvedValue({ settings: { keep: 1 } }), update },
      auditLog: { create },
    };
    const saved = await confirmBreachReadiness(db as never, {
      organizationId: "o1",
      userId: "u1",
      contact: "  dpo@example.com ",
      now: new Date("2026-10-26T09:00:00Z"),
    });
    expect(saved.laws).toEqual(["GDPR", "LOPDGDD"]);
    expect(saved.contact).toBe("dpo@example.com");
    expect(saved.authority).toBeNull();
    const data = update.mock.calls[0][0].data.settings;
    expect(data.keep).toBe(1);
    expect(data.breachReadiness.confirmedAt).toBe("2026-10-26T09:00:00.000Z");
    expect(create.mock.calls[0][0].data.action).toBe(BREACH_READINESS_ACTION);
    expect(JSON.stringify(create.mock.calls[0][0].data.changes)).not.toContain("dpo@example.com");
  });
});

describe("the texts", () => {
  it("has every card key in both languages", () => {
    expect(Object.keys(es.breachReadiness).sort()).toEqual(Object.keys(en.breachReadiness).sort());
  });
});
