// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one-off redaction of requester details left in older rights-request
 * audit entries (scripts/redact-dsar-audit-requester.ts over
 * src/server/services/dsar/audit-requester-redaction.ts):
 *
 *  - only the requester keys are replaced with the marker; action, ids,
 *    dates and every other key stay;
 *  - only rights-request entries are touched, never another entity type;
 *  - a second run finds nothing;
 *  - a dry run writes nothing, and its result names fields, never values;
 *  - --all also covers entries whose organisation was deleted;
 *  - one transaction per organisation, with the long timeout;
 *  - the command line needs exactly one of --dry-run / --confirm and a target.
 *
 * Prisma is an in-memory fake; no database is touched.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  redactDsarAuditRequester,
  requesterKeysIn,
  REMOVED_MARKER,
  REDACTION_TX_OPTIONS,
} from "@/server/services/dsar/audit-requester-redaction";
import { parseRedactArgs, refusal } from "../scripts/redact-dsar-audit-requester";
import { withholdRightsRequestDetail } from "@/lib/audit-access";

type Obj = Record<string, unknown>;

interface AuditRow {
  id: string;
  organizationId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  changes: Obj | null;
  metadata: Obj | null;
  createdAt: Date;
}

interface TrailRow {
  id: string;
  dsarRequestId: string;
  action: string;
  performedBy: string | null;
  details: Obj | null;
  createdAt: Date;
}

const OLD_FORM = {
  organizationId: "org-a",
  type: "ACCESS",
  requesterName: "Jane Example",
  requesterEmail: "jane@example.test",
  requesterPhone: "+34 600 000 000",
  requesterAddress: "1 Example Street",
  relationship: "Customer",
  description: "Everything you hold on me",
  requestedData: "Orders",
};

let audit: AuditRow[];
let trail: TrailRow[];
const REQUEST_ORG: Record<string, string> = { "req-a1": "org-a", "req-a2": "org-a", "req-b1": "org-b" };
let writes: number;

const at = new Date("2026-03-01T10:00:00Z");

function seed() {
  audit = [
    // Older staff-entry creation: the whole form.
    { id: "a1", organizationId: "org-a", userId: "u1", entityType: "DSARRequest", entityId: "req-a1", action: "CREATE", changes: { ...OLD_FORM }, metadata: null, createdAt: at },
    // Current shape: type and reference only.
    { id: "a2", organizationId: "org-a", userId: "u1", entityType: "DSARRequest", entityId: "req-a2", action: "CREATE", changes: { type: "ACCESS", requestId: "pub-2" }, metadata: null, createdAt: at },
    // Already cleared by a per-request redaction.
    { id: "a3", organizationId: "org-a", userId: "u1", entityType: "DSARRequest", entityId: "req-x", action: "CREATE", changes: { redacted: true }, metadata: null, createdAt: at },
    // Another entity type that happens to carry the same key names: never touched.
    { id: "a4", organizationId: "org-a", userId: "u1", entityType: "DataAsset", entityId: "asset-1", action: "CREATE", changes: { description: "CRM", requesterName: "not a request" }, metadata: null, createdAt: at },
    { id: "a5", organizationId: "org-a", userId: "u1", entityType: "DSARIntakeForm", entityId: "form-1", action: "DSAR_INTAKE_ACTIVATED", changes: { isActive: true }, metadata: null, createdAt: at },
    // Metadata carrying a requester key, with a partly null form.
    { id: "a6", organizationId: "org-a", userId: null, entityType: "DSARRequest", entityId: "req-a2", action: "UPDATE", changes: { requesterPhone: null, status: "CLOSED" }, metadata: { requesterEmail: "x@example.test", source: "import" }, createdAt: at },
    // Second organisation.
    { id: "b1", organizationId: "org-b", userId: "u2", entityType: "DSARRequest", entityId: "req-b1", action: "CREATE", changes: { ...OLD_FORM, organizationId: "org-b" }, metadata: null, createdAt: at },
    // Organisation deleted before the trail was removed with it.
    { id: "n1", organizationId: null, userId: null, entityType: "DSARRequest", entityId: "req-gone", action: "CREATE", changes: { ...OLD_FORM }, metadata: null, createdAt: at },
  ];
  trail = [
    { id: "t1", dsarRequestId: "req-a1", action: "REQUEST_CREATED", performedBy: "u1", details: { type: "ACCESS", requesterEmail: "jane@example.test" }, createdAt: at },
    { id: "t2", dsarRequestId: "req-a1", action: "STATUS_CHANGED", performedBy: "u1", details: { from: "SUBMITTED", to: "IN_PROGRESS", notes: "called back" }, createdAt: at },
    { id: "t3", dsarRequestId: "req-b1", action: "REQUEST_CREATED", performedBy: "u2", details: { type: "ERASURE", requesterEmail: "b@example.test" }, createdAt: at },
  ];
  writes = 0;
}

function matches(row: AuditRow, where: Obj): boolean {
  if ("id" in where && row.id !== where.id) return false;
  if ("organizationId" in where && row.organizationId !== where.organizationId) return false;
  if ("entityType" in where && row.entityType !== where.entityType) return false;
  return true;
}

function trailMatches(row: TrailRow, where: Obj): boolean {
  if ("id" in where && row.id !== where.id) return false;
  const org = (where.dsarRequest as { organizationId?: string } | undefined)?.organizationId;
  if (org !== undefined && REQUEST_ORG[row.dsarRequestId] !== org) return false;
  return true;
}

function pick<T extends Obj>(row: T, select: Obj): Obj {
  return Object.fromEntries(Object.keys(select).map((k) => [k, structuredClone(row[k])]));
}

const ORGS = [
  { id: "org-a", slug: "alpha" },
  { id: "org-b", slug: "beta" },
];

function makeDb() {
  const db = {
    organization: {
      findMany: vi.fn(async ({ where }: { where: { OR?: { id?: { in: string[] }; slug?: { in: string[] } }[] } }) => {
        if (!where.OR) return ORGS;
        const wanted = new Set(where.OR.flatMap((c) => c.id?.in ?? c.slug?.in ?? []));
        return ORGS.filter((o) => wanted.has(o.id) || wanted.has(o.slug));
      }),
    },
    auditLog: {
      findMany: vi.fn(async ({ where, select }: { where: Obj; select: Obj }) =>
        audit.filter((r) => matches(r, where)).map((r) => pick(r as unknown as Obj, select))
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Obj; data: Obj }) => {
        let count = 0;
        for (const r of audit) {
          if (!matches(r, where)) continue;
          Object.assign(r, structuredClone(data));
          count++;
          writes++;
        }
        return { count };
      }),
    },
    dSARAuditLog: {
      findMany: vi.fn(async ({ where, select }: { where: Obj; select: Obj }) =>
        trail.filter((r) => trailMatches(r, where)).map((r) => pick(r as unknown as Obj, select))
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Obj; data: Obj }) => {
        let count = 0;
        for (const r of trail) {
          if (!trailMatches(r, where)) continue;
          Object.assign(r, structuredClone(data));
          count++;
          writes++;
        }
        return { count };
      }),
    },
    // The options are read from mock.calls by the timeout test.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown, opts?: unknown) => (void opts, fn(db))),
  };
  return db;
}

const row = (id: string) => audit.find((r) => r.id === id)!;
const entry = (id: string) => trail.find((r) => r.id === id)!;

beforeEach(seed);

describe("redaction: real run", () => {
  it("replaces only the requester keys, keeping the entry's shape", async () => {
    const before = structuredClone(row("a1"));
    await redactDsarAuditRequester(makeDb() as never, { organizations: ["alpha"], dryRun: false });
    const after = row("a1");
    expect(after.changes).toEqual({
      organizationId: "org-a",
      type: "ACCESS",
      requesterName: REMOVED_MARKER,
      requesterEmail: REMOVED_MARKER,
      requesterPhone: REMOVED_MARKER,
      requesterAddress: REMOVED_MARKER,
      relationship: REMOVED_MARKER,
      description: REMOVED_MARKER,
      requestedData: REMOVED_MARKER,
    });
    // Action, ids, actor and date unchanged.
    expect({ ...after, changes: null }).toEqual({ ...before, changes: null });

    // Metadata too; null values and other keys stay as they were.
    expect(row("a6").changes).toEqual({ requesterPhone: null, status: "CLOSED" });
    expect(row("a6").metadata).toEqual({ requesterEmail: REMOVED_MARKER, source: "import" });

    // The request's own trail: the e-mail goes, the rest stays.
    expect(entry("t1").details).toEqual({ type: "ACCESS", requesterEmail: REMOVED_MARKER });
    expect(entry("t1").action).toBe("REQUEST_CREATED");
  });

  it("leaves other entity types, entries without requester data and other organisations untouched", async () => {
    const untouched = structuredClone([row("a2"), row("a3"), row("a4"), row("a5"), row("b1"), row("n1")]);
    const untouchedTrail = structuredClone([entry("t2"), entry("t3")]);
    const result = await redactDsarAuditRequester(makeDb() as never, { organizations: ["org-a"], dryRun: false });
    expect([row("a2"), row("a3"), row("a4"), row("a5"), row("b1"), row("n1")]).toEqual(untouched);
    expect([entry("t2"), entry("t3")]).toEqual(untouchedTrail);
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0]).toMatchObject({
      organizationId: "org-a",
      auditLog: { rows: 2, rowIds: ["a1", "a6"] },
      requestTrail: { rows: 1, rowIds: ["t1"] },
      redacted: 3,
    });
  });

  it("only reads rights-request entries of the general trail", async () => {
    const db = makeDb();
    await redactDsarAuditRequester(db as never, { all: true, dryRun: false });
    for (const call of db.auditLog.findMany.mock.calls) {
      expect(call[0].where.entityType).toBe("DSARRequest");
    }
    for (const call of db.auditLog.updateMany.mock.calls) {
      expect(call[0].where.entityType).toBe("DSARRequest");
    }
  });

  it("--all covers every organisation and the entries of deleted ones", async () => {
    const result = await redactDsarAuditRequester(makeDb() as never, { all: true, dryRun: false });
    expect(result.organizations.map((o) => o.organizationId)).toEqual(["org-a", "org-b", null]);
    expect(row("b1").changes!.requesterName).toBe(REMOVED_MARKER);
    expect(row("n1").changes!.requesterEmail).toBe(REMOVED_MARKER);
    expect(entry("t3").details!.requesterEmail).toBe(REMOVED_MARKER);
    expect(result.totals).toMatchObject({ rows: 6, redacted: 6 });
  });

  it("is idempotent: a second run finds nothing and writes nothing", async () => {
    await redactDsarAuditRequester(makeDb() as never, { all: true, dryRun: false });
    const snapshot = structuredClone({ audit, trail });
    writes = 0;
    const db = makeDb();
    const again = await redactDsarAuditRequester(db as never, { all: true, dryRun: false });
    expect(again.totals).toEqual({ rows: 0, redacted: 0, fields: {} });
    expect(writes).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect({ audit, trail }).toEqual(snapshot);
  });

  it("one transaction per organisation with something to write, with the long timeout", async () => {
    const db = makeDb();
    await redactDsarAuditRequester(db as never, { all: true, dryRun: false });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
    for (const call of db.$transaction.mock.calls) {
      expect(call[1]).toEqual({ maxWait: 20_000, timeout: 120_000 });
    }
    expect(REDACTION_TX_OPTIONS).toEqual({ maxWait: 20_000, timeout: 120_000 });
  });

  it("rolls the organisation back when the rows written differ from the rows planned", async () => {
    const db = makeDb();
    db.auditLog.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      redactDsarAuditRequester(db as never, { organizations: ["alpha"], dryRun: false })
    ).rejects.toThrow(/planned.*Rolled back/);
  });
});

describe("redaction: dry run", () => {
  it("writes nothing and reports field names and counts, never values", async () => {
    const snapshot = structuredClone({ audit, trail });
    const db = makeDb();
    const result = await redactDsarAuditRequester(db as never, { all: true, dryRun: true });
    expect({ audit, trail }).toEqual(snapshot);
    expect(db.auditLog.updateMany).not.toHaveBeenCalled();
    expect(db.dSARAuditLog.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();

    const a = result.organizations.find((o) => o.organizationId === "org-a")!;
    expect(a.auditLog.fields).toEqual({
      "changes.requesterName": 1,
      "changes.requesterEmail": 1,
      "changes.requesterPhone": 1,
      "changes.requesterAddress": 1,
      "changes.relationship": 1,
      "changes.description": 1,
      "changes.requestedData": 1,
      "metadata.requesterEmail": 1,
    });
    expect(a.requestTrail.fields).toEqual({ "details.requesterEmail": 1 });
    expect(a.redacted).toBe(0);
    expect(result.totals.rows).toBe(6);
    expect(result.totals.fields["changes.requesterName"]).toBe(3);

    const text = JSON.stringify(result);
    for (const value of [OLD_FORM.requesterName, OLD_FORM.requesterEmail, OLD_FORM.requesterPhone, OLD_FORM.requesterAddress, OLD_FORM.description, "b@example.test", "x@example.test"]) {
      expect(text).not.toContain(value);
    }
  });

  it("an unknown organisation stops the run before anything is written", async () => {
    await expect(
      redactDsarAuditRequester(makeDb() as never, { organizations: ["alpha", "nobody"], dryRun: false })
    ).rejects.toThrow(/Unknown organization\(s\): nobody/);
    expect(writes).toBe(0);
  });

  it("refuses to run without a target", async () => {
    await expect(redactDsarAuditRequester(makeDb() as never, { dryRun: true })).rejects.toThrow(/--org/);
  });
});

describe("requesterKeysIn", () => {
  it("ignores non-objects, null values and the marker", () => {
    expect(requesterKeysIn(null)).toEqual([]);
    expect(requesterKeysIn(["requesterName"])).toEqual([]);
    expect(requesterKeysIn("requesterName")).toEqual([]);
    expect(requesterKeysIn({ requesterName: REMOVED_MARKER, requesterEmail: null, type: "ACCESS" })).toEqual([]);
    expect(requesterKeysIn({ requesterName: "", requesterEmail: "a@b" })).toEqual(["requesterName", "requesterEmail"]);
  });
});

describe("redaction: command line", () => {
  it("parses the flags", () => {
    expect(parseRedactArgs(["--dry-run", "--org", "alpha", "--org", "org-b", "--log", "/tmp/x.json"])).toEqual({
      dryRun: true,
      confirm: false,
      all: false,
      organizations: ["alpha", "org-b"],
      logPath: "/tmp/x.json",
    });
    expect(() => parseRedactArgs(["--org"])).toThrow();
    expect(() => parseRedactArgs(["--force"])).toThrow(/Unknown argument/);
  });

  it("refuses without exactly one mode flag", () => {
    expect(refusal(parseRedactArgs(["--all"]))).toMatch(/exactly one/);
    expect(refusal(parseRedactArgs(["--all", "--dry-run", "--confirm"]))).toMatch(/exactly one/);
  });

  it("needs a target, --org or --all but not both", () => {
    expect(refusal(parseRedactArgs(["--dry-run"]))).toMatch(/--org/);
    expect(refusal(parseRedactArgs(["--dry-run", "--all", "--org", "a"]))).toMatch(/not both/);
    expect(refusal(parseRedactArgs(["--dry-run", "--all"]))).toBeNull();
    expect(refusal(parseRedactArgs(["--confirm", "--org", "a"]))).toBeNull();
  });
});

describe("platform operators' audit views", () => {
  it("withhold the detail of rights-request entries only", () => {
    expect(withholdRightsRequestDetail({ id: "1", entityType: "DSARRequest", changes: OLD_FORM, metadata: { a: 1 } })).toEqual({
      id: "1",
      entityType: "DSARRequest",
      changes: null,
      metadata: null,
    });
    const other = { id: "2", entityType: "DataAsset", changes: { name: "CRM" }, metadata: null };
    expect(withholdRightsRequestDetail(other)).toBe(other);
  });
});
