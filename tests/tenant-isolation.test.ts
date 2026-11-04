/**
 * Tenant-isolation regression tests for member management.
 *
 * Locks the P0 cross-tenant fixes in src/server/routers/privacy/organization.ts:
 * updateMember and removeMember must resolve the target member row scoped to
 * the caller's organization (findFirst with organizationId), so a raw
 * memberId can never reach across tenant boundaries. Before the fix these did
 * a findUnique by raw memberId, letting an OWNER of org A edit or delete
 * members of org B.
 *
 * Prisma is module-mocked: we assert on the queries the router issues, not on
 * a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));

import { organizationRouter } from "@/server/routers/privacy/organization";
import { callerFor, sessionFor } from "./helpers";

const ORG_A = { id: "org-a", name: "Org A", slug: "org-a" };

/** The attacker is an OWNER of org A (passes the adminOrg role gate). */
function ownerOfOrgA() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-owner-a",
    userId: "user-a",
    organizationId: "org-a",
    role: "OWNER",
    organization: ORG_A,
  });
  return callerFor(organizationRouter, sessionFor("user-a")) as ReturnType<
    typeof organizationRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("organization.updateMember tenant isolation", () => {
  it("cannot change the role of a member in another org (scoped lookup misses)", async () => {
    const caller = ownerOfOrgA();
    // The target member belongs to org B; the org-scoped findFirst finds nothing.
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      caller.updateMember({
        organizationId: "org-a",
        memberId: "member-in-org-b",
        role: "ADMIN",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Regression lock: the lookup MUST be scoped by organizationId, never a
    // raw findUnique by memberId.
    expect(mocks.prisma.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "member-in-org-b",
          organizationId: "org-a",
        }),
      })
    );
    expect(mocks.prisma.organizationMember.update).not.toHaveBeenCalled();
  });

  it("updates a member that does belong to the caller's org", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "member-in-org-a",
      organizationId: "org-a",
      role: "MEMBER",
    });
    mocks.prisma.organizationMember.update.mockResolvedValue({
      id: "member-in-org-a",
      role: "ADMIN",
      user: { id: "u", name: "u", email: "u@test.example" },
    });

    const result = await caller.updateMember({
      organizationId: "org-a",
      memberId: "member-in-org-a",
      role: "ADMIN",
    });

    expect(result).toMatchObject({ id: "member-in-org-a", role: "ADMIN" });
    expect(mocks.prisma.organizationMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "member-in-org-a" } })
    );
  });
});

describe("organization.removeMember tenant isolation", () => {
  it("cannot delete a member in another org (scoped lookup misses)", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      caller.removeMember({ organizationId: "org-a", memberId: "member-in-org-b" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "member-in-org-b",
          organizationId: "org-a",
        }),
      })
    );
    expect(mocks.prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  it("removes a member that does belong to the caller's org", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "member-in-org-a",
      organizationId: "org-a",
      role: "MEMBER",
    });
    mocks.prisma.organizationMember.delete.mockResolvedValue({});

    const result = await caller.removeMember({
      organizationId: "org-a",
      memberId: "member-in-org-a",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.prisma.organizationMember.delete).toHaveBeenCalledWith({
      where: { id: "member-in-org-a" },
    });
  });
});
