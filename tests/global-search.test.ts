// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The top bar's search (search.names): names only, scoped on the server to
 * the caller's organisation, to the departments a limited member sees, and,
 * for rights requests, to the requests the caller's role may open.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    businessUnitMember: { findMany: vi.fn() },
    dataAsset: { findMany: vi.fn() },
    processingActivity: { findMany: vi.fn() },
    vendor: { findMany: vi.fn() },
    assessment: { findMany: vi.fn() },
    incident: { findMany: vi.fn() },
    dSARRequest: { findMany: vi.fn() },
    organization: { updateMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { searchRouter, referenceTerm } from "@/server/routers/privacy/search";
import { callerFor, sessionFor } from "./helpers";

function caller(role: string) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: new Date() },
    user: { locale: null },
  });
  return callerFor(searchRouter, sessionFor("user-a")) as ReturnType<typeof searchRouter.createCaller>;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ["dataAsset", "processingActivity", "vendor", "assessment", "incident", "dSARRequest"] as const) {
    mocks.prisma[m].findMany.mockResolvedValue([]);
  }
  mocks.prisma.businessUnitMember.findMany.mockResolvedValue([]);
});

const whereOf = (m: keyof typeof mocks.prisma) =>
  (mocks.prisma[m] as { findMany: ReturnType<typeof vi.fn> }).findMany.mock.calls[0][0].where;

describe("search.names", () => {
  it("searches names in the caller's organisation only", async () => {
    mocks.prisma.vendor.findMany.mockResolvedValue([{ id: "v1", name: "Acme Mail" }]);
    const hits = await caller("OWNER").names({ organizationId: "org-a", q: "acme" });
    expect(hits).toEqual([{ kind: "vendor", id: "v1", name: "Acme Mail", href: "/privacy/vendors/v1" }]);
    for (const m of ["dataAsset", "processingActivity", "vendor", "assessment", "incident", "dSARRequest"] as const) {
      expect(whereOf(m).organizationId).toBe("org-a");
    }
    expect(whereOf("vendor").name).toEqual({ contains: "acme", mode: "insensitive" });
  });

  it("refuses an organisation the caller does not belong to", async () => {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue(null);
    const c = callerFor(searchRouter, sessionFor("user-a")) as ReturnType<typeof searchRouter.createCaller>;
    await expect(c.names({ organizationId: "org-b", q: "acme" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.vendor.findMany).not.toHaveBeenCalled();
  });

  it("finds every request for the roles that handle them", async () => {
    await caller("PRIVACY_OFFICER").names({ organizationId: "org-a", q: "jane" });
    expect(whereOf("dSARRequest").tasks).toBeUndefined();
  });

  it("finds only their assigned requests for a member or a viewer", async () => {
    for (const role of ["MEMBER", "VIEWER"]) {
      vi.clearAllMocks();
      mocks.prisma.dSARRequest.findMany.mockResolvedValue([]);
      for (const m of ["dataAsset", "processingActivity", "vendor", "assessment", "incident"] as const) {
        mocks.prisma[m].findMany.mockResolvedValue([]);
      }
      mocks.prisma.businessUnitMember.findMany.mockResolvedValue([]);
      await caller(role).names({ organizationId: "org-a", q: "jane" });
      expect(whereOf("dSARRequest").tasks).toEqual({ some: { assigneeId: "user-a" } });
    }
  });

  it("confines a member limited to departments to their systems and activities", async () => {
    mocks.prisma.businessUnitMember.findMany.mockResolvedValue([{ businessUnitId: "bu-1" }]);
    await caller("MEMBER").names({ organizationId: "org-a", q: "crm" });
    expect(whereOf("dataAsset").AND).toEqual([{ businessUnitId: { in: ["bu-1"] } }]);
    expect(whereOf("processingActivity").AND).toEqual([{ businessUnitId: { in: ["bu-1"] } }]);
  });

  it("needs at least two characters", async () => {
    await expect(caller("OWNER").names({ organizationId: "org-a", q: "a" })).rejects.toBeTruthy();
  });

  it("matches a typed reference by its id part", () => {
    expect(referenceTerm("INC-AB12CD")).toBe("AB12CD");
    expect(referenceTerm("sol-ab12cd")).toBe("ab12cd");
    expect(referenceTerm("Payroll")).toBe("Payroll");
  });
});
