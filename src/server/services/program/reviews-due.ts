// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reviews coming due: processing activities and vendors whose review date
 * (nextReviewAt) has passed or falls within the next 30 days. Shown on the
 * dashboard's deadlines card and, per client, in All clients, so a review is
 * seen before it is late, not only once it is overdue (Needs action).
 *
 * Read-only. The record's name is returned for the line a member reads (the
 * organisation's own records, to its own members); nothing else.
 */

import type { Db } from "@/lib/prisma";

const HORIZON_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIMIT = 3;

export interface ReviewDue {
  kind: "activityReview" | "vendorReview";
  /** ISO date the review is due. */
  at: string;
  /** The record's own id, for a stable key. */
  id: string;
  name: string;
  href: string;
}

export async function loadReviewsDue(
  prisma: Db,
  organizationId: string,
  now: Date = new Date(),
): Promise<ReviewDue[]> {
  const before = new Date(now.getTime() + HORIZON_DAYS * DAY_MS);
  const [activities, vendors] = await Promise.all([
    prisma.processingActivity.findMany({
      where: { organizationId, isActive: true, nextReviewAt: { lt: before } },
      orderBy: { nextReviewAt: "asc" },
      take: LIMIT,
      select: { id: true, name: true, nextReviewAt: true },
    }),
    prisma.vendor.findMany({
      where: { organizationId, status: { notIn: ["TERMINATED"] }, nextReviewAt: { lt: before } },
      orderBy: { nextReviewAt: "asc" },
      take: LIMIT,
      select: { id: true, name: true, nextReviewAt: true },
    }),
  ]);
  const rows: ReviewDue[] = [
    ...activities.map((a) => ({
      kind: "activityReview" as const,
      at: a.nextReviewAt!.toISOString(),
      id: a.id,
      name: a.name,
      href: `/privacy/data-inventory/activities/${a.id}`,
    })),
    ...vendors.map((v) => ({
      kind: "vendorReview" as const,
      at: v.nextReviewAt!.toISOString(),
      id: v.id,
      name: v.name,
      href: `/privacy/vendors/${v.id}`,
    })),
  ];
  return rows.sort((a, b) => a.at.localeCompare(b.at)).slice(0, LIMIT);
}

/**
 * The nearest open rights-request deadline, however far away: the dashboard's
 * card looks 30 days ahead, but All clients must not say "None" while a
 * request is due in 32 days.
 */
export async function loadNextRequestDue(
  prisma: Db,
  organizationId: string,
  where: Record<string, unknown> = {},
): Promise<{ kind: "dsarDue"; at: string; publicId: string; href: string } | null> {
  const rows = await prisma.dSARRequest.findMany({
    where: { organizationId, ...where, status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] } },
    orderBy: { dueDate: "asc" },
    take: 5,
    select: { id: true, publicId: true, dueDate: true, extendedDueDate: true },
  });
  if (rows.length === 0) return null;
  const nearest = rows
    .map((r) => ({ r, at: r.extendedDueDate ?? r.dueDate }))
    .reduce((a, b) => (b.at.getTime() < a.at.getTime() ? b : a));
  return {
    kind: "dsarDue",
    at: nearest.at.toISOString(),
    publicId: nearest.r.publicId,
    href: `/privacy/dsar/${nearest.r.id}`,
  };
}
