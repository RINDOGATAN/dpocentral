// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one-off recalculation of the notification flag and deadline on stored
 * incidents (scripts/recalculate-incident-notifications.ts): same rule as the
 * incident router, dry run writes nothing, --execute writes the flag, the
 * deadline, a timeline entry and an audit entry, PENDING authority
 * notifications only for an open incident with none, and a second run finds
 * nothing to change.
 */

import { describe, it, expect, vi } from "vitest";
import {
  changeFor,
  recalculateIncidentNotifications,
  type RecalculationDb,
  type StoredIncident,
} from "@/server/services/incidents/recalculate-notifications";
import { recomputeNotification, TIMELINE_NOW_REQUIRED, TIMELINE_NO_LONGER_REQUIRED, TIMELINE_DEADLINE_RECALCULATED } from "@/server/services/incidents/notification-assessment";
import { parseArgs, summary } from "../scripts/recalculate-incident-notifications";

const D = new Date("2026-10-01T10:00:00Z");

function stored(over: Partial<StoredIncident> = {}): StoredIncident {
  return {
    id: "inc",
    organizationId: "org-a",
    status: "REPORTED",
    severity: "LOW",
    dataCategories: [],
    affectedRecords: null,
    discoveredAt: D,
    jurisdictionId: null,
    notificationRequired: false,
    notificationDeadline: null,
    recordedInErrorAt: null,
    _count: { notifications: 0 },
    ...over,
  };
}

function fakeDb(rows: StoredIncident[]) {
  const incidents = rows.map((r) => ({ ...r }));
  const db = {
    incident: {
      findMany: vi.fn(async () => incidents.map((r) => ({ ...r }))),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<StoredIncident> }) => {
        const row = incidents.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    jurisdiction: { findMany: vi.fn(async () => [{ id: "es", breachNotificationHours: 72 }]) },
    organizationJurisdiction: {
      findMany: vi.fn(async () => [{ jurisdictionId: "es", jurisdiction: { breachNotificationHours: 72 } }]),
    },
    incidentNotification: {
      create: vi.fn(async ({ data }: { data: { incidentId: string } }) => {
        const row = incidents.find((r) => r.id === data.incidentId)!;
        row._count = { notifications: row._count.notifications + 1 };
        return data;
      }),
    },
    incidentTimelineEntry: { create: vi.fn(async (args: unknown) => args) },
    auditLog: { create: vi.fn(async (args: unknown) => args) },
  };
  return { db, rows: incidents, asDb: db as unknown as RecalculationDb };
}

describe("changeFor: the router's rule", () => {
  const hours = new Map([["es", 72]]);

  it("leaves an incident whose flag and deadline already follow its facts", () => {
    expect(changeFor(stored(), hours)).toBeNull();
    const deadline = recomputeNotification(
      { severity: "HIGH", dataCategories: [], affectedRecords: null, discoveredAt: D, jurisdictionId: "es" },
      72,
    ).notificationDeadline;
    expect(changeFor(stored({ severity: "HIGH", jurisdictionId: "es", notificationRequired: true, notificationDeadline: deadline }), hours)).toBeNull();
  });

  it("flags HIGH severity, special categories and 500 records or more", () => {
    expect(changeFor(stored({ severity: "HIGH" }), hours)?.notificationRequired).toEqual({ from: false, to: true });
    expect(changeFor(stored({ dataCategories: ["HEALTH"] }), hours)?.notificationRequired.to).toBe(true);
    expect(changeFor(stored({ affectedRecords: 500 }), hours)?.notificationRequired.to).toBe(true);
    expect(changeFor(stored({ affectedRecords: 499 }), hours)).toBeNull();
  });

  it("clears a flag the facts no longer support, and the deadline with it", () => {
    const c = changeFor(stored({ notificationRequired: true, notificationDeadline: D, jurisdictionId: "es" }), hours)!;
    expect(c.notificationRequired).toEqual({ from: true, to: false });
    expect(c.notificationDeadline.to).toBeNull();
    expect(c.pendingNotifications).toBe(false);
  });

  it("sets the jurisdiction's deadline from discovery", () => {
    const c = changeFor(stored({ severity: "CRITICAL", jurisdictionId: "es" }), hours)!;
    expect(c.notificationDeadline.to).toBe("2026-10-04T10:00:00.000Z");
  });

  it("opens PENDING notifications only for an open incident with none, not recorded in error", () => {
    expect(changeFor(stored({ severity: "HIGH" }), hours)!.pendingNotifications).toBe(true);
    expect(changeFor(stored({ severity: "HIGH", status: "CLOSED" }), hours)!.pendingNotifications).toBe(false);
    expect(changeFor(stored({ severity: "HIGH", recordedInErrorAt: D }), hours)!.pendingNotifications).toBe(false);
    expect(changeFor(stored({ severity: "HIGH", _count: { notifications: 1 } }), hours)!.pendingNotifications).toBe(false);
  });
});

describe("recalculateIncidentNotifications", () => {
  const rows = () => [
    stored({ id: "ok" }),
    stored({ id: "now-required", severity: "HIGH", jurisdictionId: "es" }),
    stored({ id: "no-longer", notificationRequired: true }),
    stored({ id: "closed", severity: "HIGH", status: "CLOSED" }),
  ];

  it("dry run: counts before and after, writes nothing", async () => {
    const { db, asDb } = fakeDb(rows());
    const r = await recalculateIncidentNotifications(asDb, { execute: false });
    expect(r.scanned).toBe(4);
    expect(r.requiredBefore).toBe(1);
    expect(r.requiredAfter).toBe(2);
    expect(r.changes.map((c) => c.id)).toEqual(["now-required", "no-longer", "closed"]);
    expect(db.incident.update).not.toHaveBeenCalled();
    expect(db.incidentNotification.create).not.toHaveBeenCalled();
    expect(db.incidentTimelineEntry.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(summary(r)).toContain("Dry run: nothing written.");
  });

  it("execute: writes each change with its timeline and audit entries, then a second run finds nothing", async () => {
    const { db, rows: state, asDb } = fakeDb(rows());
    const transaction = vi.fn(async (fn: (tx: RecalculationDb) => Promise<void>) => fn(asDb));
    const r = await recalculateIncidentNotifications(asDb, { execute: true, transaction });
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(db.incident.update).toHaveBeenCalledTimes(3);
    expect(state.find((x) => x.id === "now-required")).toMatchObject({
      notificationRequired: true,
      notificationDeadline: new Date("2026-10-04T10:00:00.000Z"),
    });
    expect(state.find((x) => x.id === "no-longer")!.notificationRequired).toBe(false);
    // One PENDING notification per declared jurisdiction, for the open incident only.
    expect(db.incidentNotification.create).toHaveBeenCalledTimes(1);
    expect(db.incidentNotification.create.mock.calls[0]![0].data).toMatchObject({
      incidentId: "now-required",
      recipientType: "DPA",
      status: "PENDING",
    });
    const titles = db.incidentTimelineEntry.create.mock.calls.map((c) => (c[0] as { data: { title: string } }).data.title);
    expect(titles).toEqual([TIMELINE_NOW_REQUIRED, TIMELINE_NO_LONGER_REQUIRED, TIMELINE_NOW_REQUIRED]);
    const audit = db.auditLog.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
    expect(audit.every((a) => a.action === "UPDATE" && a.userId === null && a.entityType === "Incident")).toBe(true);
    expect(r.requiredAfter).toBe(2);

    const again = await recalculateIncidentNotifications(asDb, { execute: true, transaction });
    expect(again.changes).toEqual([]);
    expect(again.requiredBefore).toBe(2);
    expect(summary(again)).toContain("Nothing to change.");
  });

  it("a deadline-only change is recorded as a recalculated deadline", async () => {
    const { db, asDb } = fakeDb([stored({ id: "d", severity: "HIGH", jurisdictionId: "es", notificationRequired: true, notificationDeadline: D, _count: { notifications: 1 } })]);
    await recalculateIncidentNotifications(asDb, { execute: true });
    expect((db.incidentTimelineEntry.create.mock.calls[0]![0] as { data: { title: string } }).data.title).toBe(TIMELINE_DEADLINE_RECALCULATED);
    expect(db.incidentNotification.create).not.toHaveBeenCalled();
  });

  it("can be limited to one organisation", async () => {
    const { db, asDb } = fakeDb([]);
    await recalculateIncidentNotifications(asDb, { execute: false, organizationId: "org-a" });
    expect((db.incident.findMany.mock.calls[0] as unknown as [{ where: unknown }])[0].where).toEqual({ organizationId: "org-a" });
  });
});

describe("the script's arguments", () => {
  it("is a dry run by default", () => {
    expect(parseArgs([])).toEqual({ execute: false, json: false });
    expect(parseArgs(["--dry-run"])).toEqual({ execute: false, json: false });
    expect(parseArgs(["--execute", "--org", "org-a", "--json"])).toEqual({ execute: true, organizationId: "org-a", json: true });
  });

  it("refuses unknown arguments and a bare --org", () => {
    expect(() => parseArgs(["--apply"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["--org"])).toThrow(/--org needs a value/);
  });
});
