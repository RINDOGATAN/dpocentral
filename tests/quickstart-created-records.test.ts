// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The quick start's result screen names every record it made (F4 of the
 * September browser round): quickstart.execute returns the created assets,
 * activities and flows with their ids, and the result screen links each one
 * to its own page, never to a search filter.
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
    vendor: { findMany: vi.fn(), create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    vendorCatalog: { findMany: vi.fn() },
    dataAsset: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    dataElement: { createMany: vi.fn() },
    processingActivity: { findMany: vi.fn(), create: vi.fn() },
    processingActivityAsset: { create: vi.fn() },
    dataFlow: { create: vi.fn() },
    dataTransfer: { createMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    businessUnitMember: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { quickstartRouter } from "@/server/routers/privacy/quickstart";
import { INDUSTRY_TEMPLATES } from "@/config/industry-templates";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org", pilotStartedAt: null };
const TEMPLATE = INDUSTRY_TEMPLATES[0];

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
  p.vendorCatalog.findMany.mockResolvedValue([]);
  p.dataAsset.findMany.mockResolvedValue([]);
  p.dataAsset.findFirst.mockResolvedValue(null);
  p.processingActivity.findMany.mockResolvedValue([]);
  p.dataAsset.create.mockImplementation(made("asset"));
  p.processingActivity.create.mockImplementation(made("activity"));
  p.dataFlow.create.mockImplementation(made("flow"));
  p.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(p));
});

describe("quickstart.execute", () => {
  it("returns every record it made, with its id", async () => {
    const result = await callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      industryId: TEMPLATE.id,
    });

    expect(result.created.assets.map((a) => a.name)).toEqual(TEMPLATE.assets.map((a) => a.name));
    expect(result.created.activities.map((a) => a.name)).toEqual(TEMPLATE.activities.map((a) => a.name));
    expect(result.created.assets.every((a) => a.id.startsWith("asset-"))).toBe(true);
    expect(result.created.activities.every((a) => a.id.startsWith("activity-"))).toBe(true);

    // The lists and the counts agree.
    expect(result.created.assets).toHaveLength(result.assets);
    expect(result.created.activities).toHaveLength(result.activities);
    expect(result.created.flows).toHaveLength(result.flows);
    expect(result.flows).toBeGreaterThan(0);

    // A flow carries the asset it starts from, one of the assets just made.
    const assetIds = new Set(result.created.assets.map((a) => a.id));
    for (const f of result.created.flows) expect(assetIds.has(f.sourceAssetId)).toBe(true);
  });
});

describe("quickstart.execute records its completion (clarity review F1)", () => {
  it("writes settings.quickstart.completedAt, keeping every other setting", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue({
      settings: { locale: "es", quickstart: { note: "kept" } },
    });
    await callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      industryId: TEMPLATE.id,
    });

    expect(mocks.prisma.organization.update).toHaveBeenCalledTimes(1);
    const { where, data } = mocks.prisma.organization.update.mock.calls[0][0];
    expect(where).toEqual({ id: ORG.id });
    expect(data.settings.locale).toBe("es");
    expect(data.settings.quickstart.note).toBe("kept");
    expect(typeof data.settings.quickstart.completedAt).toBe("string");
    expect(Number.isNaN(new Date(data.settings.quickstart.completedAt).getTime())).toBe(false);
  });

  it("keeps the first completion, so a second run never moves day 1 of the plan", async () => {
    const first = "2026-09-01T10:00:00.000Z";
    mocks.prisma.organization.findUnique.mockResolvedValue({
      settings: { quickstart: { completedAt: first } },
    });
    await callerFor(quickstartRouter, sessionFor("user-1")).execute({
      organizationId: ORG.id,
      industryId: TEMPLATE.id,
      programName: "  Programme  ",
    });
    const { data } = mocks.prisma.organization.update.mock.calls[0][0];
    expect(data.settings.quickstart.completedAt).toBe(first);
    expect(data.settings.programName).toBe("Programme");
  });
});

describe("the result screen", () => {
  const page = readFileSync(
    path.resolve(__dirname, "../src/app/(dashboard)/privacy/quickstart/page.tsx"),
    "utf8"
  );

  it("links each record to its own page, not to a search filter", () => {
    expect(page).not.toContain("data-inventory?search=");
    expect(page).not.toContain("vendors?search=");
    expect(page).toContain("href: `/privacy/data-inventory/${a.id}`");
    expect(page).toContain("href: `/privacy/data-inventory/activities/${a.id}`");
    expect(page).toContain("href: `/privacy/vendors/${v.id}`");
    expect(page).toContain("href: `/privacy/data-inventory/${f.sourceAssetId}?tab=flows`");
  });

  it("links the activities card to the page that exists", () => {
    expect(page).not.toContain('href="/privacy/processing-activities"');
  });

  it("names each group in English and Spanish", () => {
    for (const bundle of [en, es]) {
      const s = bundle.pages.quickstart.success;
      expect(s.createdListActivities).toBeTruthy();
      expect(s.createdListFlows).toBeTruthy();
    }
  });
});
