// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A support read of one rights request (scripts/dsar-support-read.ts). The
 * operator gives who they are and why (a ticket reference); the entry is
 * written in the request's own trail (action SUPPORT) BEFORE anything is
 * read, so the organisation sees every support read on the request page. If
 * the entry cannot be written, nothing is read.
 */

import type { Prisma } from "@prisma/client";

export const SUPPORT_ACTION = "SUPPORT";

export class SupportReadError extends Error {}

export type SupportDb = {
  dSARRequest: {
    findFirst: (args: object) => Promise<{ id: string; organizationId: string } | null>;
    findUnique: (args: object) => Promise<unknown>;
  };
  dSARAuditLog: { create: (args: { data: Prisma.DSARAuditLogUncheckedCreateInput }) => Promise<unknown> };
};

export interface SupportReadInput {
  /** The request's id or its public reference. */
  request: string;
  /** Who is reading (an operator name or e-mail). */
  operator: string;
  /** Why (a ticket reference). */
  reason: string;
}

export async function supportReadDsar(db: SupportDb, input: SupportReadInput, now: Date = new Date()) {
  const key = input.request.trim();
  const operator = input.operator.trim();
  const reason = input.reason.trim();
  if (!key) throw new SupportReadError("Give the request's id or public reference (--request).");
  if (!operator) throw new SupportReadError("Say who is reading (--by).");
  if (!reason) throw new SupportReadError("Say why, for example a ticket reference (--reason).");

  const found = await db.dSARRequest.findFirst({
    where: { OR: [{ id: key }, { publicId: key }] },
    select: { id: true, organizationId: true },
  });
  if (!found) throw new SupportReadError(`No request with the id or reference "${key}".`);

  await db.dSARAuditLog.create({
    data: {
      dsarRequestId: found.id,
      action: SUPPORT_ACTION,
      performedBy: `SUPPORT:${operator}`,
      details: { reason, at: now.toISOString() },
    },
  });

  return db.dSARRequest.findUnique({
    where: { id: found.id },
    include: {
      organization: { select: { id: true, slug: true, name: true } },
      tasks: { select: { id: true, title: true, status: true, dueDate: true, completedAt: true } },
      communications: { select: { id: true, direction: true, channel: true, subject: true, sentAt: true } },
      auditLog: { orderBy: { createdAt: "asc" }, select: { action: true, performedBy: true, createdAt: true } },
    },
  });
}
