// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * src/server/services/organization/list.ts: the list the router and the
 * root layout share. The operator's plan references never leave the server,
 * and the layout's read fails soft (null), never the page.
 */

import { describe, it, expect, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { organizationMember: { findMany: (...args: unknown[]) => findMany(...args) } },
  default: { organizationMember: { findMany: (...args: unknown[]) => findMany(...args) } },
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { listOrganizationsFor, listOrganizationsForLayout, withoutPlanNote } from "@/server/services/organization/list";

const joinedAt = new Date("2026-10-01T00:00:00Z");
const membership = {
  role: "OWNER",
  joinedAt,
  organization: {
    id: "org-1",
    name: "One",
    slug: "one",
    planNote: "invoice 1",
    planStripeSubscriptionId: "sub_1",
    _count: { members: 1, dataAssets: 0, dsarRequests: 0, incidents: 0, vendors: 0 },
  },
};

describe("listOrganizationsFor", () => {
  it("scopes the query to the person and strips the plan references", async () => {
    const db = { organizationMember: { findMany: vi.fn(async () => [membership]) } };
    const list = await listOrganizationsFor(db as never, "user-1");
    expect(db.organizationMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" }, orderBy: { joinedAt: "desc" } })
    );
    expect(list).toEqual([
      expect.objectContaining({ id: "org-1", name: "One", role: "OWNER", joinedAt }),
    ]);
    expect(list[0]).not.toHaveProperty("planNote");
    expect(list[0]).not.toHaveProperty("planStripeSubscriptionId");
  });
});

describe("withoutPlanNote", () => {
  it("removes only the two plan references", () => {
    expect(withoutPlanNote({ id: "x", planNote: "n", planStripeSubscriptionId: "s", plan: "PILOT" })).toEqual({ id: "x", plan: "PILOT" });
  });
});

describe("listOrganizationsForLayout", () => {
  it("returns the list on success", async () => {
    findMany.mockResolvedValueOnce([membership]);
    const list = await listOrganizationsForLayout("user-1");
    expect(list?.map((o) => o.id)).toEqual(["org-1"]);
  });

  it("returns null when the read fails", async () => {
    findMany.mockRejectedValueOnce(new Error("down"));
    expect(await listOrganizationsForLayout("user-1")).toBeNull();
  });
});
