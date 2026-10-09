// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation's reminder switch (on by default; only an owner or admin
 * changes it, and the change is audited), what the request page is told
 * about the Extend deadline button, and the member's language being
 * remembered for e-mails the app sends on its own.
 *
 * Prisma is module-mocked: we assert on what the routers read and write.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    organizationJurisdiction: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
    dSARRequest: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({ sendDSARConfirmationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({ sendDSARCommunicationEmail: vi.fn() }));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { callerFor, sessionFor } from "./helpers";

const d = (y: number, m: number, day: number, h = 10) => new Date(y, m - 1, day, h, 0, 0);

function as(role: string, opts: { storedLocale?: string | null; cookieLocale?: string } = {}) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null },
    user: { locale: opts.storedLocale === undefined ? null : opts.storedLocale },
  });
  const cookies: Record<string, string> = opts.cookieLocale ? { locale: opts.cookieLocale } : {};
  return callerFor(dsarRouter, sessionFor("user-a"), cookies) as ReturnType<typeof dsarRouter.createCaller>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.organization.update.mockResolvedValue({});
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.user.update.mockResolvedValue({});
});

describe("reminder settings", () => {
  it("reads on by default when nothing is stored", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue(null);
    expect(await as("VIEWER").getReminderSettings({ organizationId: "org-a" })).toEqual({ enabled: true });
  });

  it("an owner or admin switches them off; the change is audited", async () => {
    for (const role of ["OWNER", "ADMIN"]) {
      vi.clearAllMocks();
      await as(role).setReminderSettings({ organizationId: "org-a", enabled: false });
      expect(mocks.prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-a" },
        data: { dsarRemindersEnabled: false },
      });
      expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ changes: { dsarRemindersEnabled: false } }) })
      );
    }
  });

  it("other roles cannot change it", async () => {
    for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER"]) {
      await expect(
        as(role).setReminderSettings({ organizationId: "org-a", enabled: false })
      ).rejects.toThrow();
    }
    expect(mocks.prisma.organization.update).not.toHaveBeenCalled();
  });
});

describe("request page: Extend deadline button state", () => {
  function stored(extra: Record<string, unknown> = {}) {
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
      id: "dsar-1",
      organizationId: "org-a",
      status: "IN_PROGRESS",
      receivedAt: d(2026, 1, 31),
      dueDate: d(2026, 2, 28),
      extendedDueDate: null,
      tasks: [],
      communications: [],
      auditLog: [],
      ...extra,
    });
  }

  it("GDPR, not yet extended: offered, with the new date and the tell-by date", async () => {
    mocks.prisma.organizationJurisdiction.findFirst.mockResolvedValue({
      isPrimary: true,
      jurisdiction: { code: "GDPR", dsarDeadlineDays: 30 },
    });
    stored();
    const r = await as("VIEWER").getById({ organizationId: "org-a", id: "dsar-1" });
    expect(r.extension).toEqual({ allowed: true, newDueDate: d(2026, 4, 30), tellBy: d(2026, 2, 28) });
  });

  it("a law without extension, or a request already extended: not offered, with the reason", async () => {
    mocks.prisma.organizationJurisdiction.findFirst.mockResolvedValue({
      isPrimary: true,
      jurisdiction: { code: "LGPD", dsarDeadlineDays: 15 },
    });
    stored();
    expect((await as("VIEWER").getById({ organizationId: "org-a", id: "dsar-1" })).extension).toEqual({
      allowed: false,
      reason: "no_extension",
    });
    mocks.prisma.organizationJurisdiction.findFirst.mockResolvedValue({
      isPrimary: true,
      jurisdiction: { code: "GDPR", dsarDeadlineDays: 30 },
    });
    stored({ extendedDueDate: d(2026, 4, 30), dueDate: d(2026, 4, 30) });
    expect((await as("VIEWER").getById({ organizationId: "org-a", id: "dsar-1" })).extension).toEqual({
      allowed: false,
      reason: "already_extended",
    });
  });
});

describe("the member's language is remembered", () => {
  it("written when the language cookie differs from what is stored", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue({ dsarRemindersEnabled: true });
    await as("VIEWER", { storedLocale: null, cookieLocale: "es" }).getReminderSettings({ organizationId: "org-a" });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-a" }, data: { locale: "es" } });
  });

  it("not written when it is unchanged or no language was chosen", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue({ dsarRemindersEnabled: true });
    await as("VIEWER", { storedLocale: "es", cookieLocale: "es" }).getReminderSettings({ organizationId: "org-a" });
    await as("VIEWER", { storedLocale: "en" }).getReminderSettings({ organizationId: "org-a" });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("a failed write never fails the request", async () => {
    mocks.prisma.organization.findUnique.mockResolvedValue({ dsarRemindersEnabled: false });
    mocks.prisma.user.update.mockRejectedValue(new Error("db down"));
    expect(
      await as("VIEWER", { storedLocale: "en", cookieLocale: "es" }).getReminderSettings({ organizationId: "org-a" })
    ).toEqual({ enabled: false });
  });
});
