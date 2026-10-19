// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Member role transitions (organization.addMember / updateMember /
 * removeMember), every caller role against every target role.
 *
 *   - Only an OWNER may make someone an OWNER, whether the address already has
 *     an account (membership created at once) or not (invitation kept). An
 *     admin who could add an existing account as owner could then demote the
 *     original owner: a takeover.
 *   - Only an OWNER may change a role.
 *   - Only an OWNER may remove an OWNER; the last owner can never be removed.
 *   - VIEWER, MEMBER and PRIVACY_OFFICER are refused by the admin gate.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  callerRole: "OWNER" as string,
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));
vi.mock("@/server/services/members/invitation-email", () => ({
  sendInvitationEmail: vi.fn(async () => true),
  invitationSignInUrl: () => "http://localhost/sign-in",
}));
vi.mock("@/server/services/pilot/caps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/pilot/caps")>()),
  assertOrganizationsPerAccount: vi.fn(async () => undefined),
  assertPilotCapacity: vi.fn(async () => undefined),
}));

import { organizationRouter } from "@/server/routers/privacy/organization";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org" };
const ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;
const NOT_ADMIN = ["PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const;

function callerWithRole(role: OrganizationRole) {
  mocks.callerRole = role;
  return callerFor(organizationRouter, sessionFor("user-1")) as ReturnType<
    typeof organizationRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The caller's own membership, then "not yet a member" for the invitee.
  mocks.prisma.organizationMember.findUnique.mockImplementation(
    async ({ where }: { where: { organizationId_userId: { userId: string } } }) =>
      where.organizationId_userId.userId === "user-1"
        ? { id: "member-1", userId: "user-1", organizationId: "org-1", role: mocks.callerRole, organization: ORG }
        : null,
  );
  mocks.prisma.organizationMember.create.mockImplementation(async ({ data }: { data: { role: string } }) => ({
    id: "m-new",
    role: data.role,
  }));
  mocks.prisma.organizationMember.update.mockImplementation(async ({ data }: { data: { role: string } }) => ({
    id: "m-target",
    role: data.role,
  }));
  mocks.prisma.organizationMember.delete.mockResolvedValue({});
  mocks.prisma.organizationMember.count.mockResolvedValue(2);
  mocks.prisma.organization.findUnique.mockResolvedValue({ name: "Org", settings: {} });
  mocks.prisma.organization.update.mockResolvedValue({});
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

function existingAccount() {
  mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-2", email: "two@test.example" });
}
function noAccount() {
  mocks.prisma.user.findUnique.mockResolvedValue(null);
}
const add = (callerRole: OrganizationRole, role: OrganizationRole) =>
  callerWithRole(callerRole).addMember({ organizationId: "org-1", email: "two@test.example", role });

describe("addMember: who may grant which role", () => {
  for (const [label, setup] of [
    ["existing account", existingAccount],
    ["no account yet (invitation)", noAccount],
  ] as const) {
    describe(label, () => {
      beforeEach(() => setup());

      it.each(ROLES)("an OWNER may add a %s", async (role) => {
        await expect(add("OWNER", role)).resolves.toBeTruthy();
      });

      it("an ADMIN may not add an OWNER", async () => {
        await expect(add("ADMIN", "OWNER")).rejects.toMatchObject({
          code: "FORBIDDEN",
          message: "Only owners can invite an owner",
        });
        expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
        expect(mocks.prisma.organization.update).not.toHaveBeenCalled();
      });

      it.each(["ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const)(
        "an ADMIN may add a %s",
        async (role) => {
          await expect(add("ADMIN", role)).resolves.toBeTruthy();
        },
      );

      it.each(NOT_ADMIN)("a %s may not add anyone", async (callerRole) => {
        await expect(add(callerRole, "MEMBER")).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
        expect(mocks.prisma.organization.update).not.toHaveBeenCalled();
      });
    });
  }
});

describe("updateMember: only an owner changes roles", () => {
  beforeEach(() => {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({ id: "m-target", organizationId: "org-1", role: "MEMBER" });
  });

  it.each(ROLES)("an OWNER may set a member to %s", async (role) => {
    const r = await callerWithRole("OWNER").updateMember({ organizationId: "org-1", memberId: "m-target", role });
    expect(r.role).toBe(role);
  });

  it.each(["ADMIN", ...NOT_ADMIN] as const)("a %s may not change a role", async (callerRole) => {
    await expect(
      callerWithRole(callerRole).updateMember({ organizationId: "org-1", memberId: "m-target", role: "OWNER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationMember.update).not.toHaveBeenCalled();
  });

  it("the last owner cannot be demoted", async () => {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({ id: "m-target", organizationId: "org-1", role: "OWNER" });
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    await expect(
      callerWithRole("OWNER").updateMember({ organizationId: "org-1", memberId: "m-target", role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("removeMember: only an owner removes an owner", () => {
  function target(role: OrganizationRole) {
    mocks.prisma.organizationMember.findFirst.mockResolvedValue({ id: "m-target", organizationId: "org-1", role });
  }

  it("an ADMIN may not remove an OWNER", async () => {
    target("OWNER");
    await expect(
      callerWithRole("ADMIN").removeMember({ organizationId: "org-1", memberId: "m-target" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Only owners can remove an owner" });
    expect(mocks.prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  it("an OWNER may remove another OWNER when one remains", async () => {
    target("OWNER");
    await expect(
      callerWithRole("OWNER").removeMember({ organizationId: "org-1", memberId: "m-target" }),
    ).resolves.toEqual({ success: true });
  });

  it("the last OWNER cannot be removed", async () => {
    target("OWNER");
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    await expect(
      callerWithRole("OWNER").removeMember({ organizationId: "org-1", memberId: "m-target" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it.each(["ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"] as const)("an ADMIN may remove a %s", async (role) => {
    target(role);
    await expect(
      callerWithRole("ADMIN").removeMember({ organizationId: "org-1", memberId: "m-target" }),
    ).resolves.toEqual({ success: true });
  });

  it.each(NOT_ADMIN)("a %s may not remove anyone", async (callerRole) => {
    target("MEMBER");
    await expect(
      callerWithRole(callerRole).removeMember({ organizationId: "org-1", memberId: "m-target" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.organizationMember.delete).not.toHaveBeenCalled();
  });
});
