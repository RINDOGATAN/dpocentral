// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One recalculation of the notification flag and deadline on incidents
 * already stored, with the rule `incident.create` and `incident.update` apply
 * (notification-assessment.ts). Incidents logged before `update` recomputed
 * the flag can hold a flag or a deadline that no longer follows their facts
 * (severity, data categories, records affected, discovery time,
 * jurisdiction). Run from scripts/recalculate-incident-notifications.ts;
 * dry run by default.
 *
 * For each incident whose stored flag or deadline differs from the rule's:
 *   - the flag and the deadline are written;
 *   - a timeline entry records the change (the titles `update` writes);
 *   - an UPDATE entry goes to the audit trail (no user: a system change);
 *   - an incident that becomes notifiable, is still open, is not recorded
 *     in error and has no notification yet gets the PENDING authority
 *     notifications `create` makes. A closed incident keeps its record as it
 *     is: no new task is opened on it.
 *
 * Idempotent: a second run finds nothing to change. Reads and writes only the
 * incident's own fields, its notifications, timeline and the audit trail.
 */

import {
  recomputeNotification,
  TIMELINE_DEADLINE_RECALCULATED,
  TIMELINE_NO_LONGER_REQUIRED,
  TIMELINE_NOW_REQUIRED,
} from "./notification-assessment";
import { createPendingAuthorityNotifications, type AuthorityNotificationDb } from "./authority-notifications";

/** The delegates the recalculation uses (a PrismaClient, or a transaction client). */
export type RecalculationDb = AuthorityNotificationDb & {
  incident: {
    findMany(args: unknown): Promise<StoredIncident[]>;
    update(args: unknown): Promise<unknown>;
  };
  jurisdiction: { findMany(args: unknown): Promise<Array<{ id: string; breachNotificationHours: number }>> };
  incidentTimelineEntry: { create(args: unknown): Promise<unknown> };
  auditLog: { create(args: unknown): Promise<unknown> };
};

export interface StoredIncident {
  id: string;
  organizationId: string;
  status: string;
  severity: string;
  dataCategories: string[];
  affectedRecords: number | null;
  discoveredAt: Date;
  jurisdictionId: string | null;
  notificationRequired: boolean;
  notificationDeadline: Date | null;
  recordedInErrorAt: Date | null;
  _count: { notifications: number };
}

export interface IncidentChange {
  id: string;
  organizationId: string;
  notificationRequired: { from: boolean; to: boolean };
  notificationDeadline: { from: string | null; to: string | null };
  /** PENDING authority notifications created (on --execute) or to create (dry run). */
  pendingNotifications: boolean;
}

export interface RecalculationReport {
  execute: boolean;
  scanned: number;
  /** Incidents flagged as requiring notification, before and after. */
  requiredBefore: number;
  requiredAfter: number;
  changes: IncidentChange[];
}

const CLOSED = ["CLOSED", "FALSE_POSITIVE"];
const time = (d: Date | null) => (d ? d.getTime() : null);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** The rule's flag and deadline for one stored incident; pure. */
export function changeFor(
  inc: StoredIncident,
  hoursByJurisdiction: ReadonlyMap<string, number>,
): IncidentChange | null {
  const hours = inc.jurisdictionId ? (hoursByJurisdiction.get(inc.jurisdictionId) ?? null) : null;
  const derived = recomputeNotification(
    {
      severity: inc.severity,
      dataCategories: inc.dataCategories ?? [],
      affectedRecords: inc.affectedRecords,
      discoveredAt: inc.discoveredAt,
      jurisdictionId: inc.jurisdictionId,
    },
    hours,
  );
  if (
    derived.notificationRequired === inc.notificationRequired &&
    time(derived.notificationDeadline) === time(inc.notificationDeadline)
  ) {
    return null;
  }
  const pendingNotifications =
    derived.notificationRequired &&
    !inc.notificationRequired &&
    inc._count.notifications === 0 &&
    !CLOSED.includes(inc.status) &&
    !inc.recordedInErrorAt;
  return {
    id: inc.id,
    organizationId: inc.organizationId,
    notificationRequired: { from: inc.notificationRequired, to: derived.notificationRequired },
    notificationDeadline: { from: iso(inc.notificationDeadline), to: iso(derived.notificationDeadline) },
    pendingNotifications,
  };
}

export async function recalculateIncidentNotifications(
  db: RecalculationDb,
  options: {
    execute: boolean;
    organizationId?: string;
    /** Runs each incident's writes together (the script passes prisma.$transaction). */
    transaction?: (fn: (tx: RecalculationDb) => Promise<void>) => Promise<void>;
  },
): Promise<RecalculationReport> {
  const incidents = await db.incident.findMany({
    where: options.organizationId ? { organizationId: options.organizationId } : {},
    select: {
      id: true,
      organizationId: true,
      status: true,
      severity: true,
      dataCategories: true,
      affectedRecords: true,
      discoveredAt: true,
      jurisdictionId: true,
      notificationRequired: true,
      notificationDeadline: true,
      recordedInErrorAt: true,
      _count: { select: { notifications: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const jurisdictionIds = [...new Set(incidents.map((i) => i.jurisdictionId).filter((id): id is string => !!id))];
  const hours = new Map(
    jurisdictionIds.length
      ? (
          await db.jurisdiction.findMany({
            where: { id: { in: jurisdictionIds } },
            select: { id: true, breachNotificationHours: true },
          })
        ).map((j) => [j.id, j.breachNotificationHours] as const)
      : [],
  );

  const changes = incidents.map((inc) => changeFor(inc, hours)).filter((c): c is IncidentChange => c !== null);
  const requiredBefore = incidents.filter((i) => i.notificationRequired).length;
  const changedTo = new Map(changes.map((c) => [c.id, c.notificationRequired.to]));
  const requiredAfter = incidents.filter((i) => changedTo.get(i.id) ?? i.notificationRequired).length;

  if (options.execute) {
    const byId = new Map(incidents.map((i) => [i.id, i]));
    const run = options.transaction ?? ((fn: (tx: RecalculationDb) => Promise<void>) => fn(db));
    for (const c of changes) {
      const inc = byId.get(c.id)!;
      await run(async (tx) => {
        const notificationDeadline = c.notificationDeadline.to ? new Date(c.notificationDeadline.to) : null;
        await tx.incident.update({
          where: { id: c.id },
          data: { notificationRequired: c.notificationRequired.to, notificationDeadline },
        });
        if (c.pendingNotifications) {
          await createPendingAuthorityNotifications(tx, c.organizationId, c.id, inc.discoveredAt);
        }
        const flagChanged = c.notificationRequired.from !== c.notificationRequired.to;
        await tx.incidentTimelineEntry.create({
          data: {
            incidentId: c.id,
            title: flagChanged
              ? c.notificationRequired.to
                ? TIMELINE_NOW_REQUIRED
                : TIMELINE_NO_LONGER_REQUIRED
              : TIMELINE_DEADLINE_RECALCULATED,
            entryType: "STATUS_CHANGE",
            createdById: null,
            metadata: flagChanged
              ? { notificationRequired: c.notificationRequired.to, source: "recalculation" }
              : { notificationDeadline: c.notificationDeadline.to, source: "recalculation" },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: c.organizationId,
            userId: null,
            entityType: "Incident",
            entityId: c.id,
            action: "UPDATE",
            changes: {
              source: "recalculation",
              notificationRequired: c.notificationRequired,
              notificationDeadline: c.notificationDeadline,
              pendingNotificationsCreated: c.pendingNotifications,
            },
          },
        });
      });
    }
  }

  return { execute: options.execute, scanned: incidents.length, requiredBefore, requiredAfter, changes };
}
