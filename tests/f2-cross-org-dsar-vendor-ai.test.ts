/**
 * Cross-organisation regression tests for the DSAR, vendor and AI governance
 * routers (cycle 12, F2).
 *
 * The org middleware proves the caller belongs to `input.organizationId`; it
 * says nothing about the other ids in the input. These tests lock the checks
 * in:
 *   - src/server/routers/privacy/dsar.ts
 *       createTask: `dataAssetId` must be an asset of the caller's
 *         organisation and `assigneeId` a member of it (otherwise the
 *         `include: { dataAsset, assignee }` would hand back another
 *         organisation's asset, or a stranger's name and email).
 *       updateTask: `assigneeId` must be a member of the caller's organisation.
 *   - src/server/routers/privacy/vendor.ts
 *       scheduleReview: `reviewerId` must be a member of the caller's
 *         organisation (the reply includes the reviewer's name and email).
 *   - src/server/routers/privacy/aiGovernance.ts
 *       create / update: `vendorId` must be a vendor of the caller's
 *         organisation (getById and list include the vendor's name and
 *         certifications).
 *
 * Prisma is module-mocked: we assert on the queries the router issues, not on
 * a real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    dSARRequest: { findFirst: vi.fn() },
    dSARTask: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dataAsset: { count: vi.fn() },
    vendor: { findFirst: vi.fn(), count: vi.fn() },
    vendorReview: { create: vi.fn() },
    aISystem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({
  sendDSARConfirmationEmail: vi.fn(),
}));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({
  sendDSARCommunicationEmail: vi.fn(),
}));
vi.mock("@/server/services/licensing/entitlement", () => ({
  hasVendorCatalogAccess: vi.fn().mockResolvedValue(true),
}));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { vendorRouter } from "@/server/routers/privacy/vendor";
import { aiGovernanceRouter } from "@/server/routers/privacy/aiGovernance";
import { callerFor, sessionFor } from "./helpers";

const ORG_A = { id: "org-a", name: "Org A", slug: "org-a" };

/** The caller is a legitimate OWNER of org A (passes every role gate). */
function asOwnerOfOrgA() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-owner-a",
    userId: "user-a",
    organizationId: "org-a",
    role: "OWNER",
    organization: ORG_A,
  });
}

function dsarCaller() {
  asOwnerOfOrgA();
  return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<
    typeof dsarRouter.createCaller
  >;
}

function vendorCaller() {
  asOwnerOfOrgA();
  return callerFor(vendorRouter, sessionFor("user-a")) as ReturnType<
    typeof vendorRouter.createCaller
  >;
}

function aiCaller() {
  asOwnerOfOrgA();
  return callerFor(aiGovernanceRouter, sessionFor("user-a")) as ReturnType<
    typeof aiGovernanceRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  // The parent rows always belong to org A: only the OTHER id is foreign.
  mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
    id: "dsar-a",
    organizationId: "org-a",
  });
  mocks.prisma.dSARTask.findFirst.mockResolvedValue({
    id: "task-a",
    dsarRequest: { id: "dsar-a", organizationId: "org-a" },
  });
  mocks.prisma.vendor.findFirst.mockResolvedValue({
    id: "vendor-a",
    organizationId: "org-a",
  });
  mocks.prisma.aISystem.findFirst.mockResolvedValue({
    id: "system-a",
    organizationId: "org-a",
  });
});

// ============================================================
// DSAR
// ============================================================

describe("dsar.createTask cross-organisation data asset", () => {
  it("refuses a data asset that belongs to another organisation", async () => {
    const caller = dsarCaller();
    mocks.prisma.dataAsset.count.mockResolvedValue(0);

    await expect(
      caller.createTask({
        organizationId: "org-a",
        dsarRequestId: "dsar-a",
        dataAssetId: "asset-in-org-b",
        title: "Extract the data",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.dataAsset.count).toHaveBeenCalledWith({
      where: { id: { in: ["asset-in-org-b"] }, organizationId: "org-a" },
    });
    expect(mocks.prisma.dSARTask.create).not.toHaveBeenCalled();
  });

  it("creates the task when the data asset belongs to the organisation", async () => {
    const caller = dsarCaller();
    mocks.prisma.dataAsset.count.mockResolvedValue(1);
    mocks.prisma.dSARTask.create.mockResolvedValue({ id: "task-1" });

    const result = await caller.createTask({
      organizationId: "org-a",
      dsarRequestId: "dsar-a",
      dataAssetId: "asset-in-org-a",
      title: "Extract the data",
    });

    expect(result).toMatchObject({ id: "task-1" });
    expect(mocks.prisma.dSARTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dsarRequestId: "dsar-a",
          dataAssetId: "asset-in-org-a",
        }),
      })
    );
  });
});

describe("dsar.createTask cross-organisation assignee", () => {
  it("refuses an assignee who is not a member of the caller's organisation", async () => {
    const caller = dsarCaller();
    mocks.prisma.organizationMember.count.mockResolvedValue(0);

    await expect(
      caller.createTask({
        organizationId: "org-a",
        dsarRequestId: "dsar-a",
        assigneeId: "user-in-org-b",
        title: "Extract the data",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.organizationMember.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", userId: { in: ["user-in-org-b"] } },
    });
    expect(mocks.prisma.dSARTask.create).not.toHaveBeenCalled();
  });

  it("creates the task when the assignee is a member", async () => {
    const caller = dsarCaller();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    mocks.prisma.dSARTask.create.mockResolvedValue({ id: "task-1" });

    const result = await caller.createTask({
      organizationId: "org-a",
      dsarRequestId: "dsar-a",
      assigneeId: "user-in-org-a",
      title: "Extract the data",
    });

    expect(result).toMatchObject({ id: "task-1" });
    expect(mocks.prisma.dSARTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assigneeId: "user-in-org-a" }),
      })
    );
  });

  it("still creates a task with neither an asset nor an assignee, without counting", async () => {
    const caller = dsarCaller();
    mocks.prisma.dSARTask.create.mockResolvedValue({ id: "task-2" });

    await caller.createTask({
      organizationId: "org-a",
      dsarRequestId: "dsar-a",
      title: "Extract the data",
    });

    expect(mocks.prisma.dataAsset.count).not.toHaveBeenCalled();
    expect(mocks.prisma.organizationMember.count).not.toHaveBeenCalled();
    expect(mocks.prisma.dSARTask.create).toHaveBeenCalled();
  });
});

describe("dsar.updateTask cross-organisation assignee", () => {
  it("refuses an assignee who is not a member of the caller's organisation", async () => {
    const caller = dsarCaller();
    mocks.prisma.organizationMember.count.mockResolvedValue(0);

    await expect(
      caller.updateTask({
        organizationId: "org-a",
        id: "task-a",
        assigneeId: "user-in-org-b",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.organizationMember.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", userId: { in: ["user-in-org-b"] } },
    });
    expect(mocks.prisma.dSARTask.update).not.toHaveBeenCalled();
  });

  it("updates the task when the assignee is a member", async () => {
    const caller = dsarCaller();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    mocks.prisma.dSARTask.update.mockResolvedValue({ id: "task-a" });

    const result = await caller.updateTask({
      organizationId: "org-a",
      id: "task-a",
      assigneeId: "user-in-org-a",
    });

    expect(result).toMatchObject({ id: "task-a" });
    expect(mocks.prisma.dSARTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-a" },
        data: expect.objectContaining({ assigneeId: "user-in-org-a" }),
      })
    );
  });

  it("still lets the assignee be cleared, without counting", async () => {
    const caller = dsarCaller();
    mocks.prisma.dSARTask.update.mockResolvedValue({ id: "task-a" });

    await caller.updateTask({ organizationId: "org-a", id: "task-a", assigneeId: null });

    expect(mocks.prisma.organizationMember.count).not.toHaveBeenCalled();
    expect(mocks.prisma.dSARTask.update).toHaveBeenCalled();
  });
});

// ============================================================
// VENDOR
// ============================================================

describe("vendor.scheduleReview cross-organisation reviewer", () => {
  it("refuses a reviewer who is not a member of the caller's organisation", async () => {
    const caller = vendorCaller();
    mocks.prisma.organizationMember.count.mockResolvedValue(0);

    await expect(
      caller.scheduleReview({
        organizationId: "org-a",
        vendorId: "vendor-a",
        reviewerId: "user-in-org-b",
        scheduledAt: new Date("2027-01-01T00:00:00Z"),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.organizationMember.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", userId: { in: ["user-in-org-b"] } },
    });
    expect(mocks.prisma.vendorReview.create).not.toHaveBeenCalled();
  });

  it("schedules the review when the reviewer is a member", async () => {
    const caller = vendorCaller();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    mocks.prisma.vendorReview.create.mockResolvedValue({ id: "review-1" });

    const result = await caller.scheduleReview({
      organizationId: "org-a",
      vendorId: "vendor-a",
      reviewerId: "user-in-org-a",
      scheduledAt: new Date("2027-01-01T00:00:00Z"),
    });

    expect(result).toMatchObject({ id: "review-1" });
    expect(mocks.prisma.vendorReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: "vendor-a",
          reviewerId: "user-in-org-a",
        }),
      })
    );
  });
});

// ============================================================
// AI GOVERNANCE
// ============================================================

describe("aiGovernance.create cross-organisation vendor", () => {
  it("refuses a vendor that belongs to another organisation", async () => {
    const caller = aiCaller();
    mocks.prisma.vendor.count.mockResolvedValue(0);

    await expect(
      caller.create({
        organizationId: "org-a",
        name: "Scoring model",
        vendorId: "vendor-in-org-b",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.vendor.count).toHaveBeenCalledWith({
      where: { id: { in: ["vendor-in-org-b"] }, organizationId: "org-a" },
    });
    expect(mocks.prisma.aISystem.create).not.toHaveBeenCalled();
  });

  it("registers the system when the vendor belongs to the organisation", async () => {
    const caller = aiCaller();
    mocks.prisma.vendor.count.mockResolvedValue(1);
    mocks.prisma.aISystem.create.mockResolvedValue({ id: "system-1" });

    const result = await caller.create({
      organizationId: "org-a",
      name: "Scoring model",
      vendorId: "vendor-a",
    });

    expect(result).toMatchObject({ id: "system-1" });
    expect(mocks.prisma.aISystem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-a",
          vendorId: "vendor-a",
        }),
      })
    );
  });
});

describe("aiGovernance.update cross-organisation vendor", () => {
  it("refuses a vendor that belongs to another organisation", async () => {
    const caller = aiCaller();
    mocks.prisma.vendor.count.mockResolvedValue(0);

    await expect(
      caller.update({
        organizationId: "org-a",
        id: "system-a",
        vendorId: "vendor-in-org-b",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.vendor.count).toHaveBeenCalledWith({
      where: { id: { in: ["vendor-in-org-b"] }, organizationId: "org-a" },
    });
    expect(mocks.prisma.aISystem.update).not.toHaveBeenCalled();
  });

  it("updates the system when the vendor belongs to the organisation", async () => {
    const caller = aiCaller();
    mocks.prisma.vendor.count.mockResolvedValue(1);
    mocks.prisma.aISystem.update.mockResolvedValue({ id: "system-a" });

    const result = await caller.update({
      organizationId: "org-a",
      id: "system-a",
      vendorId: "vendor-a",
    });

    expect(result).toMatchObject({ id: "system-a" });
    expect(mocks.prisma.aISystem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "system-a" },
        data: expect.objectContaining({ vendorId: "vendor-a" }),
      })
    );
  });

  it("still lets the vendor link be cleared, without counting", async () => {
    const caller = aiCaller();
    mocks.prisma.aISystem.update.mockResolvedValue({ id: "system-a" });

    await caller.update({ organizationId: "org-a", id: "system-a", vendorId: null });

    expect(mocks.prisma.vendor.count).not.toHaveBeenCalled();
    expect(mocks.prisma.aISystem.update).toHaveBeenCalled();
  });
});
