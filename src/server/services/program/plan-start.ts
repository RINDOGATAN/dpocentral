// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Day 1 of the 30/60/90-day plan (src/components/guided/plan.ts): the day the
 * privacy program started for the organisation. Derived from data the product
 * already keeps; nothing new is stored.
 *
 * In order:
 * 1. the earliest audit entry the quick start wrote (every completed run
 *    writes its entries with `changes.source = "quickstart"`);
 * 2. otherwise the quick start profile's `completedAt` in the settings;
 * 3. otherwise, when the quick start step is done because the work it would do
 *    already exists (path-config.ts), the day that became true: the later of
 *    the first data asset and the first vendor.
 * Null when none holds: the plan has not started.
 */

import type { Db } from "@/lib/prisma";

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadPlanStart(
  prisma: Db,
  organizationId: string,
  /** Whether the quick start step is done (its status from the path). */
  quickstartDone: boolean,
): Promise<Date | null> {
  const [firstEntry, organization] = await Promise.all([
    prisma.auditLog.findFirst({
      where: { organizationId, changes: { path: ["source"], equals: "quickstart" } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.organization.findFirst({
      where: { id: organizationId },
      select: { settings: true },
    }),
  ]);
  if (firstEntry) return firstEntry.createdAt;

  const completedAt = settingsObject(settingsObject(organization?.settings).quickstart).completedAt;
  if (typeof completedAt === "string") {
    const date = new Date(completedAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (!quickstartDone) return null;
  const earliest = { orderBy: { createdAt: "asc" as const }, select: { createdAt: true } };
  const firsts = await Promise.all([
    prisma.dataAsset.findFirst({ where: { organizationId }, ...earliest }),
    prisma.vendor.findFirst({ where: { organizationId }, ...earliest }),
  ]);
  if (firsts.some((row) => !row)) return null;
  return new Date(Math.max(...firsts.map((row) => row!.createdAt.getTime())));
}
