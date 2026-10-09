// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The deadlines at risk the dashboard shows (owner's decision d7): the 72-hour
 * window of each open breach still waiting for a decision or a notification,
 * and the rights requests due soonest. Dates and short references only; no
 * name, no content leaves the database. The plan's next milestone is worked
 * out on the page from the plan's start (src/components/guided/plan.ts).
 *
 * Rights requests follow the module switch (NEXT_PUBLIC_DSAR_ENABLED) and the
 * member's read rule (src/server/services/dsar/access.ts): a member who does
 * not handle requests sees only those they hold a task on.
 */

import type { Db } from "@/lib/prisma";
import { isDsarModuleEnabled } from "@/config/features";
import { breachWindowEnd } from "@/lib/breach-window";
import { dsarReadFilter } from "@/server/services/dsar/access";

const CLOSED_INCIDENT = ["CLOSED", "FALSE_POSITIVE"] as const;
const CLOSED_DSAR = ["COMPLETED", "REJECTED", "CANCELLED"] as const;
const DSAR_HORIZON_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIMIT = 3;

export interface Deadline {
  kind: "breachDecision" | "breachNotify" | "dsarDue";
  /** ISO date the deadline falls on. */
  at: string;
  /** The record's public id, for the short reference (INC-/REQ-). */
  publicId: string;
  href: string;
}

export async function loadDeadlines(
  prisma: Db,
  organizationId: string,
  member: { role: string | null | undefined; userId: string },
  now: Date = new Date(),
): Promise<Deadline[]> {
  const incidents = await prisma.incident.findMany({
    where: {
      organizationId,
      status: { notIn: [...CLOSED_INCIDENT] },
      // Nothing sent yet: once a notification is sent the clock has been met.
      notifications: { none: { sentAt: { not: null } } },
    },
    orderBy: { discoveredAt: "desc" },
    take: 20,
    select: {
      id: true,
      publicId: true,
      discoveredAt: true,
      notificationDeadline: true,
      notificationRequired: true,
      notifications: { select: { id: true } },
    },
  });

  const breaches: Deadline[] = [];
  for (const incident of incidents) {
    const end = breachWindowEnd(incident);
    // Undecided (not marked as requiring notification, no notification record):
    // shown while its window is open. Marked as requiring notification: shown
    // until it is sent, overdue included.
    const undecided = !incident.notificationRequired && incident.notifications.length === 0;
    if (undecided && end.getTime() <= now.getTime()) continue;
    if (!undecided && !incident.notificationRequired) continue;
    breaches.push({
      kind: undecided ? "breachDecision" : "breachNotify",
      at: end.toISOString(),
      publicId: incident.publicId,
      href: `/privacy/incidents/${incident.id}`,
    });
  }

  let requests: Deadline[] = [];
  if (isDsarModuleEnabled()) {
    const rows = await prisma.dSARRequest.findMany({
      where: {
        organizationId,
        ...dsarReadFilter(member.role, member.userId),
        status: { notIn: [...CLOSED_DSAR] },
        OR: [
          { extendedDueDate: { lt: new Date(now.getTime() + DSAR_HORIZON_DAYS * DAY_MS) } },
          { extendedDueDate: null, dueDate: { lt: new Date(now.getTime() + DSAR_HORIZON_DAYS * DAY_MS) } },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: LIMIT,
      select: { id: true, publicId: true, dueDate: true, extendedDueDate: true },
    });
    requests = rows.map((r) => ({
      kind: "dsarDue" as const,
      at: (r.extendedDueDate ?? r.dueDate).toISOString(),
      publicId: r.publicId,
      href: `/privacy/dsar/${r.id}`,
    }));
  }

  return [...breaches, ...requests]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, LIMIT * 2);
}
