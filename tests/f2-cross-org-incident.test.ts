/**
 * Cross-organisation regression tests for the incident router (cycle 12, F2).
 *
 * The org middleware proves the caller belongs to `input.organizationId`; it
 * says nothing about the other ids in the input. These tests lock the checks
 * in src/server/routers/privacy/incident.ts:
 *   - createTask / updateTask: `assigneeId` must be a member of the caller's
 *     organisation (otherwise the `include: { assignee }` would hand back a
 *     stranger's name and email).
 *   - linkAsset: `dataAssetId` must be an asset of the caller's organisation
 *     (otherwise the `include: { dataAsset: true }` would hand back another
 *     organisation's asset, and a link would be written onto it).
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
    incident: { findFirst: vi.fn() },
    incidentTask: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    incidentAffectedAsset: { upsert: vi.fn() },
    dataAsset: { count: vi.fn() },
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

const ORG_A = { id: "org-a", name: "Org A", slug: "org-a" };

/** The caller is a legitimate OWNER of org A (passes every role gate). */
function ownerOfOrgA() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-owner-a",
    userId: "user-a",
    organizationId: "org-a",
    role: "OWNER",
    organization: ORG_A,
  });
  return callerFor(incidentRouter, sessionFor("user-a")) as ReturnType<
    typeof incidentRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  // The incident itself always belongs to org A: only the OTHER id is foreign.
  mocks.prisma.incident.findFirst.mockResolvedValue({
    id: "incident-a",
    organizationId: "org-a",
  });
});

describe("incident.createTask cross-organisation assignee", () => {
  it("refuses an assignee who is not a member of the caller's organisation", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.organizationMember.count.mockResolvedValue(0);

    await expect(
      caller.createTask({
        organizationId: "org-a",
        incidentId: "incident-a",
        assigneeId: "user-in-org-b",
        title: "Contain the breach",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.organizationMember.count).toHaveBeenCalledWith({
      where: { organizationId: "org-a", userId: { in: ["user-in-org-b"] } },
    });
    expect(mocks.prisma.incidentTask.create).not.toHaveBeenCalled();
  });

  it("creates the task when the assignee is a member", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    mocks.prisma.incidentTask.create.mockResolvedValue({ id: "task-1" });

    const result = await caller.createTask({
      organizationId: "org-a",
      incidentId: "incident-a",
      assigneeId: "user-in-org-a",
      title: "Contain the breach",
    });

    expect(result).toMatchObject({ id: "task-1" });
    expect(mocks.prisma.incidentTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: "incident-a",
          assigneeId: "user-in-org-a",
        }),
      })
    );
  });

  it("still creates an unassigned task without any membership lookup", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.incidentTask.create.mockResolvedValue({ id: "task-2" });

    await caller.createTask({
      organizationId: "org-a",
      incidentId: "incident-a",
      title: "Unassigned",
    });

    expect(mocks.prisma.organizationMember.count).not.toHaveBeenCalled();
    expect(mocks.prisma.incidentTask.create).toHaveBeenCalled();
  });
});

describe("incident.updateTask cross-organisation assignee", () => {
  beforeEach(() => {
    mocks.prisma.incidentTask.findFirst.mockResolvedValue({
      id: "task-a",
      incidentId: "incident-a",
      incident: { id: "incident-a", organizationId: "org-a" },
    });
  });

  it("refuses an assignee who is not a member of the caller's organisation", async () => {
    const caller = ownerOfOrgA();
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
    expect(mocks.prisma.incidentTask.update).not.toHaveBeenCalled();
  });

  it("updates the task when the assignee is a member", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.organizationMember.count.mockResolvedValue(1);
    mocks.prisma.incidentTask.update.mockResolvedValue({ id: "task-a" });

    const result = await caller.updateTask({
      organizationId: "org-a",
      id: "task-a",
      assigneeId: "user-in-org-a",
    });

    expect(result).toMatchObject({ id: "task-a" });
    expect(mocks.prisma.incidentTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-a" },
        data: expect.objectContaining({ assigneeId: "user-in-org-a" }),
      })
    );
  });

  it("still clears the assignee (null) without any membership lookup", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.incidentTask.update.mockResolvedValue({ id: "task-a" });

    await caller.updateTask({ organizationId: "org-a", id: "task-a", assigneeId: null });

    expect(mocks.prisma.organizationMember.count).not.toHaveBeenCalled();
    expect(mocks.prisma.incidentTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assigneeId: null }) })
    );
  });
});

describe("incident.linkAsset cross-organisation asset", () => {
  it("refuses a data asset that belongs to another organisation", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.dataAsset.count.mockResolvedValue(0);

    await expect(
      caller.linkAsset({
        organizationId: "org-a",
        incidentId: "incident-a",
        dataAssetId: "asset-in-org-b",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.dataAsset.count).toHaveBeenCalledWith({
      where: { id: { in: ["asset-in-org-b"] }, organizationId: "org-a" },
    });
    expect(mocks.prisma.incidentAffectedAsset.upsert).not.toHaveBeenCalled();
  });

  it("links a data asset that belongs to the caller's organisation", async () => {
    const caller = ownerOfOrgA();
    mocks.prisma.dataAsset.count.mockResolvedValue(1);
    mocks.prisma.incidentAffectedAsset.upsert.mockResolvedValue({ id: "link-1" });

    const result = await caller.linkAsset({
      organizationId: "org-a",
      incidentId: "incident-a",
      dataAssetId: "asset-in-org-a",
    });

    expect(result).toMatchObject({ id: "link-1" });
    expect(mocks.prisma.incidentAffectedAsset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          incidentId: "incident-a",
          dataAssetId: "asset-in-org-a",
        }),
      })
    );
  });
});
