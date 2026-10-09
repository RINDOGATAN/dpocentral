// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Removing a data subject's personal data from a closed rights request.
 *
 * One routine for both doors: the manual "Redact" action (dsar.redactDSAR)
 * and the nightly retention cron (src/app/api/cron/dsar-redaction). It clears
 * every field that can carry personal data and keeps what the audit trail
 * needs: the request's type, status and dates, its public reference, the
 * response method, task titles and statuses, and `redactedAt` as the marker.
 *
 * JSON columns are cleared with Prisma.DbNull. `undefined` would mean "leave
 * unchanged" to Prisma, which is how attachments and data exports used to
 * survive a "redaction".
 *
 * Order matters, since the steps do not run in one transaction: the related
 * rows go first and `redactedAt` is written last, so a run that fails half way
 * leaves the request unmarked and the next run (or a second click) redoes it.
 */

import { Prisma } from "@prisma/client";

export const REDACTED = "REDACTED";
export const REDACTED_EMAIL = "redacted@redacted";

/** Request fields cleared by a redaction (the request row). */
export const REDACTED_REQUEST_FIELDS = {
  requesterName: REDACTED,
  requesterEmail: REDACTED_EMAIL,
  requesterPhone: null,
  requesterAddress: null,
  relationship: null,
  description: null,
  requestedData: null,
  verificationMethod: null,
  extensionReason: null,
  responseNotes: null,
  // Holds the requester's language and the response download link.
  metadata: Prisma.DbNull,
} satisfies Prisma.DSARRequestUpdateInput;

/** Message fields cleared by a redaction (every message of the request). */
export const REDACTED_COMMUNICATION_FIELDS = {
  content: REDACTED,
  subject: null,
  // The attachment links.
  attachments: Prisma.DbNull,
  metadata: Prisma.DbNull,
} satisfies Prisma.DSARCommunicationUpdateManyMutationInput;

/** Task fields cleared by a redaction (every task of the request). */
export const REDACTED_TASK_FIELDS = {
  dataExport: Prisma.DbNull,
  notes: null,
  description: null,
} satisfies Prisma.DSARTaskUpdateManyMutationInput;

/**
 * Free-text keys inside the request's own audit entries: the officer's note
 * on a status change and the reason given for an extension (the same text as
 * `extensionReason`). The rest of each entry (who, when, from and to, dates)
 * stays.
 */
const AUDIT_FREE_TEXT_KEYS = ["notes", "reason"] as const;
const AUDIT_ACTIONS_WITH_FREE_TEXT = ["STATUS_CHANGED", "DEADLINE_EXTENDED"];

type RedactDb = {
  dSARRequest: { update: (args: Prisma.DSARRequestUpdateArgs) => Promise<unknown> };
  dSARCommunication: { updateMany: (args: Prisma.DSARCommunicationUpdateManyArgs) => Promise<unknown> };
  dSARTask: { updateMany: (args: Prisma.DSARTaskUpdateManyArgs) => Promise<unknown> };
  dSARAuditLog: {
    findMany: (args: Prisma.DSARAuditLogFindManyArgs) => Promise<{ id: string; details: Prisma.JsonValue }[]>;
    update: (args: Prisma.DSARAuditLogUpdateArgs) => Promise<unknown>;
    create: (args: Prisma.DSARAuditLogCreateArgs) => Promise<unknown>;
  };
  auditLog: { updateMany: (args: Prisma.AuditLogUpdateManyArgs) => Promise<unknown> };
};

export interface RedactOptions {
  /** The request's organisation (scopes the organisation audit log update). */
  organizationId: string;
  /** Written to `redactedAt`. */
  now: Date;
  /** DSARAuditLog entry recording the redaction (no personal data). */
  audit: { action: string; performedBy: string; details: Prisma.InputJsonValue };
}

export async function redactDsarRequest(
  db: RedactDb,
  dsarRequestId: string,
  { organizationId, now, audit }: RedactOptions
): Promise<void> {
  await db.dSARCommunication.updateMany({
    where: { dsarRequestId },
    data: REDACTED_COMMUNICATION_FIELDS,
  });

  await db.dSARTask.updateMany({
    where: { dsarRequestId },
    data: REDACTED_TASK_FIELDS,
  });

  // Free text the officers wrote into the request's own trail.
  const entries = await db.dSARAuditLog.findMany({
    where: { dsarRequestId, action: { in: AUDIT_ACTIONS_WITH_FREE_TEXT } },
    select: { id: true, details: true },
  });
  for (const entry of entries) {
    const details = entry.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) continue;
    const record = details as Record<string, Prisma.JsonValue>;
    const keys = AUDIT_FREE_TEXT_KEYS.filter((k) => record[k] !== undefined && record[k] !== null);
    if (keys.length === 0) continue;
    const scrubbed: Record<string, Prisma.JsonValue> = { ...record };
    for (const k of keys) scrubbed[k] = REDACTED;
    await db.dSARAuditLog.update({
      where: { id: entry.id },
      data: { details: scrubbed as Prisma.InputJsonObject },
    });
  }

  // The organisation audit log's "created" entry copied the whole form
  // (name, address, phone, what was asked).
  await db.auditLog.updateMany({
    where: { organizationId, entityType: "DSARRequest", entityId: dsarRequestId, action: "CREATE" },
    data: { changes: { redacted: true } },
  });

  // Last: the marker.
  await db.dSARRequest.update({
    where: { id: dsarRequestId },
    data: { ...REDACTED_REQUEST_FIELDS, redactedAt: now },
  });

  await db.dSARAuditLog.create({
    data: {
      dsarRequestId,
      action: audit.action,
      performedBy: audit.performedBy,
      details: audit.details,
    },
  });
}
