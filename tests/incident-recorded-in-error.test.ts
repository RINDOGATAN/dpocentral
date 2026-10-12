// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Incidents recorded in error (incident.setRecordedInError): owners and
 * admins only, a reason required, never a delete; a timeline entry and an
 * audit entry each time. Marked incidents leave the counts (getStats).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    incident: { findFirst: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    incidentNotification: { count: vi.fn() },
    incidentTimelineEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { incidentRouter } from "@/server/routers/privacy/incident";
import { callerFor, sessionFor } from "./helpers";

function as(role: OrganizationRole) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1", userId: "user-1", organizationId: "org-1", role,
    organization: { id: "org-1", name: "Org", slug: "org" },
  });
  return callerFor(incidentRouter, sessionFor("user-1")) as ReturnType<typeof incidentRouter.createCaller>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.incident.findFirst.mockResolvedValue({ id: "inc-1", recordedInErrorAt: null });
  mocks.prisma.incident.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.incident.count.mockResolvedValue(0);
  mocks.prisma.incident.groupBy.mockResolvedValue([]);
  mocks.prisma.incidentNotification.count.mockResolvedValue(0);
});

const mark = { organizationId: "org-1", id: "inc-1", recordedInError: true, reason: "A test entry" };

describe("setRecordedInError", () => {
  for (const role of ["VIEWER", "MEMBER", "PRIVACY_OFFICER"] as const) {
    it(`refuses a ${role}`, async () => {
      await expect(as(role).setRecordedInError(mark)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.prisma.incident.updateMany).not.toHaveBeenCalled();
    });
  }

  it("needs a reason to mark", async () => {
    await expect(as("ADMIN").setRecordedInError({ ...mark, reason: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("marks with who, when and why, never deletes, and records it twice", async () => {
    await expect(as("OWNER").setRecordedInError(mark)).resolves.toEqual({ success: true });
    const { where, data } = mocks.prisma.incident.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "inc-1", organizationId: "org-1" });
    expect(data.recordedInErrorAt).toBeInstanceOf(Date);
    expect(data).toMatchObject({ recordedInErrorById: "user-1", recordedInErrorReason: "A test entry" });
    expect(mocks.prisma.incident.delete).not.toHaveBeenCalled();
    expect(mocks.prisma.incident.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.incidentTimelineEntry.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ entityType: "Incident", action: "RECORDED_IN_ERROR" });
  });

  it("undoes", async () => {
    await as("ADMIN").setRecordedInError({ organizationId: "org-1", id: "inc-1", recordedInError: false });
    expect(mocks.prisma.incident.updateMany.mock.calls[0][0].data).toEqual({
      recordedInErrorAt: null, recordedInErrorById: null, recordedInErrorReason: null,
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.action).toBe("RECORDED_IN_ERROR_UNDONE");
  });

  it("answers NOT_FOUND across organisations", async () => {
    mocks.prisma.incident.findFirst.mockResolvedValue(null);
    await expect(as("ADMIN").setRecordedInError(mark)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("counts", () => {
  it("getStats counts only incidents not recorded in error", async () => {
    await as("VIEWER").getStats({ organizationId: "org-1" });
    for (const [args] of [...mocks.prisma.incident.count.mock.calls, ...mocks.prisma.incident.groupBy.mock.calls]) {
      expect(args.where).toMatchObject({ recordedInErrorAt: null });
    }
    expect(mocks.prisma.incident.count).toHaveBeenCalled();
  });
});
