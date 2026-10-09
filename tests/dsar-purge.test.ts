// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request purge (scripts/purge-dsar-data.ts over
 * src/server/services/dsar/purge.ts), prepared for the owner's go and never
 * run by the build:
 *
 *  - a dry run counts every kind of record and deletes nothing;
 *  - a real run deletes children first, in one transaction per organisation,
 *    only for the organisations named, and checks nothing is left;
 *  - an unknown organisation stops the run before anything is deleted;
 *  - the command line needs exactly one of --dry-run / --confirm, a target
 *    (--org or --all), and --confirm needs NEXT_PUBLIC_DSAR_ENABLED=false.
 *
 * Prisma is a hand-made mock; no database is touched.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { purgeDsarData, EMPTY_COUNTS } from "@/server/services/dsar/purge";
import { parsePurgeArgs, refusal } from "../scripts/purge-dsar-data";

const MODELS = [
  "dSARRequest",
  "dSARTask",
  "dSARCommunication",
  "dsarReminder",
  "dSARAuditLog",
  "dSARIntakeForm",
  "auditLog",
  "notification",
] as const;

type Model = (typeof MODELS)[number];

/** Rows per organisation per model; deleteMany empties them. */
let rows: Record<string, Record<Model, number>>;
let deletes: { model: Model; where: unknown }[];

function orgOf(where: Record<string, unknown>): string {
  const w = where as { organizationId?: string; dsarRequest?: { organizationId: string } };
  return w.organizationId ?? w.dsarRequest!.organizationId;
}

function makeDb(orgs: { id: string; slug: string }[]) {
  const model = (name: Model) => ({
    count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows[orgOf(where)]?.[name] ?? 0),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      deletes.push({ model: name, where });
      const org = orgOf(where);
      const count = rows[org]?.[name] ?? 0;
      if (rows[org]) rows[org][name] = 0;
      return { count };
    }),
  });
  const db: Record<string, unknown> = {
    organization: {
      findMany: vi.fn(async ({ where }: { where: { OR?: { id?: { in: string[] }; slug?: { in: string[] } }[] } }) => {
        if (!where.OR) return orgs;
        const wanted = new Set(where.OR.flatMap((c) => c.id?.in ?? c.slug?.in ?? []));
        return orgs.filter((o) => wanted.has(o.id) || wanted.has(o.slug));
      }),
    },
  };
  for (const m of MODELS) db[m] = model(m);
  db.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(db));
  return db as never;
}

const full = (n: number): Record<Model, number> => ({
  dSARRequest: n,
  dSARTask: 2 * n,
  dSARCommunication: 3 * n,
  dsarReminder: n,
  dSARAuditLog: 4 * n,
  dSARIntakeForm: 1,
  auditLog: n,
  notification: n,
});

const ORGS = [
  { id: "org-a", slug: "alpha" },
  { id: "org-b", slug: "beta" },
];

beforeEach(() => {
  rows = { "org-a": full(2), "org-b": full(5) };
  deletes = [];
});

describe("purge: dry run", () => {
  it("counts every kind of record and deletes nothing", async () => {
    const db = makeDb(ORGS);
    const result = await purgeDsarData(db, { organizations: ["alpha"], dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0]).toMatchObject({
      organizationId: "org-a",
      slug: "alpha",
      found: {
        requests: 2,
        tasks: 4,
        communications: 6,
        reminders: 2,
        requestAuditLogs: 8,
        intakeForms: 1,
        auditEntries: 2,
        notifications: 2,
      },
      deleted: EMPTY_COUNTS,
    });
    expect(deletes).toEqual([]);
    expect(rows["org-a"]).toEqual(full(2));
  });

  it("--all covers every organisation and totals them", async () => {
    const result = await purgeDsarData(makeDb(ORGS), { all: true, dryRun: true });
    expect(result.organizations.map((o) => o.slug)).toEqual(["alpha", "beta"]);
    expect(result.totals.found.requests).toBe(7);
    expect(result.totals.deleted).toEqual(EMPTY_COUNTS);
    expect(deletes).toEqual([]);
  });
});

describe("purge: real run", () => {
  it("deletes children first, only for the named organisation, and reports the counts", async () => {
    const db = makeDb(ORGS);
    const result = await purgeDsarData(db, { organizations: ["org-a"], dryRun: false });
    expect(result.organizations[0].deleted).toEqual(result.organizations[0].found);
    expect(Object.values(rows["org-a"]).every((n) => n === 0)).toBe(true);
    expect(rows["org-b"]).toEqual(full(5)); // untouched
    const order = deletes.map((d) => d.model);
    expect(order.indexOf("dSARTask")).toBeLessThan(order.indexOf("dSARRequest"));
    expect(order.indexOf("dSARAuditLog")).toBeLessThan(order.indexOf("dSARRequest"));
    expect(deletes.every((d) => orgOf(d.where as Record<string, unknown>) === "org-a")).toBe(true);
    // Only the general audit entries about requests, only DSAR notifications.
    expect(deletes.find((d) => d.model === "auditLog")!.where).toEqual({
      organizationId: "org-a",
      entityType: "DSARRequest",
    });
    expect(deletes.find((d) => d.model === "notification")!.where).toMatchObject({
      organizationId: "org-a",
      type: { in: ["DSAR_DEADLINE_APPROACHING", "DSAR_DEADLINE_OVERDUE", "DSAR_NEW_REQUEST"] },
    });
  });

  it("an organisation with nothing to delete opens no transaction", async () => {
    rows["org-a"] = Object.fromEntries(MODELS.map((m) => [m, 0])) as Record<Model, number>;
    const db = makeDb(ORGS) as unknown as { $transaction: ReturnType<typeof vi.fn> };
    await purgeDsarData(db as never, { organizations: ["alpha"], dryRun: false });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("an unknown organisation stops the run before anything is read or deleted", async () => {
    await expect(
      purgeDsarData(makeDb(ORGS), { organizations: ["alpha", "nobody"], dryRun: false })
    ).rejects.toThrow(/Unknown organisation\(s\): nobody/);
    expect(deletes).toEqual([]);
  });

  it("refuses to run without a target", async () => {
    await expect(purgeDsarData(makeDb(ORGS), { dryRun: true })).rejects.toThrow(/--org/);
  });
});

describe("purge: command line", () => {
  it("parses the flags", () => {
    expect(parsePurgeArgs(["--dry-run", "--org", "alpha", "--org", "org-b", "--log", "/tmp/x.json"])).toEqual({
      dryRun: true,
      confirm: false,
      all: false,
      organizations: ["alpha", "org-b"],
      logPath: "/tmp/x.json",
    });
    expect(() => parsePurgeArgs(["--org"])).toThrow();
    expect(() => parsePurgeArgs(["--force"])).toThrow(/Unknown argument/);
  });

  it("needs exactly one of --dry-run and --confirm", () => {
    expect(refusal(parsePurgeArgs(["--all"]), {})).toMatch(/exactly one/);
    expect(refusal(parsePurgeArgs(["--all", "--dry-run", "--confirm"]), {})).toMatch(/exactly one/);
  });

  it("needs a target, --org or --all but not both", () => {
    expect(refusal(parsePurgeArgs(["--dry-run"]), {})).toMatch(/--org/);
    expect(refusal(parsePurgeArgs(["--dry-run", "--all", "--org", "a"]), {})).toMatch(/not both/);
  });

  it("a dry run may run with the module on; --confirm needs the module off", () => {
    expect(refusal(parsePurgeArgs(["--dry-run", "--all"]), {})).toBeNull();
    expect(refusal(parsePurgeArgs(["--confirm", "--all"]), {})).toMatch(/NEXT_PUBLIC_DSAR_ENABLED=false/);
    expect(refusal(parsePurgeArgs(["--confirm", "--all"]), { NEXT_PUBLIC_DSAR_ENABLED: "true" })).toMatch(/switch the module off/);
    expect(refusal(parsePurgeArgs(["--confirm", "--org", "a"]), { NEXT_PUBLIC_DSAR_ENABLED: "false" })).toBeNull();
  });
});
