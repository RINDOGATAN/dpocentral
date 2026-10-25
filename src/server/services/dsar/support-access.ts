// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A support read of one rights request (scripts/dsar-support-read.ts). The
 * operator gives who they are and why (a ticket reference); the entry is
 * written in the request's own trail (action SUPPORT) BEFORE anything is
 * read, so the organisation sees every support read on the request page. If
 * the entry cannot be written, nothing is read.
 *
 * Masked by default: the requester's identity (name, e-mail, telephone,
 * address) and what they wrote (the request text, the data asked for, the
 * response notes) are shown masked, so a support read normally reveals no one.
 * An operator who needs them asks for them explicitly (showIdentity,
 * showContent), and the trail entry records that they were shown.
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
  /** Show the requester's name, e-mail, telephone and address unmasked. */
  showIdentity?: boolean;
  /** Show the request text, the data asked for and the response notes unmasked. */
  showContent?: boolean;
}

/** Fields that identify the requester. */
export const IDENTITY_FIELDS = ["requesterName", "requesterEmail", "requesterPhone", "requesterAddress"] as const;
/** Fields holding what the requester or the team wrote. */
export const CONTENT_FIELDS = ["description", "requestedData", "responseNotes", "extensionReason"] as const;

/** "Maria Lopez" -> "M**** L****"; keeps the first letter of each word. */
export function maskName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] + "*".repeat(Math.max(w.length - 1, 1)))
    .join(" ");
}

/** "maria@example.com" -> "m****@e******.com"; keeps the first letters and the top-level domain. */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf("@");
  if (at < 1) return maskName(value);
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}${"*".repeat(Math.max(local.length - 1, 1))}@${host[0] ?? ""}${"*".repeat(Math.max(host.length - 1, 1))}${tld}`;
}

/** A short placeholder that says how long the hidden text is. */
function maskText(value: string): string {
  return `[hidden: ${value.length} characters]`;
}

/** The request as a support read shows it: identity and content masked unless asked for. */
export function maskedSupportView(
  request: Record<string, unknown>,
  opts: { showIdentity?: boolean; showContent?: boolean } = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...request };
  if (!opts.showIdentity) {
    for (const f of IDENTITY_FIELDS) {
      const v = out[f];
      if (typeof v !== "string" || !v) continue;
      out[f] = f === "requesterEmail" ? maskEmail(v) : f === "requesterName" ? maskName(v) : maskText(v);
    }
  }
  if (!opts.showContent) {
    for (const f of CONTENT_FIELDS) {
      const v = out[f];
      if (typeof v === "string" && v) out[f] = maskText(v);
    }
    // Message subjects may repeat what the requester wrote.
    if (Array.isArray(out.communications)) {
      out.communications = (out.communications as Record<string, unknown>[]).map((c) =>
        typeof c.subject === "string" && c.subject ? { ...c, subject: maskText(c.subject) } : c
      );
    }
  }
  return out;
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
      details: {
        reason,
        at: now.toISOString(),
        identityShown: !!input.showIdentity,
        contentShown: !!input.showContent,
      },
    },
  });

  const request = await db.dSARRequest.findUnique({
    where: { id: found.id },
    include: {
      organization: { select: { id: true, slug: true, name: true } },
      tasks: { select: { id: true, title: true, status: true, dueDate: true, completedAt: true } },
      communications: { select: { id: true, direction: true, channel: true, subject: true, sentAt: true } },
      auditLog: { orderBy: { createdAt: "asc" }, select: { action: true, performedBy: true, createdAt: true } },
    },
  });
  if (!request || typeof request !== "object") return request;
  return maskedSupportView(request as Record<string, unknown>, {
    showIdentity: input.showIdentity,
    showContent: input.showContent,
  });
}
