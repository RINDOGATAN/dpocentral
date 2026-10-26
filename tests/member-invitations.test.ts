// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Inviting a teammate who has not signed in yet
 * (src/server/services/members/invitations.ts and invitation-email.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  acceptPendingInvitations,
  pendingInvitesOf,
  settingsWithInvite,
  settingsWithoutInvite,
} from "@/server/services/members/invitations";
import { invitationCopy } from "@/server/services/members/invitation-email";

const inv = (email: string, role = "MEMBER") => ({ email, role: role as never, invitedAt: "2026-10-12T10:00:00.000Z", invitedById: "u-owner" });

describe("settings helpers", () => {
  it("adds, replaces and removes by address, keeping other settings", () => {
    let s: unknown = { quickstart: { done: true } };
    s = settingsWithInvite(s, inv("Ana@Example.test"));
    s = settingsWithInvite(s, inv("ana@example.test", "VIEWER"));
    s = settingsWithInvite(s, inv("bo@example.test"));
    expect(pendingInvitesOf(s).map((i) => [i.email, i.role])).toEqual([["ana@example.test", "VIEWER"], ["bo@example.test", "MEMBER"]]);
    expect((s as Record<string, unknown>).pendingInviteEmails).toEqual(["ana@example.test", "bo@example.test"]);
    expect((s as Record<string, unknown>).quickstart).toEqual({ done: true });
    s = settingsWithoutInvite(s, "ANA@example.test");
    expect((s as Record<string, unknown>).pendingInviteEmails).toEqual(["bo@example.test"]);
  });
});

describe("acceptPendingInvitations", () => {
  const db = {
    organization: { findMany: vi.fn(), update: vi.fn() },
    organizationMember: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    db.organizationMember.create.mockResolvedValue({ id: "m-1" });
  });

  it("turns the invitation into a membership with its role and removes it", async () => {
    const settings = settingsWithInvite({}, inv("ana@example.test", "PRIVACY_OFFICER"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    db.organizationMember.findUnique.mockResolvedValue(null);
    expect(await acceptPendingInvitations(db, "u-ana", "Ana@Example.test")).toBe(1);
    expect(db.organization.findMany.mock.calls[0][0].where).toEqual({
      settings: { path: ["pendingInviteEmails"], array_contains: ["ana@example.test"] },
    });
    expect(db.organizationMember.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-1", userId: "u-ana", role: "PRIVACY_OFFICER" });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe("JOIN_BY_INVITATION");
    expect(pendingInvitesOf(db.organization.update.mock.calls[0][0].data.settings)).toEqual([]);
  });

  it("hosted pilot: an account already in another organisation is still added (up to five)", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const settings = settingsWithInvite({}, inv("ana@example.test"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    db.organizationMember.findUnique.mockResolvedValue(null);
    db.organizationMember.count.mockResolvedValue(4);
    expect(await acceptPendingInvitations(db, "u-ana", "ana@example.test")).toBe(1);
    expect(db.organizationMember.create).toHaveBeenCalled();
  });

  it("hosted pilot: an account already in five organisations is not added, the invitation stays", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const settings = settingsWithInvite({}, inv("ana@example.test"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    db.organizationMember.findUnique.mockResolvedValue(null);
    db.organizationMember.count.mockResolvedValue(5);
    expect(await acceptPendingInvitations(db, "u-ana", "ana@example.test")).toBe(0);
    expect(db.organizationMember.create).not.toHaveBeenCalled();
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it("an OWNER invitation issued by a current owner is accepted", async () => {
    const settings = settingsWithInvite({}, inv("ana@example.test", "OWNER"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    db.organizationMember.findUnique
      .mockResolvedValueOnce({ role: "OWNER" }) // the inviter
      .mockResolvedValueOnce(null); // no existing membership
    expect(await acceptPendingInvitations(db, "u-ana", "ana@example.test")).toBe(1);
    expect(db.organizationMember.findUnique.mock.calls[0][0].where).toEqual({
      organizationId_userId: { organizationId: "org-1", userId: "u-owner" },
    });
    expect(db.organizationMember.create.mock.calls[0][0].data.role).toBe("OWNER");
  });

  it("an OWNER invitation not issued by an owner is refused and removed", async () => {
    const settings = settingsWithInvite({}, inv("ana@example.test", "OWNER"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    db.organizationMember.findUnique.mockResolvedValueOnce({ role: "ADMIN" });
    expect(await acceptPendingInvitations(db, "u-ana", "ana@example.test")).toBe(0);
    expect(db.organizationMember.create).not.toHaveBeenCalled();
    expect(pendingInvitesOf(db.organization.update.mock.calls[0][0].data.settings)).toEqual([]);
  });

  it("an OWNER invitation whose inviter is no longer a member is refused", async () => {
    const settings = settingsWithInvite({}, inv("ana@example.test", "OWNER"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    db.organizationMember.findUnique.mockResolvedValueOnce(null);
    expect(await acceptPendingInvitations(db, "u-ana", "ana@example.test")).toBe(0);
    expect(db.organizationMember.create).not.toHaveBeenCalled();
  });

  it("an unknown role is refused and removed", async () => {
    const settings = settingsWithInvite({}, inv("ana@example.test", "SUPERUSER"));
    db.organization.findMany.mockResolvedValue([{ id: "org-1", plan: "PILOT", settings }]);
    expect(await acceptPendingInvitations(db, "u-ana", "ana@example.test")).toBe(0);
    expect(db.organizationMember.create).not.toHaveBeenCalled();
    expect(pendingInvitesOf(db.organization.update.mock.calls[0][0].data.settings)).toEqual([]);
  });

  it("never throws", async () => {
    db.organization.findMany.mockRejectedValue(new Error("db down"));
    await expect(acceptPendingInvitations(db, "u", "a@example.test")).resolves.toBe(0);
  });
});

describe("invitation e-mail copy", () => {
  it("names the inviter, the organisation, the role and the address, in both languages, with no long dashes", () => {
    for (const locale of ["en", "es"] as const) {
      const c = invitationCopy({ to: "ana@example.test", orgName: "Acme", inviterName: "Bo", role: "VIEWER", locale, signInUrl: "http://x" });
      const all = c.subject + c.body + c.button + c.ignore;
      expect(all).toContain("Acme");
      expect(all).toContain("Bo");
      expect(all).toContain("ana@example.test");
      expect(all).toContain(locale === "es" ? "lector" : "viewer");
      expect(all).not.toMatch(/[–—]/);
    }
  });
});
