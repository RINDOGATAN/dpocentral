// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server side of who reads rights requests (src/lib/dsar-access.ts holds the
 * rule): the Prisma filter that narrows a member's reads to the requests on
 * which they hold a task, and the "viewed" entry written when a request is
 * opened.
 */

import type { Prisma } from "@prisma/client";
import { canHandleDsars } from "@/lib/dsar-access";

/**
 * Extra `where` for reads of request contents by this member: nothing for the
 * roles that handle requests, "a task of the request is assigned to me" for
 * everyone else. Always combined with the organisation filter, never instead
 * of it.
 */
export function dsarReadFilter(
  role: string | null | undefined,
  userId: string
): Prisma.DSARRequestWhereInput {
  if (canHandleDsars(role)) return {};
  return { tasks: { some: { assigneeId: userId } } };
}

/** Action written to DSARAuditLog when a person opens a request. */
export const DSAR_VIEWED_ACTION = "VIEWED";

/**
 * Opening the same request again within this window writes no second entry:
 * the page reloads the request after every change and when the tab regains
 * focus, and one entry per sitting is what the trail needs.
 */
export const DSAR_VIEW_DEDUPE_MS = 5 * 60 * 1000;

type ViewLogDb = {
  dSARAuditLog: {
    findFirst: (args: Prisma.DSARAuditLogFindFirstArgs) => Promise<unknown>;
    create: (args: Prisma.DSARAuditLogCreateArgs) => Promise<unknown>;
  };
};

/** Record that `userId` opened the request (who and when; no content). */
export async function recordDsarView(
  db: ViewLogDb,
  dsarRequestId: string,
  userId: string,
  details: { role: string; asAssignee: boolean },
  now: Date = new Date()
): Promise<void> {
  const recent = await db.dSARAuditLog.findFirst({
    where: {
      dsarRequestId,
      action: DSAR_VIEWED_ACTION,
      performedBy: userId,
      createdAt: { gte: new Date(now.getTime() - DSAR_VIEW_DEDUPE_MS) },
    },
    select: { id: true },
  });
  if (recent) return;
  await db.dSARAuditLog.create({
    data: {
      dsarRequestId,
      action: DSAR_VIEWED_ACTION,
      performedBy: userId,
      details,
    },
  });
}
