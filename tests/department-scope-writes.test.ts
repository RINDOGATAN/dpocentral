// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Department scope beyond the lists: flows, transfers, elements, the
 * transfer markers, the record export and every write. A member limited to
 * department A must not read, change, delete or link anything of department
 * B (or of no department), must not move a record out of department A, and
 * a new record of theirs lands in department A. An unlimited member is not
 * affected.
 *
 * The real dataInventory router runs over a small in-memory fake whose
 * queries honour the composed `where`, including the relation filters the
 * scope adds (dataAsset / sourceAsset / destinationAsset /
 * processingActivity), so the narrowing is proven on the outcome.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const H = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    dataAsset: [],
    processingActivity: [],
    dataElement: [],
    dataFlow: [],
    dataTransfer: [],
    processingActivityAsset: [],
    vendor: [],
  };
  // relation name -> [table, foreign key]
  const RELATIONS: Record<string, [string, string]> = {
    dataAsset: ["dataAsset", "dataAssetId"],
    sourceAsset: ["dataAsset", "sourceAssetId"],
    destinationAsset: ["dataAsset", "destinationAssetId"],
    processingActivity: ["processingActivity", "processingActivityId"],
  };

  function matches(row: Row, where: unknown): boolean {
    if (!where || typeof where !== "object") return true;
    for (const [key, value] of Object.entries(where as Record<string, unknown>)) {
      if (value === undefined) continue;
      if (key === "AND") {
        if (!(value as unknown[]).every((c) => matches(row, c))) return false;
      } else if (key === "OR") {
        if (!(value as unknown[]).some((c) => matches(row, c))) return false;
      } else if (key in RELATIONS && value && typeof value === "object") {
        const [table, fk] = RELATIONS[key]!;
        const target = tables[table]!.find((r) => r.id === row[fk]);
        if (!target || !matches(target, value)) return false;
      } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        const op = value as Record<string, unknown>;
        if ("in" in op) {
          if (!(op.in as unknown[]).includes(row[key])) return false;
        } else {
          continue;
        }
      } else if (row[key] !== value) {
        return false;
      }
    }
    return true;
  }

  function model(name: string) {
    const rows = () => tables[name]!;
    return {
      findMany: vi.fn(async ({ where }: { where?: Row } = {}) => rows().filter((r) => matches(r, where))),
      findFirst: vi.fn(async ({ where }: { where?: Row } = {}) => rows().find((r) => matches(r, where)) ?? null),
      count: vi.fn(async ({ where }: { where?: Row } = {}) => rows().filter((r) => matches(r, where)).length),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const hit = rows().filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const r = rows().find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        const keep = rows().filter((r) => !matches(r, where));
        const n = rows().length - keep.length;
        tables[name] = keep;
        return { count: n };
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `${name}-${rows().length + 1}`, ...data };
        delete (row as Row).assets;
        rows().push(row);
        return { ...row, assets: [] };
      }),
      createMany: vi.fn(async () => ({ count: 0 })),
    };
  }

  const members: Row[] = [
    { id: "mem-limited", organizationId: "org-a", userId: "user-limited", role: "ADMIN" },
    { id: "mem-all", organizationId: "org-a", userId: "user-all", role: "ADMIN" },
  ];
  const org = { id: "org-a", name: "Org A", slug: "org-a" };

  const prisma: Record<string, unknown> = {
    organizationMember: {
      findUnique: async ({ where }: { where: { organizationId_userId: { userId: string } } }) => {
        const m = members.find((r) => r.userId === where.organizationId_userId.userId);
        return m ? { ...m, organization: org } : null;
      },
    },
    businessUnitMember: {
      findMany: async ({ where }: { where: { memberId: string } }) =>
        where.memberId === "mem-limited" ? [{ businessUnitId: "dept-a" }] : [],
    },
    businessUnit: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        ["dept-a", "dept-b"].includes(where.id) ? { id: where.id } : null,
    },
    auditLog: { create: vi.fn(async () => ({})) },
    processingActivityAssetElement: { createMany: vi.fn(async () => ({ count: 0 })) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  for (const name of Object.keys(tables)) prisma[name] = model(name);

  function reset() {
    tables.dataAsset = [
      { id: "asset-a", organizationId: "org-a", businessUnitId: "dept-a", name: "A" },
      { id: "asset-a2", organizationId: "org-a", businessUnitId: "dept-a", name: "A2" },
      { id: "asset-b", organizationId: "org-a", businessUnitId: "dept-b", name: "B" },
      { id: "asset-none", organizationId: "org-a", businessUnitId: null, name: "None" },
    ];
    tables.processingActivity = [
      { id: "act-a", organizationId: "org-a", businessUnitId: "dept-a", name: "Act A", isActive: true, categories: [], assets: [], transfers: [] },
      { id: "act-b", organizationId: "org-a", businessUnitId: "dept-b", name: "Act B", isActive: true, categories: [], assets: [], transfers: [] },
    ];
    tables.dataElement = [
      { id: "el-a", organizationId: "org-a", dataAssetId: "asset-a", name: "Email" },
      { id: "el-b", organizationId: "org-a", dataAssetId: "asset-b", name: "Salary" },
    ];
    tables.dataFlow = [
      { id: "flow-aa", organizationId: "org-a", sourceAssetId: "asset-a", destinationAssetId: "asset-a2", name: "A to A2", metadata: null },
      { id: "flow-ab", organizationId: "org-a", sourceAssetId: "asset-a", destinationAssetId: "asset-b", name: "A to B", metadata: null },
      { id: "flow-bb", organizationId: "org-a", sourceAssetId: "asset-b", destinationAssetId: "asset-b", name: "B to B", metadata: null },
    ];
    tables.dataTransfer = [
      { id: "tr-a", organizationId: "org-a", processingActivityId: "act-a", name: "To US (A)", destinationCountry: "US", isActive: true, mechanism: "STANDARD_CONTRACTUAL_CLAUSES", assessments: [] },
      { id: "tr-b", organizationId: "org-a", processingActivityId: "act-b", name: "To US (B)", destinationCountry: "US", isActive: true, mechanism: "STANDARD_CONTRACTUAL_CLAUSES", assessments: [] },
      { id: "tr-none", organizationId: "org-a", processingActivityId: null, name: "To IN", destinationCountry: "IN", isActive: true, mechanism: "STANDARD_CONTRACTUAL_CLAUSES", assessments: [] },
    ];
    tables.processingActivityAsset = [
      { id: "link-a", processingActivityId: "act-a", dataAssetId: "asset-a" },
      { id: "link-b-on-a", processingActivityId: "act-b", dataAssetId: "asset-a" },
    ];
  }

  return { prisma, tables, reset };
});

vi.mock("@/lib/prisma", () => ({ default: H.prisma, prisma: H.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/template-items/mark", () => ({ markConfirmed: vi.fn(async () => undefined) }));
vi.mock("@/server/services/licensing/entitlement", () => ({ hasRopaExportAccess: vi.fn(async () => true) }));
vi.mock("@/server/services/data-flows/auto-flows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/services/data-flows/auto-flows")>()),
  syncGeneratedFlows: vi.fn(async () => ({ created: 0, removed: 0 })),
  generateFlowsForActivity: vi.fn(async () => 0),
}));

import { dataInventoryRouter } from "@/server/routers/privacy/dataInventory";
import { callerFor, sessionFor } from "./helpers";

type Caller = ReturnType<typeof dataInventoryRouter.createCaller>;
const limited = () => callerFor(dataInventoryRouter, sessionFor("user-limited")) as Caller;
const unlimited = () => callerFor(dataInventoryRouter, sessionFor("user-all")) as Caller;
const ORG = { organizationId: "org-a" };
const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

beforeEach(() => H.reset());

describe("reads", () => {
  it("listFlows: only flows with both ends in the member's departments", async () => {
    expect(ids(await limited().listFlows(ORG))).toEqual(["flow-aa"]);
    expect(ids(await unlimited().listFlows(ORG))).toEqual(["flow-aa", "flow-ab", "flow-bb"]);
  });

  it("getFlow: another department's flow is not found", async () => {
    await expect(limited().getFlow({ ...ORG, id: "flow-ab" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(limited().getFlow({ ...ORG, id: "flow-aa" })).resolves.toMatchObject({ id: "flow-aa" });
  });

  it("listTransfers and getTransferStats: only transfers of the member's records", async () => {
    expect(ids(await limited().listTransfers(ORG))).toEqual(["tr-a"]);
    expect((await limited().getTransferStats(ORG)).total).toBe(1);
    expect(ids(await unlimited().listTransfers(ORG))).toEqual(["tr-a", "tr-b", "tr-none"]);
  });

  it("getTransferComplianceChecklist: another department's transfer is not found", async () => {
    await expect(
      limited().getTransferComplianceChecklist({ ...ORG, transferId: "tr-b" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getElement: another department's element is not found; links to other departments' records are hidden", async () => {
    await expect(limited().getElement({ ...ORG, id: "el-b" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("mapTransferMarkers reads only the member's systems and transfers", async () => {
    await limited().mapTransferMarkers(ORG);
    const t = H.prisma.dataTransfer as { findMany: { mock: { calls: Array<[{ where: unknown }]> } } };
    expect(t.findMany.mock.calls.at(-1)![0].where).toMatchObject({
      processingActivity: { businessUnitId: { in: ["dept-a"] } },
    });
  });

  it("exportROPA: only the member's records", async () => {
    const rows = await limited().exportROPA(ORG);
    expect(rows.map((r: { name: string }) => r.name)).toEqual(["Act A"]);
  });
});

describe("writes", () => {
  it("updateAsset: another department's system is not found and unchanged", async () => {
    await expect(limited().updateAsset({ ...ORG, id: "asset-b", name: "Hacked" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(H.tables.dataAsset!.find((a) => a.id === "asset-b")!.name).toBe("B");
  });

  it("updateAsset / updateActivity: a record cannot be moved out of the member's departments", async () => {
    await expect(
      limited().updateAsset({ ...ORG, id: "asset-a", businessUnitId: "dept-b" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      limited().updateActivity({ ...ORG, id: "act-a", businessUnitId: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(H.tables.processingActivity!.find((a) => a.id === "act-a")!.businessUnitId).toBe("dept-a");
    // An unlimited member may.
    await unlimited().updateActivity({ ...ORG, id: "act-a", businessUnitId: "dept-b" });
    expect(H.tables.processingActivity!.find((a) => a.id === "act-a")!.businessUnitId).toBe("dept-b");
  });

  it("updateActivity: another department's record is not found", async () => {
    await expect(limited().updateActivity({ ...ORG, id: "act-b", name: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("deleteAsset / deleteActivity / deleteFlow / deleteTransfer: another department's rows stay", async () => {
    await expect(limited().deleteAsset({ ...ORG, id: "asset-b" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(limited().deleteActivity({ ...ORG, id: "act-b" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(limited().deleteFlow({ ...ORG, id: "flow-ab" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(limited().deleteTransfer({ ...ORG, id: "tr-b" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(H.tables.dataAsset!.some((a) => a.id === "asset-b")).toBe(true);
    expect(H.tables.processingActivity!.some((a) => a.id === "act-b")).toBe(true);
    expect(H.tables.dataFlow!.some((f) => f.id === "flow-ab")).toBe(true);
    expect(H.tables.dataTransfer!.some((t) => t.id === "tr-b")).toBe(true);
  });

  it("elements: no add, change or delete on another department's system", async () => {
    await expect(
      limited().addElement({ ...ORG, dataAssetId: "asset-b", name: "x", category: "IDENTIFIERS" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(limited().updateElement({ ...ORG, id: "el-b", name: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(limited().deleteElement({ ...ORG, id: "el-b" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(H.tables.dataElement!.find((e) => e.id === "el-b")!.name).toBe("Salary");
  });

  it("flows: no flow to, or re-pointed at, another department's system", async () => {
    await expect(
      limited().createFlow({
        ...ORG,
        name: "A to B",
        sourceAssetId: "asset-a",
        destinationAssetId: "asset-b",
        dataCategories: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      limited().updateFlow({ ...ORG, id: "flow-aa", destinationAssetId: "asset-b" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(limited().confirmFlow({ ...ORG, id: "flow-bb" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("linkActivitiesToAsset: no link to another department's record, and other departments' links stay", async () => {
    await expect(
      limited().linkActivitiesToAsset({ ...ORG, assetId: "asset-a", activities: [{ activityId: "act-b" }] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Replacing the links of asset-a keeps the link held by department B's record.
    await limited().linkActivitiesToAsset({ ...ORG, assetId: "asset-a", activities: [{ activityId: "act-a" }] });
    expect(H.tables.processingActivityAsset!.some((l) => l.id === "link-b-on-a")).toBe(true);
  });

  it("linkAssets: another department's record or system is not found", async () => {
    await expect(
      limited().linkAssets({ ...ORG, activityId: "act-b", assets: [{ assetId: "asset-a" }] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      limited().linkAssets({ ...ORG, activityId: "act-a", assets: [{ assetId: "asset-b" }] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("transfers: must name one of the member's records", async () => {
    const base = { ...ORG, name: "T", destinationCountry: "US", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" as const };
    await expect(limited().createTransfer(base)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(limited().createTransfer({ ...base, processingActivityId: "act-b" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      limited().updateTransferCompliance({ ...ORG, id: "tr-b", tiaCompleted: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // An unlimited member may record a transfer with no activity.
    await expect(unlimited().createTransfer(base)).resolves.toBeTruthy();
  });

  it("createAsset: a limited member's new system lands in their department; another department is refused", async () => {
    const asset = await limited().createAsset({ ...ORG, name: "New", type: "DATABASE" });
    expect(asset.businessUnitId).toBe("dept-a");
    await expect(
      limited().createAsset({ ...ORG, name: "New B", type: "DATABASE", businessUnitId: "dept-b" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const free = await unlimited().createAsset({ ...ORG, name: "Free", type: "DATABASE" });
    expect(free.businessUnitId ?? null).toBeNull();
  });

  it("createActivity: no link to another department's system", async () => {
    await expect(
      limited().createActivity({
        ...ORG,
        name: "R",
        purpose: "P",
        legalBasis: "CONSENT",
        dataSubjects: [],
        categories: [],
        assetIds: ["asset-b"],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("regenerateFlows: another department's record is not found", async () => {
    await expect(limited().regenerateFlows({ ...ORG, activityId: "act-b" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
