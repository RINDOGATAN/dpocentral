// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Remove all template items" removes exactly the template-created rows nobody
 * has edited, keeps everything a person touched, and never reaches another
 * organisation's data. Tested against an in-memory Prisma that honours the
 * where-operators the service uses (equality, null, not, in, notIn, OR).
 */

import { describe, expect, it } from "vitest";
import { planTemplateRemoval, removeTemplateItems } from "@/server/services/template-items/remove";

type Row = Record<string, unknown>;

function matchOne(row: Row, key: string, cond: unknown): boolean {
  if (key === "OR") return (cond as Row[]).some((c) => matches(row, c));
  if (cond === null) return row[key] === null || row[key] === undefined;
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>;
    if ("in" in c) return (c.in as unknown[]).includes(row[key]);
    if ("notIn" in c) return !(c.notIn as unknown[]).includes(row[key]);
    if ("not" in c) return c.not === null ? row[key] != null : row[key] !== c.not;
    return true;
  }
  return row[key] === cond;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => matchOne(row, k, v));
}

interface FakeTable {
  findMany: (args?: { where?: Row }) => Promise<Row[]>;
  create: (args: { data: Row }) => Promise<Row>;
  deleteMany: (args?: { where?: Row }) => Promise<{ count: number }>;
  __rows: () => Row[];
}

function table(): FakeTable {
  let rows: Row[] = [];
  return {
    findMany: async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)),
    create: async ({ data }: { data: Row }) => {
      rows.push({ ...data });
      return { ...data };
    },
    deleteMany: async ({ where }: { where?: Row } = {}) => {
      const before = rows.length;
      rows = rows.filter((r) => !matches(r, where));
      return { count: before - rows.length };
    },
    __rows: () => rows,
  };
}

function makePrisma() {
  const tables = {
    processingActivity: table(),
    vendor: table(),
    dataAsset: table(),
    assessment: table(),
    dataTransfer: table(),
    vendorContract: table(),
    vendorReview: table(),
    vendorQuestionnaireResponse: table(),
    aISystem: table(),
    incidentAffectedAsset: table(),
    dSARTask: table(),
    dataFlow: table(),
    processingActivityAsset: table(),
    auditLog: table(),
  };
  return Object.assign(tables, {
    $transaction: async (fn: (tx: typeof tables) => Promise<unknown>) => fn(tables),
  });
}

const ORG = "o1";
const OTHER = "o2";
const T = { provenance: "AUTO_TEMPLATE" as const, confirmedAt: null as Date | null };

function seed() {
  const p = makePrisma();

  // Processing activities ----------------------------------------------------
  p.processingActivity.create({ data: { id: "paA", organizationId: ORG, ...T } }); // removable
  p.processingActivity.create({ data: { id: "paB", organizationId: ORG, provenance: "AUTO_TEMPLATE", confirmedAt: new Date() } }); // edited → not a candidate
  p.processingActivity.create({ data: { id: "paC", organizationId: ORG, provenance: "USER_ENTERED", confirmedAt: null } }); // not template
  p.processingActivity.create({ data: { id: "paD", organizationId: ORG, ...T } }); // kept: submitted assessment
  p.processingActivity.create({ data: { id: "paO2", organizationId: OTHER, ...T } }); // other org
  p.assessment.create({ data: { id: "asD", organizationId: ORG, processingActivityId: "paD", status: "IN_PROGRESS" } });
  p.assessment.create({ data: { id: "asA", organizationId: ORG, processingActivityId: "paA", status: "DRAFT" } }); // draft doesn't protect

  // Vendors ------------------------------------------------------------------
  p.vendor.create({ data: { id: "venA", organizationId: ORG, ...T } }); // removable
  p.vendor.create({ data: { id: "venB", organizationId: ORG, ...T } }); // kept: has a contract
  p.vendor.create({ data: { id: "venC", organizationId: ORG, ...T } }); // kept: has a completed-ish review
  p.vendor.create({ data: { id: "venD", organizationId: ORG, ...T } }); // kept: linked AI system
  p.vendorContract.create({ data: { id: "kB", vendorId: "venB" } });
  p.vendorReview.create({ data: { id: "rC", vendorId: "venC" } });
  p.aISystem.create({ data: { id: "sysD", vendorId: "venD" } });

  // Data assets --------------------------------------------------------------
  p.dataAsset.create({ data: { id: "daA", organizationId: ORG, ...T } }); // removable
  p.dataAsset.create({ data: { id: "daB", organizationId: ORG, ...T } }); // kept: used in a data flow
  p.dataAsset.create({ data: { id: "daC", organizationId: ORG, ...T } }); // kept: linked to a KEPT activity (paD)
  p.dataFlow.create({ data: { id: "flowB", sourceAssetId: "daB", destinationAssetId: "x" } });
  p.processingActivityAsset.create({ data: { id: "linkC", dataAssetId: "daC", processingActivityId: "paD" } });
  // daA links only to a REMOVED activity (paA) → not protected.
  p.processingActivityAsset.create({ data: { id: "linkA", dataAssetId: "daA", processingActivityId: "paA" } });

  return p;
}

describe("planTemplateRemoval", () => {
  it("splits template items into remove vs keep by the edited/used signal", async () => {
    const p = seed();
    const plan = await planTemplateRemoval(p as never, ORG);

    expect(plan.removeIds.processingActivities).toEqual(["paA"]);
    expect(plan.processingActivities).toEqual({ remove: 1, keep: 1 }); // paD kept

    expect(plan.removeIds.vendors).toEqual(["venA"]);
    expect(plan.vendors).toEqual({ remove: 1, keep: 3 }); // venB, venC, venD kept

    expect(plan.removeIds.dataAssets).toEqual(["daA"]);
    expect(plan.dataAssets).toEqual({ remove: 1, keep: 2 }); // daB, daC kept

    expect(plan.totalRemove).toBe(3);
  });
});

describe("removeTemplateItems", () => {
  it("removes only the unedited template rows and records it", async () => {
    const p = seed();
    const res = await removeTemplateItems(p as never, { organizationId: ORG, userId: "u1" });
    expect(res).toEqual({ vendors: 1, dataAssets: 1, processingActivities: 1, total: 3 });

    expect(p.processingActivity.__rows().map((r) => r.id)).not.toContain("paA");
    expect(p.processingActivity.__rows().map((r) => r.id)).toContain("paD");
    expect(p.processingActivity.__rows().map((r) => r.id)).toContain("paO2"); // other org untouched

    expect(p.vendor.__rows().map((r) => r.id)).not.toContain("venA");
    expect(p.vendor.__rows().map((r) => r.id)).toEqual(expect.arrayContaining(["venB", "venC", "venD"]));

    expect(p.dataAsset.__rows().map((r) => r.id)).not.toContain("daA");
    expect(p.dataAsset.__rows().map((r) => r.id)).toEqual(expect.arrayContaining(["daB", "daC"]));

    const audit = p.auditLog.__rows();
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("DELETE_TEMPLATE_ITEMS");
  });

  it("does nothing and writes only an audit row when there is nothing to remove", async () => {
    const p = makePrisma();
    p.vendor.create({ data: { id: "u", organizationId: ORG, provenance: "USER_ENTERED", confirmedAt: null } });
    const res = await removeTemplateItems(p as never, { organizationId: ORG, userId: "u1" });
    expect(res.total).toBe(0);
    expect(p.vendor.__rows().map((r) => r.id)).toContain("u");
    expect(p.auditLog.__rows()).toHaveLength(1);
  });
});
