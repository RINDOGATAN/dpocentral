// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * TODO.LAW as a processor in a hosted organisation's programme
 * (src/server/services/todolaw-processor.ts): added as drafts once the
 * agreement's acceptance is on record, never twice, never on the kit; and the
 * one-off backfill reports and writes the same way.
 */

import { describe, expect, it } from "vitest";
import { PILOT_DPA_ACTION } from "@/config/pilot-dpa";
import {
  TODOLAW_LINKS,
  TODOLAW_SOURCE_REF,
  backfillTodoLawProcessor,
  ensureTodoLawProcessor,
} from "@/server/services/todolaw-processor";
import { isDraftRecord } from "@/lib/drafts";

type Row = Record<string, unknown>;

/** A small in-memory stand-in for the Prisma client: only what the service reads and writes. */
function fakeDb(opts: { orgs?: string[]; acceptances?: Row[]; vendors?: Row[] } = {}) {
  const store = {
    organizations: (opts.orgs ?? ["org-1"]).map((id, i) => ({ id, createdAt: new Date(2026, 9, i + 1) })),
    auditLogs: opts.acceptances ?? [],
    vendors: opts.vendors ?? ([] as Row[]),
    contracts: [] as Row[],
    transfers: [] as Row[],
  };
  let seq = 0;
  const db = {
    organization: {
      findMany: async () => store.organizations.map(({ id }) => ({ id })),
    },
    auditLog: {
      findMany: async ({ where }: { where: { organizationId: string; action: string } }) =>
        store.auditLogs
          .filter((e) => e.organizationId === where.organizationId && e.action === where.action)
          .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime()),
    },
    vendor: {
      findFirst: async ({ where }: { where: { organizationId: string } }) =>
        store.vendors.find(
          (v) =>
            v.organizationId === where.organizationId &&
            (v.sourceRef === TODOLAW_SOURCE_REF || String(v.name).toLowerCase() === "todo.law")
        ) ?? null,
      create: async ({ data }: { data: Row }) => {
        const row = { id: `v${++seq}`, ...data };
        store.vendors.push(row);
        return { id: row.id };
      },
    },
    vendorContract: {
      create: async ({ data }: { data: Row }) => {
        store.contracts.push(data);
        return data;
      },
    },
    dataTransfer: {
      create: async ({ data }: { data: Row }) => {
        store.transfers.push(data);
        return data;
      },
    },
    vendorCatalog: {
      findUnique: async () => ({ category: "Privacy & Consent", certifications: [] }),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };
  return { db: db as never, store };
}

const accepted = (organizationId: string, locale: "en" | "es" = "es", version = "1.3") => ({
  organizationId,
  action: PILOT_DPA_ACTION,
  changes: { dpaVersion: version, locale },
  createdAt: new Date("2026-10-20T10:00:00Z"),
});

describe("TODO.LAW in a hosted organisation's programme", () => {
  it("adds the vendor, its agreement and the transfer to the United States, as drafts", async () => {
    const { db, store } = fakeDb({ acceptances: [accepted("org-1", "es")] });
    const result = await ensureTodoLawProcessor(db, "org-1", { hosted: true });
    expect(result.added).toBe(true);

    expect(store.vendors).toHaveLength(1);
    const vendor = store.vendors[0];
    expect(vendor.name).toBe("TODO.LAW");
    expect(vendor.status).toBe("ACTIVE");
    expect(vendor.sourceRef).toBe(TODOLAW_SOURCE_REF);
    expect(isDraftRecord(vendor as { provenance: string })).toBe(true);
    expect(String(vendor.description)).toContain("RINDOGATAN LLC");
    expect(String(vendor.description)).not.toMatch(/[—–]/);

    expect(store.contracts).toHaveLength(1);
    const contract = store.contracts[0];
    expect(contract.type).toBe("DPA");
    expect(contract.status).toBe("ACTIVE");
    expect(String(contract.name)).toContain("1.3");
    expect(contract.documentUrl).toBe(TODOLAW_LINKS.dpa.es);
    expect(contract.startDate).toEqual(new Date("2026-10-20T10:00:00Z"));
    expect(String(contract.description)).toContain(TODOLAW_LINKS.subprocessors.es);

    expect(store.transfers).toHaveLength(1);
    const transfer = store.transfers[0];
    expect(transfer.destinationCountry).toBe("US");
    expect(transfer.mechanism).toBe("STANDARD_CONTRACTUAL_CLAUSES");
    expect(transfer.complianceStatus).toBe("PENDING");
    expect(transfer.documentUrl).toBe(TODOLAW_LINKS.sccs);
    expect(transfer.vendorId).toBe(vendor.id);
    expect(transfer.processingActivityId).toBeUndefined();
    expect(String(transfer.safeguards)).toMatch(/módulo dos/);
  });

  it("writes in the language of the acceptance", async () => {
    const { db, store } = fakeDb({ acceptances: [accepted("org-1", "en")] });
    await ensureTodoLawProcessor(db, "org-1", { hosted: true });
    expect(String(store.transfers[0].name)).toBe("TODO.LAW: access from the United States");
    expect(store.contracts[0].documentUrl).toBe(TODOLAW_LINKS.dpa.en);
  });

  it("never adds it twice, nor next to a vendor already named TODO.LAW", async () => {
    const { db, store } = fakeDb({ acceptances: [accepted("org-1")] });
    await ensureTodoLawProcessor(db, "org-1", { hosted: true });
    expect(await ensureTodoLawProcessor(db, "org-1", { hosted: true })).toEqual({ added: false, reason: "exists" });
    expect(store.vendors).toHaveLength(1);

    const other = fakeDb({
      acceptances: [accepted("org-1")],
      vendors: [{ id: "x", organizationId: "org-1", name: "Todo.law", sourceRef: null }],
    });
    expect(await ensureTodoLawProcessor(other.db, "org-1", { hosted: true })).toEqual({
      added: false,
      reason: "exists",
    });
    expect(other.store.transfers).toHaveLength(0);
  });

  it("does nothing on the self-hosted kit", async () => {
    const { db, store } = fakeDb({ acceptances: [accepted("org-1")] });
    expect(await ensureTodoLawProcessor(db, "org-1", { hosted: false })).toEqual({ added: false, reason: "kit" });
    expect(store.vendors).toHaveLength(0);
  });

  it("waits for an acceptance of the agreement (older than the minimum does not count)", async () => {
    const none = fakeDb();
    expect(await ensureTodoLawProcessor(none.db, "org-1", { hosted: true })).toEqual({
      added: false,
      reason: "no-acceptance",
    });
    const old = fakeDb({ acceptances: [accepted("org-1", "es", "1.0")] });
    expect((await ensureTodoLawProcessor(old.db, "org-1", { hosted: true })).added).toBe(false);
  });
});

describe("the one-off backfill", () => {
  it("reports what it would add without writing, then writes only that", async () => {
    const { db, store } = fakeDb({
      orgs: ["org-a", "org-b", "org-c"],
      acceptances: [accepted("org-a"), accepted("org-b")],
      vendors: [{ id: "x", organizationId: "org-b", name: "TODO.LAW", sourceRef: TODOLAW_SOURCE_REF }],
    });
    const dry = await backfillTodoLawProcessor(db, { execute: false });
    expect(dry).toEqual([
      { organizationId: "org-a", outcome: "add" },
      { organizationId: "org-b", outcome: "exists" },
      { organizationId: "org-c", outcome: "no-acceptance" },
    ]);
    expect(store.vendors).toHaveLength(1);

    const run = await backfillTodoLawProcessor(db, { execute: true });
    expect(run.map((r) => r.outcome)).toEqual(["added", "exists", "no-acceptance"]);
    expect(store.vendors).toHaveLength(2);
    expect(store.transfers).toHaveLength(1);

    const again = await backfillTodoLawProcessor(db, { execute: true });
    expect(again.map((r) => r.outcome)).toEqual(["exists", "exists", "no-acceptance"]);
  });
});
