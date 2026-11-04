// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Department-scope regression test (the stage-4 requirement).
 *
 * A member limited to one or more departments must never see another
 * department's data assets, and an unlimited member must still see everything.
 * This exercises the real dataInventory.listAssets / getAsset queries against a
 * small in-memory fake whose findMany/findFirst honour the composed `where`
 * (organizationId + an AND of the member's department scope), so the narrowing
 * is proven end to end rather than stubbed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  // A matcher that understands the shapes listAssets composes: scalar equality,
  // AND arrays, { in: [...] }, and null equality. undefined means "no
  // constraint". Unrelated nested filters (relations, search OR) are not
  // exercised here.
  function matches(row: Row, where: unknown): boolean {
    if (!where || typeof where !== "object") return true;
    for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
      if (value === undefined) continue;
      if (key === "AND") {
        if (!(value as unknown[]).every((c) => matches(row, c))) return false;
      } else if (key === "OR") {
        if (!(value as unknown[]).some((c) => matches(row, c))) return false;
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        const op = value as Record<string, unknown>;
        if ("in" in op) {
          if (!(op.in as unknown[]).includes(row[key])) return false;
        } else {
          continue; // relation filters not exercised
        }
      } else {
        if (row[key] !== value) return false;
      }
    }
    return true;
  }

  const members: Row[] = [];
  const scopeRows: Row[] = []; // businessUnitMember
  const assets: Row[] = [];
  const org = { id: "org-a", name: "Org A", slug: "org-a" };

  const prisma = {
    organizationMember: {
      findUnique: async ({
        where,
      }: {
        where: { organizationId_userId: { organizationId: string; userId: string } };
      }) => {
        const k = where.organizationId_userId;
        const m = members.find((r) => r.organizationId === k.organizationId && r.userId === k.userId);
        return m ? { ...m, organization: org } : null;
      },
    },
    businessUnitMember: {
      findMany: async ({ where }: { where: { memberId: string } }) =>
        scopeRows.filter((r) => r.memberId === where.memberId),
    },
    dataAsset: {
      findMany: async ({ where }: { where: Row }) => assets.filter((a) => matches(a, where)),
      findFirst: async ({ where }: { where: Row }) => assets.find((a) => matches(a, where)) ?? null,
    },
  };

  function reset() {
    members.length = 0;
    scopeRows.length = 0;
    assets.length = 0;
    members.push({ id: "mem-limited", organizationId: "org-a", userId: "user-limited", role: "MEMBER" });
    members.push({ id: "mem-all", organizationId: "org-a", userId: "user-all", role: "ADMIN" });
    // user-limited may see department A only.
    scopeRows.push({ businessUnitId: "dept-a", memberId: "mem-limited" });
    assets.push(
      { id: "asset-a", organizationId: "org-a", businessUnitId: "dept-a", name: "A", createdAt: new Date(2) },
      { id: "asset-b", organizationId: "org-a", businessUnitId: "dept-b", name: "B", createdAt: new Date(1) },
      { id: "asset-none", organizationId: "org-a", businessUnitId: null, name: "None", createdAt: new Date(0) },
    );
  }

  return { prisma, reset };
});

vi.mock("@/lib/prisma", () => ({ default: H.prisma, prisma: H.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { dataInventoryRouter } from "@/server/routers/privacy/dataInventory";
import { callerFor, sessionFor } from "./helpers";

beforeEach(() => H.reset());

describe("department scope on dataInventory.listAssets", () => {
  it("a department-limited member sees only their department's assets", async () => {
    const caller = callerFor(dataInventoryRouter, sessionFor("user-limited")) as ReturnType<
      typeof dataInventoryRouter.createCaller
    >;
    const { assets } = await caller.listAssets({ organizationId: "org-a", limit: 50 });
    const ids = assets.map((a: { id: string }) => a.id).sort();
    expect(ids).toEqual(["asset-a"]);
    expect(ids).not.toContain("asset-b");
    expect(ids).not.toContain("asset-none");
  });

  it("an unlimited member sees every asset in the organisation", async () => {
    const caller = callerFor(dataInventoryRouter, sessionFor("user-all")) as ReturnType<
      typeof dataInventoryRouter.createCaller
    >;
    const { assets } = await caller.listAssets({ organizationId: "org-a", limit: 50 });
    expect(assets.map((a: { id: string }) => a.id).sort()).toEqual(["asset-a", "asset-b", "asset-none"]);
  });

  it("a limited member cannot open another department's asset by id", async () => {
    const caller = callerFor(dataInventoryRouter, sessionFor("user-limited")) as ReturnType<
      typeof dataInventoryRouter.createCaller
    >;
    await expect(caller.getAsset({ organizationId: "org-a", id: "asset-b" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("an unlimited member can open any asset by id", async () => {
    const caller = callerFor(dataInventoryRouter, sessionFor("user-all")) as ReturnType<
      typeof dataInventoryRouter.createCaller
    >;
    const asset = await caller.getAsset({ organizationId: "org-a", id: "asset-b" });
    expect(asset.id).toBe("asset-b");
  });
});
