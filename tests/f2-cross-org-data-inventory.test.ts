/**
 * Cycle 12, F2: ids taken from input are checked against the caller's
 * organisation before they are attached or returned (data inventory router).
 *
 * The caller is a legitimate OWNER of org A and passes an id that belongs to
 * org B. The org-scoped `count` finds fewer rows than were asked for, so the
 * call is refused as NOT_FOUND and nothing is written. One cross-organisation
 * test per procedure, and the legitimate call still reaches the write.
 *
 * Prisma is module-mocked: we assert on the queries the router issues.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    dataAsset: { count: vi.fn(), findFirst: vi.fn() },
    dataElement: { count: vi.fn() },
    processingActivity: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    processingActivityAsset: { deleteMany: vi.fn(), create: vi.fn() },
    processingActivityAssetElement: { createMany: vi.fn() },
    dataFlow: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    dataTransfer: { create: vi.fn() },
    auditLog: { create: vi.fn() },
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
const SCOPE = { organizationId: ORG };

function ownerOfOrgA() {
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

/** `count` answers as the database would: only ids of org A are found. */
function ownedIds(model: { count: ReturnType<typeof vi.fn> }, owned: string[]) {
  model.count.mockImplementation(
    async ({ where }: { where: { id: { in: string[] }; organizationId?: string } }) =>
      where.organizationId === ORG ? where.id.in.filter((id) => owned.includes(id)).length : 0
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.auditLog.create.mockResolvedValue({});
  ownedIds(mocks.prisma.dataAsset, ["asset-a1", "asset-a2"]);
  ownedIds(mocks.prisma.dataElement, ["element-a1"]);
  ownedIds(mocks.prisma.processingActivity, ["activity-a1"]);
  mocks.prisma.processingActivity.findFirst.mockResolvedValue({ id: "activity-a1", assets: [] });
  mocks.prisma.dataAsset.findFirst.mockResolvedValue({ id: "asset-a1" });
  mocks.prisma.processingActivityAsset.create.mockResolvedValue({ id: "link-1" });
  mocks.prisma.processingActivity.create.mockResolvedValue({ id: "activity-new" });
  mocks.prisma.dataFlow.create.mockResolvedValue({ id: "flow-new" });
  mocks.prisma.dataFlow.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.dataFlow.findFirst.mockResolvedValue({ id: "flow-a1" });
  mocks.prisma.dataFlow.findMany.mockResolvedValue([]);
  mocks.prisma.dataTransfer.create.mockResolvedValue({ id: "transfer-new" });
});

const activityInput = {
  organizationId: ORG,
  name: "Payroll",
  purpose: "Pay staff",
  legalBasis: "CONTRACT" as const,
  dataSubjects: ["Employees"],
  categories: [],
};

describe("dataInventory.createActivity", () => {
  it("refuses an asset of another organisation and creates nothing", async () => {
    await expect(
      ownerOfOrgA().createActivity({ ...activityInput, assetIds: ["asset-a1", "asset-in-org-b"] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.dataAsset.count).toHaveBeenCalledWith({
      where: { id: { in: ["asset-a1", "asset-in-org-b"] }, ...SCOPE },
    });
    expect(mocks.prisma.processingActivity.create).not.toHaveBeenCalled();
  });

  it("still links the organisation's own assets", async () => {
    await ownerOfOrgA().createActivity({ ...activityInput, assetIds: ["asset-a1", "asset-a2"] });
    expect(mocks.prisma.processingActivity.create).toHaveBeenCalledTimes(1);
  });
});

describe("dataInventory.linkAssets", () => {
  it("refuses an asset of another organisation before any link is removed", async () => {
    await expect(
      ownerOfOrgA().linkAssets({
        organizationId: ORG,
        activityId: "activity-a1",
        assets: [{ assetId: "asset-in-org-b" }],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.processingActivityAsset.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.processingActivityAsset.create).not.toHaveBeenCalled();
  });

  it("refuses an element that is not an element of the named asset", async () => {
    await expect(
      ownerOfOrgA().linkAssets({
        organizationId: ORG,
        activityId: "activity-a1",
        assets: [{ assetId: "asset-a1", elementIds: ["element-in-org-b"] }],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.dataElement.count).toHaveBeenCalledWith({
      where: { id: { in: ["element-in-org-b"] }, ...SCOPE, dataAssetId: "asset-a1" },
    });
    expect(mocks.prisma.processingActivityAsset.deleteMany).not.toHaveBeenCalled();
  });

  it("still links the organisation's own asset and element", async () => {
    await ownerOfOrgA().linkAssets({
      organizationId: ORG,
      activityId: "activity-a1",
      assets: [{ assetId: "asset-a1", elementIds: ["element-a1"] }],
    });
    expect(mocks.prisma.processingActivityAsset.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.processingActivityAssetElement.createMany).toHaveBeenCalledTimes(1);
  });
});

describe("dataInventory.linkActivitiesToAsset", () => {
  it("refuses an activity of another organisation: no link is written into its record", async () => {
    await expect(
      ownerOfOrgA().linkActivitiesToAsset({
        organizationId: ORG,
        assetId: "asset-a1",
        activities: [{ activityId: "activity-in-org-b" }],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.prisma.processingActivity.count).toHaveBeenCalledWith({
      where: { id: { in: ["activity-in-org-b"] }, ...SCOPE },
    });
    expect(mocks.prisma.processingActivityAsset.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.processingActivityAsset.create).not.toHaveBeenCalled();
  });

  it("still links the organisation's own activity", async () => {
    await ownerOfOrgA().linkActivitiesToAsset({
      organizationId: ORG,
      assetId: "asset-a1",
      activities: [{ activityId: "activity-a1", elementIds: ["element-a1"] }],
    });
    expect(mocks.prisma.processingActivityAsset.create).toHaveBeenCalledTimes(1);
  });
});

const flowInput = { organizationId: ORG, name: "CRM to warehouse", dataCategories: [] };

describe("dataInventory.createFlow", () => {
  it("refuses a destination asset of another organisation", async () => {
    await expect(
      ownerOfOrgA().createFlow({
        ...flowInput,
        sourceAssetId: "asset-a1",
        destinationAssetId: "asset-in-org-b",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.dataFlow.create).not.toHaveBeenCalled();
  });

  it("still creates a flow between the organisation's own assets", async () => {
    await ownerOfOrgA().createFlow({
      ...flowInput,
      sourceAssetId: "asset-a1",
      destinationAssetId: "asset-a2",
    });
    expect(mocks.prisma.dataFlow.create).toHaveBeenCalledTimes(1);
  });
});

describe("dataInventory.updateFlow", () => {
  it("refuses to re-point a flow at another organisation's asset", async () => {
    await expect(
      ownerOfOrgA().updateFlow({ organizationId: ORG, id: "flow-a1", sourceAssetId: "asset-in-org-b" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.dataFlow.updateMany).not.toHaveBeenCalled();
  });

  it("still updates a flow, with or without a new end", async () => {
    await ownerOfOrgA().updateFlow({ organizationId: ORG, id: "flow-a1", name: "Renamed" });
    await ownerOfOrgA().updateFlow({ organizationId: ORG, id: "flow-a1", sourceAssetId: "asset-a2" });
    expect(mocks.prisma.dataFlow.updateMany).toHaveBeenCalledTimes(2);
  });
});

const transferInput = {
  organizationId: ORG,
  name: "Payroll to processor",
  destinationCountry: "US",
  mechanism: "STANDARD_CONTRACTUAL_CLAUSES" as const,
};

describe("dataInventory.createTransfer", () => {
  it("refuses a processing activity of another organisation", async () => {
    await expect(
      ownerOfOrgA().createTransfer({ ...transferInput, processingActivityId: "activity-in-org-b" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.dataTransfer.create).not.toHaveBeenCalled();
  });

  it("still creates a transfer, with the organisation's own activity or none", async () => {
    await ownerOfOrgA().createTransfer({ ...transferInput, processingActivityId: "activity-a1" });
    await ownerOfOrgA().createTransfer(transferInput);
    expect(mocks.prisma.dataTransfer.create).toHaveBeenCalledTimes(2);
  });
});
