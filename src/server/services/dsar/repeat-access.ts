// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Spain, LOPDGDD article 13.3: exercising the right of access more than once
 * within six months may be considered repetitive, unless there is a
 * legitimate reason. When an access request arrives from an e-mail address
 * that made another access request to the same organisation in the six
 * months before it, the request page warns the staff. The decision stays
 * with them: nothing is refused automatically.
 */

import { subMonths } from "date-fns";

export const REPEAT_ACCESS_MONTHS = 6;

type RepeatDb = {
  dSARRequest: {
    findMany: (args: {
      where: object;
      select: { receivedAt: true };
      orderBy: { receivedAt: "desc" };
    }) => Promise<{ receivedAt: Date }[]>;
  };
};

export type RepeatAccess = { count: number; lastReceivedAt: Date } | null;

export async function countRecentAccessRequests(
  db: RepeatDb,
  request: {
    id: string;
    organizationId: string;
    type: string;
    requesterEmail: string;
    receivedAt: Date;
    redactedAt?: Date | null;
  }
): Promise<RepeatAccess> {
  if (request.type !== "ACCESS" || request.redactedAt) return null;
  const email = request.requesterEmail.trim();
  if (!email) return null;
  const earlier = await db.dSARRequest.findMany({
    where: {
      organizationId: request.organizationId,
      id: { not: request.id },
      type: "ACCESS",
      requesterEmail: { equals: email, mode: "insensitive" },
      receivedAt: { gte: subMonths(request.receivedAt, REPEAT_ACCESS_MONTHS), lte: request.receivedAt },
    },
    select: { receivedAt: true },
    orderBy: { receivedAt: "desc" },
  });
  if (earlier.length === 0) return null;
  return { count: earlier.length, lastReceivedAt: earlier[0]!.receivedAt };
}
