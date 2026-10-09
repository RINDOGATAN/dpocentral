// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Deletion of every rights-request (DSAR) record of the chosen organisations.
 * Run by scripts/purge-dsar-data.ts, only after the rights-request module has
 * been switched off (NEXT_PUBLIC_DSAR_ENABLED=false) and the organisations'
 * owners and admins have had the chance to download their records
 * (GET /api/export/rights-requests).
 *
 * What goes, per organisation:
 *   - the requests (dsar_requests) and, with them, their tasks, messages,
 *     reminders and module audit trail (dsar_tasks, dsar_communications,
 *     dsar_reminders, dsar_audit_logs);
 *   - the public intake forms (dsar_intake_forms);
 *   - the general audit entries about requests (audit_logs where
 *     entityType = "DSARRequest");
 *   - the in-app notifications about requests (notifications of the DSAR_*
 *     types).
 * Nothing else is touched: no organisation, member, user, preference or other
 * module's record.
 *
 * A dry run only counts. A real run deletes inside one transaction per
 * organisation, children first, then checks that nothing is left; if any row
 * remains the transaction is rolled back and the run stops.
 */

export const DSAR_NOTIFICATION_TYPES = [
  "DSAR_DEADLINE_APPROACHING",
  "DSAR_DEADLINE_OVERDUE",
  "DSAR_NEW_REQUEST",
] as const;

/** The general audit trail's entity type for a rights request. */
export const DSAR_AUDIT_ENTITY_TYPE = "DSARRequest";

export interface DsarPurgeCounts {
  requests: number;
  tasks: number;
  communications: number;
  reminders: number;
  requestAuditLogs: number;
  intakeForms: number;
  auditEntries: number;
  notifications: number;
}

export interface DsarPurgeOrgResult {
  organizationId: string;
  slug: string;
  /** What was there before the run (dry run: what a real run would delete). */
  found: DsarPurgeCounts;
  /** What the run deleted. All zero on a dry run. */
  deleted: DsarPurgeCounts;
}

export interface DsarPurgeResult {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  organizations: DsarPurgeOrgResult[];
  totals: { found: DsarPurgeCounts; deleted: DsarPurgeCounts };
}

type Tx = Prisma.TransactionClient | PrismaClient;

export const EMPTY_COUNTS: DsarPurgeCounts = {
  requests: 0,
  tasks: 0,
  communications: 0,
  reminders: 0,
  requestAuditLogs: 0,
  intakeForms: 0,
  auditEntries: 0,
  notifications: 0,
};

function wheres(organizationId: string) {
  const byRequest = { dsarRequest: { organizationId } };
  return {
    requests: { organizationId },
    children: byRequest,
    intakeForms: { organizationId },
    auditEntries: { organizationId, entityType: DSAR_AUDIT_ENTITY_TYPE },
    notifications: { organizationId, type: { in: [...DSAR_NOTIFICATION_TYPES] } },
  };
}

/** Counts the rights-request records of one organisation. Reads only. */
export async function countDsarRecords(db: Tx, organizationId: string): Promise<DsarPurgeCounts> {
  const w = wheres(organizationId);
  const [requests, tasks, communications, reminders, requestAuditLogs, intakeForms, auditEntries, notifications] =
    await Promise.all([
      db.dSARRequest.count({ where: w.requests }),
      db.dSARTask.count({ where: w.children }),
      db.dSARCommunication.count({ where: w.children }),
      db.dsarReminder.count({ where: w.children }),
      db.dSARAuditLog.count({ where: w.children }),
      db.dSARIntakeForm.count({ where: w.intakeForms }),
      db.auditLog.count({ where: w.auditEntries }),
      db.notification.count({ where: w.notifications }),
    ]);
  return { requests, tasks, communications, reminders, requestAuditLogs, intakeForms, auditEntries, notifications };
}

function add(a: DsarPurgeCounts, b: DsarPurgeCounts): DsarPurgeCounts {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof DsarPurgeCounts)[]) out[k] = a[k] + b[k];
  return out;
}

function anyLeft(c: DsarPurgeCounts): boolean {
  return Object.values(c).some((n) => n > 0);
}

/** Deletes the rights-request records of one organisation, in one transaction. */
async function deleteForOrg(db: PrismaClient, organizationId: string): Promise<DsarPurgeCounts> {
  return db.$transaction(async (tx) => {
    const w = wheres(organizationId);
    // Children first, so the counts are exact (the cascade would hide them).
    const tasks = await tx.dSARTask.deleteMany({ where: w.children });
    const communications = await tx.dSARCommunication.deleteMany({ where: w.children });
    const reminders = await tx.dsarReminder.deleteMany({ where: w.children });
    const requestAuditLogs = await tx.dSARAuditLog.deleteMany({ where: w.children });
    const requests = await tx.dSARRequest.deleteMany({ where: w.requests });
    const intakeForms = await tx.dSARIntakeForm.deleteMany({ where: w.intakeForms });
    const auditEntries = await tx.auditLog.deleteMany({ where: w.auditEntries });
    const notifications = await tx.notification.deleteMany({ where: w.notifications });

    const left = await countDsarRecords(tx, organizationId);
    if (anyLeft(left)) {
      // Throwing rolls the whole organisation back.
      throw new Error(
        `Rights-request records remain after deletion for organisation ${organizationId}: ${JSON.stringify(left)}`
      );
    }
    return {
      requests: requests.count,
      tasks: tasks.count,
      communications: communications.count,
      reminders: reminders.count,
      requestAuditLogs: requestAuditLogs.count,
      intakeForms: intakeForms.count,
      auditEntries: auditEntries.count,
      notifications: notifications.count,
    };
  });
}

export interface PurgeOptions {
  /** Organisation ids or slugs. Omitted with `all: true` for every organisation. */
  organizations?: string[];
  all?: boolean;
  dryRun: boolean;
  now?: () => Date;
}

/** Resolves the target organisations, then counts (dry run) or deletes. */
export async function purgeDsarData(db: PrismaClient, opts: PurgeOptions): Promise<DsarPurgeResult> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (!opts.all && (!opts.organizations || opts.organizations.length === 0)) {
    throw new Error("Name the organisations (--org <id or slug>) or pass --all.");
  }

  const orgs = await db.organization.findMany({
    where: opts.all
      ? {}
      : { OR: [{ id: { in: opts.organizations! } }, { slug: { in: opts.organizations! } }] },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (!opts.all) {
    const known = new Set(orgs.flatMap((o) => [o.id, o.slug]));
    const missing = opts.organizations!.filter((o) => !known.has(o));
    if (missing.length > 0) {
      throw new Error(`Unknown organisation(s): ${missing.join(", ")}. Nothing was changed.`);
    }
  }

  const results: DsarPurgeOrgResult[] = [];
  for (const org of orgs) {
    const found = await countDsarRecords(db, org.id);
    const deleted = opts.dryRun || !anyLeft(found) ? { ...EMPTY_COUNTS } : await deleteForOrg(db, org.id);
    results.push({ organizationId: org.id, slug: org.slug, found, deleted });
  }

  return {
    dryRun: opts.dryRun,
    startedAt,
    finishedAt: now().toISOString(),
    organizations: results,
    totals: {
      found: results.reduce((t, r) => add(t, r.found), { ...EMPTY_COUNTS }),
      deleted: results.reduce((t, r) => add(t, r.deleted), { ...EMPTY_COUNTS }),
    },
  };
}
