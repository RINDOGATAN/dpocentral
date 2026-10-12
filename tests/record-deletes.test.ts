// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting processing activities, transfers and unsubmitted assessments:
 * owners and admins only, scoped to the organisation, with an audit entry.
 * A submitted or approved assessment is never deleted.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrganizationRole } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    processingActivity: { findFirst: vi.fn(), deleteMany: vi.fn() },
    dataTransfer: { findFirst: vi.fn(), deleteMany: vi.fn() },
    assessment: { findFirst: vi.fn(), deleteMany: vi.fn() },
    aISystem: { updateMany: vi.fn() },
    dataFlow: { findMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/data-flows/auto-flows", async (orig) => ({
  ...(await orig<object>()),
  syncGeneratedFlows: vi.fn(async () => undefined),
}));

import { dataInventoryRouter } from "@/server/routers/privacy/dataInventory";
import { assessmentRouter } from "@/server/routers/privacy/assessment";
import { syncGeneratedFlows } from "@/server/services/data-flows/auto-flows";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-1", name: "Org", slug: "org" };

function as(role: OrganizationRole) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-1",
    userId: "user-1",
    organizationId: "org-1",
    role,
    organization: ORG,
  });
  return {
    inv: callerFor(dataInventoryRouter, sessionFor("user-1")) as ReturnType<typeof dataInventoryRouter.createCaller>,
    asm: callerFor(assessmentRouter, sessionFor("user-1")) as ReturnType<typeof assessmentRouter.createCaller>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.processingActivity.findFirst.mockResolvedValue({ id: "pa-1", name: "Payroll" });
  mocks.prisma.processingActivity.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.dataTransfer.findFirst.mockResolvedValue({ id: "t-1", name: "To US" });
  mocks.prisma.dataTransfer.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.assessment.findFirst.mockResolvedValue({ id: "as-1", name: "DPIA", status: "IN_PROGRESS" });
  mocks.prisma.assessment.deleteMany.mockResolvedValue({ count: 1 });
  mocks.prisma.aISystem.updateMany.mockResolvedValue({ count: 0 });
});

const input = (id: string) => ({ organizationId: "org-1", id });

describe("who may delete", () => {
  for (const role of ["VIEWER", "MEMBER", "PRIVACY_OFFICER"] as const) {
    it(`refuses a ${role}`, async () => {
      const { inv, asm } = as(role);
      await expect(inv.deleteActivity(input("pa-1"))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(inv.deleteTransfer(input("t-1"))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(asm.delete(input("as-1"))).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.prisma.processingActivity.deleteMany).not.toHaveBeenCalled();
      expect(mocks.prisma.dataTransfer.deleteMany).not.toHaveBeenCalled();
      expect(mocks.prisma.assessment.deleteMany).not.toHaveBeenCalled();
    });
  }
});

describe("as an admin", () => {
  it("deletes an activity in the organisation, its generated flows follow, audited", async () => {
    const { inv } = as("ADMIN");
    await expect(inv.deleteActivity(input("pa-1"))).resolves.toEqual({ success: true });
    expect(mocks.prisma.processingActivity.deleteMany).toHaveBeenCalledWith({ where: { id: "pa-1", organizationId: "org-1" } });
    expect(syncGeneratedFlows).toHaveBeenCalledWith(mocks.prisma, "org-1", ["pa-1"]);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entityType: "ProcessingActivity", entityId: "pa-1", action: "DELETE",
    });
  });

  it("deletes a transfer, audited", async () => {
    const { inv } = as("OWNER");
    await expect(inv.deleteTransfer(input("t-1"))).resolves.toEqual({ success: true });
    expect(mocks.prisma.dataTransfer.deleteMany).toHaveBeenCalledWith({ where: { id: "t-1", organizationId: "org-1" } });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ entityType: "DataTransfer", action: "DELETE" });
  });

  it("answers NOT_FOUND for a record of another organisation", async () => {
    const { inv } = as("ADMIN");
    mocks.prisma.dataTransfer.findFirst.mockResolvedValue(null);
    await expect(inv.deleteTransfer(input("t-x"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.dataTransfer.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes an unsubmitted assessment and unlinks AI systems from it", async () => {
    const { asm } = as("ADMIN");
    await expect(asm.delete(input("as-1"))).resolves.toEqual({ success: true });
    expect(mocks.prisma.aISystem.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", assessmentId: "as-1" },
      data: { assessmentId: null },
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ entityType: "Assessment", action: "DELETE" });
  });

  for (const status of ["PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ARCHIVED"]) {
    it(`keeps a ${status} assessment`, async () => {
      const { asm } = as("OWNER");
      mocks.prisma.assessment.findFirst.mockResolvedValue({ id: "as-1", name: "DPIA", status });
      await expect(asm.delete(input("as-1"))).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(mocks.prisma.assessment.deleteMany).not.toHaveBeenCalled();
    });
  }
});
