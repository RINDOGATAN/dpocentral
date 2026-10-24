// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Our own records never use the customer's pilot allowances: the TODO.LAW
 * vendor the hosted service adds (sourceRef "todo-law"), its contract and its
 * transfer are left out of the vendor, contract and transfer counts
 * (src/server/services/pilot/caps.ts).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { PILOT_LIMITS, hasPilotRoom, type PilotDb } from "@/server/services/pilot/caps";
import { TODOLAW_SOURCE_REF } from "@/lib/todolaw-source";

type Row = Record<string, unknown>;

/** Evaluates the small subset of Prisma `where` the counters use. */
function matches(row: Row | null | undefined, where: Row): boolean {
  if (!row) return false;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((w) => matches(row, w));
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as Row;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("not" in c) return value !== null && value !== undefined && value !== c.not;
      return matches(value as Row, c); // relation
    }
    return value === cond;
  });
}

function fakeDb(rows: { vendors: Row[]; contracts: Row[]; transfers: Row[] }): PilotDb {
  const counter = (list: Row[]) => ({
    count: async ({ where }: { where: object }) => list.filter((r) => matches(r, where as Row)).length,
  });
  const zero = { count: async () => 0 };
  return {
    dataAsset: zero,
    dataElement: zero,
    processingActivity: zero,
    dataFlow: zero,
    dataTransfer: counter(rows.transfers),
    vendor: counter(rows.vendors),
    vendorContract: counter(rows.contracts),
    dSARRequest: zero,
    assessment: zero,
    assessmentTemplate: zero,
    incident: zero,
    aISystem: zero,
    organizationMember: zero,
  } as unknown as PilotDb;
}

afterEach(() => vi.unstubAllEnvs());

describe("the TODO.LAW records and the pilot allowances", () => {
  const org = { id: "org-1", billingOwnerId: null };
  const ours = { organizationId: "org-1", sourceRef: TODOLAW_SOURCE_REF };

  /** A pilot organisation one record short of each ceiling, plus the TODO.LAW records. */
  function atCeilingMinusOne() {
    const theirs = (n: number, extra: Row = {}) =>
      Array.from({ length: n }, (_, i) => ({ organizationId: "org-1", sourceRef: i % 2 ? null : "quickstart", ...extra }));
    const vendors = [...theirs(PILOT_LIMITS.vendors - 1), ours];
    return fakeDb({
      vendors,
      contracts: [
        ...theirs(PILOT_LIMITS.vendorContracts - 1).map((v) => ({ vendor: v })),
        { vendor: ours },
      ],
      transfers: [
        ...theirs(PILOT_LIMITS.dataTransfers - 2).map((v) => ({ organizationId: "org-1", vendorId: "v", vendor: v })),
        { organizationId: "org-1", vendorId: null, vendor: null },
        { organizationId: "org-1", vendorId: "todo", vendor: ours },
      ],
    });
  }

  it("leaves one place for the customer when only our records would fill it", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const db = atCeilingMinusOne();
    expect(await hasPilotRoom(db, org, "vendors")).toBe(true);
    expect(await hasPilotRoom(db, org, "vendorContracts")).toBe(true);
    expect(await hasPilotRoom(db, org, "dataTransfers")).toBe(true);
  });

  it("still counts every record of the customer's own, including transfers with no vendor", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const theirs = (n: number) => Array.from({ length: n }, () => ({ organizationId: "org-1", sourceRef: null }));
    const db = fakeDb({
      vendors: [...theirs(PILOT_LIMITS.vendors), ours],
      contracts: theirs(PILOT_LIMITS.vendorContracts).map((v) => ({ vendor: v })),
      transfers: Array.from({ length: PILOT_LIMITS.dataTransfers }, () => ({
        organizationId: "org-1",
        vendorId: null,
        vendor: null,
      })),
    });
    expect(await hasPilotRoom(db, org, "vendors")).toBe(false);
    expect(await hasPilotRoom(db, org, "vendorContracts")).toBe(false);
    expect(await hasPilotRoom(db, org, "dataTransfers")).toBe(false);
  });
});
