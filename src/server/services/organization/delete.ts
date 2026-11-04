// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting an organisation and everything its team recorded. The one deletion
 * path, used by the organisation's owner (Settings).
 *
 * Deleted, in one transaction:
 *  - every record of the programme (activities, assets, flows, transfers,
 *    vendors and their contracts, incidents, rights requests with their tasks,
 *    messages and trail, intake forms, departments, saved views, notifications),
 *    the members and the pending invitations (kept in the organisation's
 *    settings). Most go by the database's own cascade from the organisation;
 *    the few that a cascade cannot reach in a safe order are deleted first,
 *    explicitly;
 *  - the organisation's audit trail, which can hold record contents and
 *    personal data;
 *  - one new entry, ORGANIZATION_DELETED, is written outside any organisation:
 *    who asked and when. Not its name.
 *
 * The accounts of the members stay: a person keeps their account and their
 * other organisations.
 */

import type { Prisma } from "@prisma/client";

export const ORGANIZATION_DELETED = "ORGANIZATION_DELETED";

export type DeletionReason =
  | { by: "owner"; userId: string };

export type DeleteOrgTx = Pick<
  Prisma.TransactionClient,
  "organization" | "assessment" | "assessmentTemplate" | "vendor" | "vendorQuestionnaire" | "auditLog"
>;

export interface DeleteOrgDb {
  $transaction<T>(fn: (tx: DeleteOrgTx) => Promise<T>): Promise<T>;
}

export interface DeleteOrgResult {
  deleted: boolean;
  organizationId: string;
}

/**
 * Deletes the organisation. Returns deleted: false when it no longer exists
 * (a second call changes nothing). Callers pass the app's Prisma client
 * (`ctx.prisma as unknown as DeleteOrgDb`; the extended client's types do not
 * line up with the plain client's).
 */
export async function deleteOrganizationCompletely(
  db: DeleteOrgDb,
  organizationId: string,
  reason: DeletionReason,
  now: Date = new Date()
): Promise<DeleteOrgResult> {
  return db.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) return { deleted: false, organizationId };

    // An assessment points at its template with a restricting key, and a
    // vendor's questionnaire answers at the questionnaire: delete the children
    // first so the cascade never meets a restriction half way.
    await tx.assessment.deleteMany({ where: { organizationId } });
    await tx.assessmentTemplate.deleteMany({ where: { organizationId } });
    await tx.vendor.deleteMany({ where: { organizationId } });
    await tx.vendorQuestionnaire.deleteMany({ where: { organizationId, responses: { none: {} } } });

    // The trail.
    await tx.auditLog.deleteMany({ where: { organizationId } });

    await tx.organization.delete({ where: { id: organizationId } });

    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: reason.userId,
        entityType: "Organization",
        entityId: organizationId,
        action: ORGANIZATION_DELETED,
        changes: {
          by: reason.by,
          deletedAt: now.toISOString(),
        },
      },
    });
    return { deleted: true, organizationId };
  });
}
