// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Andorra (LQPD) and Spain (LOPDGDD): kept in the catalog for organisations
 * that applied them, but no longer offered as a choice (the EU is offered as
 * one place, so one member state's national law is not listed beside it).
 *
 *  - the catalog entries stay complete in English and Spanish, so stored
 *    links keep their deadlines, texts and reports;
 *  - neither is a place in the quick start's picker nor a question of the
 *    applicability wizard, and the catalogue lists them only to an
 *    organisation that already applied them;
 *  - applying one anew is refused; choosing places neither adds nor removes
 *    them, so an organisation that has one keeps it.
 *
 * Prisma is module-mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    jurisdiction: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { APPLICABILITY_QUESTIONS, JURISDICTION_CATALOG } from "@/config/jurisdiction-catalog";
import { APPLICABILITY_QUESTIONS_ES, JURISDICTION_CATALOG_ES } from "@/config/jurisdiction-catalog-es";
import {
  NOT_OFFERED_CODES,
  PLACE_CODES,
  bringersOf,
  isOfferedCode,
  isPlaceCode,
  placeOf,
  placeOptions,
  withImpliedLaws,
} from "@/config/jurisdiction-places";
import { dsarDeadlineRuleFor } from "@/server/services/privacy/slaCalculator";
import { regulationsRouter } from "@/server/routers/privacy/regulations";
import { callerFor, sessionFor } from "./helpers";

const entry = (code: string) => JURISDICTION_CATALOG.find((j) => j.code === code)!;

describe("Andorra (LQPD) and Spain (LOPDGDD) stay in the catalog", () => {
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
        expect(text).not.toMatch(/—/);
      }
    }
    expect(entry("LQPD")).toMatchObject({ region: "AD", effectiveDate: "2022-05-17", dpaUrl: "https://www.apda.ad" });
    expect(entry("LOPDGDD")).toMatchObject({ region: "ES", effectiveDate: "2018-12-07", dpaUrl: "https://www.aepd.es" });
  });

  it("a stored link keeps its deadline: one month, extendable by two", () => {
    for (const code of ["LQPD", "LOPDGDD"]) {
      expect(dsarDeadlineRuleFor(code, 30)).toEqual({
        deadline: { amount: 1, unit: "months" },
        extension: { amount: 2, unit: "months" },
      });
    }
  });

  it("a stored link keeps its place name, in both languages", () => {
    expect(placeOf("LOPDGDD", "es")).toMatchObject({ group: "europe", place: "España" });
    expect(placeOf("LOPDGDD", "en")).toMatchObject({ group: "europe", place: "Spain" });
    expect(placeOf("LQPD", "en")).toMatchObject({ group: "europe", place: "Andorra" });
    expect(placeOf("NOPE", "en")).toBeUndefined();
  });

  it("an organisation that has Spain applied cannot remove the GDPR on its own", () => {
    expect(bringersOf("GDPR", ["GDPR", "LOPDGDD"])).toEqual(["LOPDGDD"]);
    expect(bringersOf("GDPR", ["GDPR", "LQPD"])).toEqual([]);
  });
});

describe("they are not offered as a choice", () => {
  it("not places in the picker, in either language", () => {
    expect(NOT_OFFERED_CODES).toEqual(["LQPD", "LOPDGDD"]);
    for (const code of NOT_OFFERED_CODES) {
      expect(isOfferedCode(code)).toBe(false);
      expect(isPlaceCode(code)).toBe(false);
      expect(PLACE_CODES).not.toContain(code);
    }
    for (const locale of ["en", "es"]) {
      const codes = placeOptions(locale).map((o) => o.code);
      expect(codes).not.toContain("LQPD");
      expect(codes).not.toContain("LOPDGDD");
      expect(codes).toContain("GDPR");
    }
    // The places still offered bring no other law with them.
    expect(withImpliedLaws(PLACE_CODES)).toEqual([...PLACE_CODES]);
  });

  it("no applicability question suggests them, in either language", () => {
    for (const q of APPLICABILITY_QUESTIONS) {
      expect(q.relevantJurisdictions).not.toContain("LQPD");
      expect(q.relevantJurisdictions).not.toContain("LOPDGDD");
    }
    for (const id of ["spain_presence", "andorra_presence"]) {
      expect(APPLICABILITY_QUESTIONS.some((q) => q.id === id)).toBe(false);
      expect(APPLICABILITY_QUESTIONS_ES[id]).toBeUndefined();
    }
  });
});

describe("the regulations router", () => {
  const applied = (codes: string[]) =>
    codes.map((code, i) => ({
      id: `oj-${code}`,
      organizationId: "org-a",
      jurisdictionId: `j-${code}`,
      isPrimary: i === 0,
      jurisdiction: { id: `j-${code}`, code },
    }));

  const caller = () => {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "m-owner",
      userId: "owner",
      organizationId: "org-a",
      role: "OWNER",
      organization: { id: "org-a", name: "Org A", slug: "org-a" },
      user: { locale: null },
    });
    return callerFor(regulationsRouter, sessionFor("owner")) as ReturnType<typeof regulationsRouter.createCaller>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.jurisdiction.upsert.mockImplementation(async ({ create }: { create: { code: string } }) => ({
      id: `j-${create.code}`,
      ...create,
    }));
    mocks.prisma.organizationJurisdiction.upsert.mockResolvedValue({ id: "oj-new" });
    mocks.prisma.organizationJurisdiction.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.auditLog.create.mockResolvedValue({});
  });

  it("the catalogue lists them only to an organisation that applied them", async () => {
    mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue(applied(["GDPR"]));
    const fresh = await caller().listAvailable({ organizationId: "org-a" });
    const freshCodes = fresh.jurisdictions.map((j) => j.code);
    expect(freshCodes).toContain("GDPR");
    expect(freshCodes).not.toContain("LQPD");
    expect(freshCodes).not.toContain("LOPDGDD");

    mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue(applied(["LOPDGDD", "GDPR"]));
    const legacy = await caller().listAvailable({ organizationId: "org-a" });
    expect(legacy.jurisdictions.find((j) => j.code === "LOPDGDD")).toMatchObject({ isApplied: true });
    expect(legacy.jurisdictions.some((j) => j.code === "LQPD")).toBe(false);
  });

  it("applying one anew is refused, and nothing is written", async () => {
    for (const code of ["LQPD", "LOPDGDD"]) {
      await expect(
        caller().applyJurisdiction({ organizationId: "org-a", jurisdictionCode: code })
      ).rejects.toThrow(/not found/i);
    }
    expect(mocks.prisma.jurisdiction.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.organizationJurisdiction.upsert).not.toHaveBeenCalled();
  });

  it("choosing places keeps a stored Spain or Andorra link and never adds one", async () => {
    mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue(applied(["LOPDGDD", "GDPR", "LQPD"]));
    // A page opened before the change may still send them.
    const result = await caller().setJurisdictions({
      organizationId: "org-a",
      codes: ["GDPR", "LOPDGDD", "LQPD", "CCPA"],
    });
    expect(result).toMatchObject({ codes: ["GDPR", "CCPA"], added: 1, removed: 0 });
    expect(mocks.prisma.jurisdiction.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.jurisdiction.upsert.mock.calls[0][0].where).toEqual({ code: "CCPA" });
    expect(mocks.prisma.organizationJurisdiction.deleteMany).not.toHaveBeenCalled();
  });

  it("choosing only a not-offered place changes nothing", async () => {
    mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue(applied(["GDPR"]));
    const result = await caller().setJurisdictions({ organizationId: "org-a", codes: ["LQPD"] });
    expect(result).toEqual({ codes: [], added: 0, removed: 0 });
    expect(mocks.prisma.jurisdiction.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.organizationJurisdiction.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("choosing places with Spain stored", () => {
  it("keeps the GDPR that Spain brings, even when it is unticked", async () => {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "m-owner",
      userId: "owner",
      organizationId: "org-a",
      role: "OWNER",
      organization: { id: "org-a", name: "Org A", slug: "org-a" },
      user: { locale: null },
    });
    mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue(
      ["LOPDGDD", "GDPR", "UK-GDPR"].map((code) => ({
        id: `oj-${code}`,
        jurisdictionId: `j-${code}`,
        jurisdiction: { code },
      }))
    );
    mocks.prisma.organizationJurisdiction.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.auditLog.create.mockResolvedValue({});
    const result = await (callerFor(regulationsRouter, sessionFor("owner")) as ReturnType<
      typeof regulationsRouter.createCaller
    >).setJurisdictions({ organizationId: "org-a", codes: ["CCPA"] });
    expect(result.removed).toBe(1);
    expect(mocks.prisma.organizationJurisdiction.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", id: { in: ["oj-UK-GDPR"] } },
    });
  });
});
