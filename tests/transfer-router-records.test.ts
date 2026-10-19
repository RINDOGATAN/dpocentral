// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The data inventory router's transfer and flow writes:
 *   - a transfer's destination is stored as an ISO code (UK -> GB), a name
 *     is refused, the vendor and activity must be the organisation's, the
 *     partial-adequacy answer is stored with the date it was given, and the
 *     creation is in the audit trail;
 *   - a transfer's page shows the recorded status, with the rules' result
 *     only as a suggestion;
 *   - a flow from a system to itself is refused, and a new flow over a
 *     generated draft between the same systems takes the draft over.
 *
 * Prisma is module-mocked: we assert on the queries the router issues.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    dataAsset: { count: vi.fn() },
    processingActivity: { count: vi.fn() },
    vendor: { count: vi.fn() },
    dataFlow: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    dataTransfer: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    businessUnitMember: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { dataInventoryRouter } from "@/server/routers/privacy/dataInventory";
import { callerFor, sessionFor } from "./helpers";

const ORG = "org-a";

function owner() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-owner-a",
    userId: "user-a",
    organizationId: ORG,
    role: "OWNER",
    organization: { id: ORG, name: "Org A", slug: "org-a" },
  });
  return callerFor(dataInventoryRouter, sessionFor("user-a")) as ReturnType<
    typeof dataInventoryRouter.createCaller
  >;
}

function ownedIds(model: { count: ReturnType<typeof vi.fn> }, owned: string[]) {
  model.count.mockImplementation(
    async ({ where }: { where: { id: { in: string[] }; organizationId?: string } }) =>
      where.organizationId === ORG ? where.id.in.filter((id) => owned.includes(id)).length : 0
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  ownedIds(mocks.prisma.dataAsset, ["a1", "a2"]);
  ownedIds(mocks.prisma.processingActivity, ["act-1"]);
  ownedIds(mocks.prisma.vendor, ["ven-1"]);
  mocks.prisma.dataTransfer.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "t-new",
    ...data,
  }));
  mocks.prisma.dataFlow.create.mockResolvedValue({ id: "flow-new" });
  mocks.prisma.dataFlow.update.mockResolvedValue({ id: "draft-1" });
  mocks.prisma.dataFlow.findMany.mockResolvedValue([]);
});

const base = {
  organizationId: ORG,
  name: "Customer data to the US",
  mechanism: "STANDARD_CONTRACTUAL_CLAUSES" as const,
};

describe("createTransfer", () => {
  it("stores the UK as GB and refuses a country name", async () => {
    await owner().createTransfer({ ...base, destinationCountry: " uk " });
    expect(mocks.prisma.dataTransfer.create.mock.calls[0]![0].data.destinationCountry).toBe("GB");
    await expect(owner().createTransfer({ ...base, destinationCountry: "India" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(owner().createTransfer({ ...base, destinationCountry: "EU" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("links the organisation's own vendor and activity, refuses another's", async () => {
    await owner().createTransfer({ ...base, destinationCountry: "US", vendorId: "ven-1", processingActivityId: "act-1" });
    const data = mocks.prisma.dataTransfer.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ vendorId: "ven-1", processingActivityId: "act-1" });
    await expect(
      owner().createTransfer({ ...base, destinationCountry: "US", vendorId: "ven-of-org-b" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stores the partial-adequacy answer with its date, and writes an audit entry", async () => {
    await owner().createTransfer({
      ...base,
      destinationCountry: "US",
      mechanism: "ADEQUACY_DECISION",
      adequacyScopeConfirmed: true,
      adequacyScopeReference: "DPF list entry checked",
    });
    const data = mocks.prisma.dataTransfer.create.mock.calls[0]![0].data;
    expect(data.adequacyScopeConfirmed).toBe(true);
    expect(data.adequacyScopeReference).toBe("DPF list entry checked");
    expect(data.adequacyScopeCheckedAt).toBeInstanceOf(Date);
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityType: "DataTransfer", action: "CREATE" }) })
    );
  });
});

describe("getTransferComplianceChecklist", () => {
  it("returns the recorded status (none) and the rules' result as a suggestion", async () => {
    mocks.prisma.dataTransfer.findFirst.mockResolvedValue({
      id: "t1",
      name: "US",
      destinationCountry: "US",
      destinationOrg: null,
      mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
      complianceStatus: null,
      sccExpiryDate: null,
      tiaCompleted: false,
      supplementaryMeasures: null,
      safeguards: null,
      processingActivityId: null,
      processingActivity: null,
      vendorId: null,
      vendor: null,
      adequacyScopeConfirmed: null,
      adequacyScopeReference: null,
      adequacyScopeCheckedAt: null,
      assessments: [],
    });
    const r = await owner().getTransferComplianceChecklist({ organizationId: ORG, transferId: "t1" });
    expect(r.transfer.complianceStatus).toBeNull();
    expect(r.transfer.suggestedStatus).toBe("NEEDS_REVIEW");
    expect(r.isAdequateCountry).toBe(false);
    expect(r.adequacyCoverage).toBe("PARTIAL_UNCONFIRMED");
    // Not covered by the decision: the Schrems II checklist applies.
    expect(r.checklist.length).toBeGreaterThan(0);
  });
});

describe("createFlow", () => {
  const flowInput = { organizationId: ORG, name: "Sync", dataCategories: [] };

  it("refuses a flow from a system to itself", async () => {
    await expect(
      owner().createFlow({ ...flowInput, sourceAssetId: "a1", destinationAssetId: "a1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.dataFlow.create).not.toHaveBeenCalled();
  });

  it("takes over a generated draft between the same two systems instead of adding a second flow", async () => {
    mocks.prisma.dataFlow.findMany.mockResolvedValue([
      { id: "draft-1", metadata: { autoGenerated: true, activityId: "act-1" } },
    ]);
    await owner().createFlow({ ...flowInput, sourceAssetId: "a1", destinationAssetId: "a2" });
    expect(mocks.prisma.dataFlow.create).not.toHaveBeenCalled();
    const call = mocks.prisma.dataFlow.update.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "draft-1" });
    expect(call.data.metadata).toMatchObject({ autoGenerated: false, editedFromGenerated: true });
  });

  it("creates a new flow when no draft joins the two systems", async () => {
    mocks.prisma.dataFlow.findMany.mockResolvedValue([{ id: "mine", metadata: null }]);
    await owner().createFlow({ ...flowInput, sourceAssetId: "a1", destinationAssetId: "a2" });
    expect(mocks.prisma.dataFlow.create).toHaveBeenCalledTimes(1);
  });
});
