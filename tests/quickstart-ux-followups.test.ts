// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Quick start follow-ups:
 * - vendors picked in the quick start are recorded as active, with the risk
 *   the preview showed; a re-run skips a vendor already recorded (by name)
 *   and never changes it;
 * - adding a vendor from the search clears the search box;
 * - the data map has a key for its chips;
 * - the result screen counts the DPIA drafts and transfers it made;
 * - fewer notices after the build; plain words on the catalogue card.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

let seq = 0;
const made = (prefix: string) => async ({ data }: { data: Record<string, unknown> }) => ({
  id: `${prefix}-${++seq}`,
  ...data,
});

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendor: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendorCatalog: { findMany: vi.fn() },
    dataAsset: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    dataElement: { createMany: vi.fn() },
    processingActivity: { findMany: vi.fn(), create: vi.fn() },
    processingActivityAsset: { create: vi.fn() },
    dataFlow: { create: vi.fn(), findMany: vi.fn() },
    dataTransfer: { createMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    businessUnitMember: { findMany: vi.fn().mockResolvedValue([]) },
    aISystem: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  createAssessment: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/assessment-auto-create", () => ({
  createAssessmentFromActivity: mocks.createAssessment,
}));
vi.mock("@/server/services/licensing/entitlement", () => ({
  hasVendorCatalogAccess: vi.fn().mockResolvedValue(true),
}));

import { quickstartRouter } from "@/server/routers/privacy/quickstart";
import { VENDOR_DATA_MAPPINGS } from "@/config/vendor-data-mappings";
import { pickVendor } from "@/lib/quickstart-vendor-pick";
import { legendCategories, chipSensitivity } from "@/components/privacy/data-flow/flow-palette";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };

const mappings = Object.values(VENDOR_DATA_MAPPINGS);
const HIGH = mappings.find((m) => m.isHighRisk)!;
const LOW = mappings.find((m) => !m.isHighRisk)!;

function catalogVendor(slug: string, name: string, category: string) {
  return {
    slug,
    name,
    category,
    subcategory: null,
    description: `${name} description`,
    website: `https://${slug}.example.com`,
    dataLocations: [],
    certifications: [],
    privacyTechnologies: [],
    aiCapabilities: [],
    aiTechniques: [],
    euAiActRole: null,
    euAiActCompliant: null,
    iso42001Certified: null,
    aiModels: null,
    euAiActAnnexIIIDomains: [],
    tags: [],
  };
}

const RISKY = catalogVendor("risky", "Risky Vendor", HIGH.catalogCategories[0]!);
const PLAIN = catalogVendor("plain", "Plain Vendor", LOW.catalogCategories[0]!);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
  seq = 0;
  const p = mocks.prisma;
  p.organizationMember.findUnique.mockResolvedValue({
    id: "m-1",
    userId: "user-1",
    organizationId: ORG.id,
    role: "OWNER",
    organization: ORG,
  });
  p.vendor.findMany.mockResolvedValue([]);
  p.vendor.create.mockImplementation(made("vendor"));
  p.vendorCatalog.findMany.mockResolvedValue([RISKY, PLAIN]);
  p.dataAsset.findMany.mockResolvedValue([]);
  p.dataAsset.findFirst.mockResolvedValue(null);
  p.processingActivity.findMany.mockResolvedValue([]);
  p.dataAsset.create.mockImplementation(made("asset"));
  p.processingActivity.create.mockImplementation(made("activity"));
  p.dataFlow.create.mockImplementation(made("flow"));
  p.dataFlow.findMany.mockResolvedValue([]);
  p.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(p));
  mocks.createAssessment.mockResolvedValue({ created: true });
});

describe("quickstart.execute: vendors the person picked", () => {
  it("records them as active, with the risk the preview showed", async () => {
    const result = await callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      vendorSlugs: [RISKY.slug, PLAIN.slug],
    });
    expect(result.vendors).toBe(2);
    const byName = new Map(
      mocks.prisma.vendor.create.mock.calls.map((c) => [c[0].data.name, c[0].data] as const),
    );
    expect(byName.get(RISKY.name)).toMatchObject({ status: "ACTIVE", riskTier: "HIGH" });
    expect(byName.get(PLAIN.name)).toMatchObject({ status: "ACTIVE", riskTier: null });
    // The high-risk vendor also gets its DPIA draft, and the result counts it.
    expect(result.assessments).toBe(1);
  });

  it("skips a vendor already recorded by name and leaves it as it is", async () => {
    mocks.prisma.vendor.findMany.mockResolvedValue([{ name: RISKY.name }]);
    const result = await callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      vendorSlugs: [RISKY.slug, PLAIN.slug],
    });
    expect(result.vendors).toBe(1);
    const names = mocks.prisma.vendor.create.mock.calls.map((c) => c[0].data.name);
    expect(names).toEqual([PLAIN.name]);
    expect(mocks.prisma.vendor.update).not.toHaveBeenCalled();
    expect(mocks.prisma.vendor.updateMany).not.toHaveBeenCalled();
  });
});

describe("the vendor search", () => {
  it("clears the box after a vendor is added", () => {
    expect(pickVendor([], "a")).toEqual({ selected: ["a"], clearSearch: true });
    expect(pickVendor(["a"], "b")).toEqual({ selected: ["a", "b"], clearSearch: true });
  });

  it("keeps the search when a chosen vendor is clicked again (removed)", () => {
    expect(pickVendor(["a", "b"], "a")).toEqual({ selected: ["b"], clearSearch: false });
  });

  it("is wired into the quick start page", () => {
    const page = readFileSync(
      path.resolve(__dirname, "../src/app/(dashboard)/privacy/quickstart/page.tsx"),
      "utf8",
    );
    expect(page).toContain("pickVendor(selectedSlugs, slug)");
    expect(page).toMatch(/if \(next\.clearSearch\) \{[\s\S]*?setVendorSearch\(""\)/);
  });
});

describe("the data map key", () => {
  it("lists the categories the map shows, once each, in the enum order", () => {
    const flows = [
      { dataCategories: ["FINANCIAL", "IDENTIFIERS"] },
      { dataCategories: ["IDENTIFIERS", "HEALTH"] },
      { dataCategories: null },
    ];
    expect(legendCategories(flows)).toEqual(["IDENTIFIERS", "FINANCIAL", "HEALTH"]);
  });

  it("colours a chip as the node does", () => {
    expect(chipSensitivity("HEALTH")).toBe("special");
    expect(chipSensitivity("IDENTIFIERS")).toBe("sensitive");
    expect(chipSensitivity("BEHAVIORAL")).toBe("general");
  });

  it("has its words in both languages", () => {
    for (const bundle of [en, es]) {
      const l = bundle.dataFlow.legend;
      expect(l.title && l.inbound && l.outbound).toBeTruthy();
    }
  });
});

describe("the result screen and the notices", () => {
  const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
  const quickstart = read("src/app/(dashboard)/privacy/quickstart/page.tsx");
  const vendors = read("src/app/(dashboard)/privacy/vendors/page.tsx");

  it("counts the DPIA drafts and transfers made, linked to their lists", () => {
    expect(quickstart).toContain('href: "/privacy/assessments"');
    expect(quickstart).toContain('href: "/privacy/transfers"');
    for (const bundle of [en, es]) {
      const s = bundle.pages.quickstart.success;
      expect(s.createdAssessments).toContain("plural");
      expect(s.createdTransfers).toContain("plural");
      expect(s.createdListAlso).toBeTruthy();
    }
  });

  it("offers no expert-help card in the quick start, nor on an empty vendors list", () => {
    expect(quickstart).not.toMatch(/ExpertHelpCta|DeploymentExpertCta/);
    expect(vendors).toContain('{stats.total > 0 && <ExpertHelpCta context="vendor" />}');
  });

  it("describes the catalogue card in plain words, without a status badge", () => {
    expect(vendors).not.toContain('t("catalog.active")');
    for (const bundle of [en, es]) {
      const c = bundle.pages.vendors.catalog as Record<string, string>;
      expect(c.active).toBeUndefined();
      expect(c.subtitle).not.toMatch(/MarTech/);
    }
  });
});
