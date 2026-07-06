/**
 * RBAC regression tests for the baseline role gate.
 *
 * Locks the P0-3 fix in src/server/trpc.ts: role enforcement lives in the
 * open-source core and always applies, with or without the optional private
 * @dpocentral/security package. Here getSecurityModule is mocked to null (the
 * exact open-source-install condition under which the gate used to collapse
 * to "any org member, including VIEWER"). A VIEWER must be denied on
 * privileged procedures; the correct role must pass the gate.
 *
 *   adminOrgProcedure  → OWNER, ADMIN            (organization.removeMember)
 *   officerProcedure   → OWNER, ADMIN, OFFICER   (organization.addJurisdiction)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    organizationJurisdiction: { updateMany: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
// Open-source install: the private security package is NOT present.
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));

import { organizationRouter } from "@/server/routers/privacy/organization";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org" };

/** Sign the user in with a given org role and return a caller. */
function callerWithRole(role: OrganizationRole) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: "org-1",
    role,
    organization: ORG,
  });
  return callerFor(organizationRouter, sessionFor("user-1")) as ReturnType<
    typeof organizationRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("adminOrgProcedure role gate (removeMember)", () => {
  it("denies a VIEWER", async () => {
    const caller = callerWithRole("VIEWER");
    await expect(
      caller.removeMember({ organizationId: "org-1", memberId: "m-x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationMember.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  it("denies a plain MEMBER", async () => {
    const caller = callerWithRole("MEMBER");
    await expect(
      caller.removeMember({ organizationId: "org-1", memberId: "m-x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  it("allows an OWNER through the gate", async () => {
    const caller = callerWithRole("OWNER");
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({
      id: "m-target",
      organizationId: "org-1",
      role: "MEMBER",
    });
    mocks.prisma.organizationMember.delete.mockResolvedValue({});

    const result = await caller.removeMember({
      organizationId: "org-1",
      memberId: "m-target",
    });
    expect(result).toEqual({ success: true });
  });
});

describe("officerProcedure role gate (addJurisdiction)", () => {
  it("denies a VIEWER", async () => {
    const caller = callerWithRole("VIEWER");
    await expect(
      caller.addJurisdiction({
        organizationId: "org-1",
        jurisdictionId: "j-1",
        isPrimary: false,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationJurisdiction.upsert).not.toHaveBeenCalled();
  });

  it("allows a PRIVACY_OFFICER through the gate", async () => {
    const caller = callerWithRole("PRIVACY_OFFICER");
    mocks.prisma.organizationJurisdiction.upsert.mockResolvedValue({
      id: "oj-1",
      organizationId: "org-1",
      jurisdictionId: "j-1",
      isPrimary: false,
      jurisdiction: { id: "j-1", code: "GDPR" },
    });

    const result = await caller.addJurisdiction({
      organizationId: "org-1",
      jurisdictionId: "j-1",
      isPrimary: false,
    });
    expect(result).toMatchObject({ id: "oj-1", jurisdictionId: "j-1" });
    expect(mocks.prisma.organizationJurisdiction.upsert).toHaveBeenCalled();
  });
});
