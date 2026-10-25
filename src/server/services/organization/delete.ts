// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deleting an organisation and everything its team recorded. The one deletion
 * path, used by the organisation's owner (Settings), by the platform
 * administrator and by the retention job (retention.ts), so every route
 * deletes the same things.
 *
 * Deleted, in one transaction:
 *  - every record of the programme (activities, assets, flows, transfers,
 *    vendors and their contracts, questionnaires and reviews, assessments and
 *    their templates, incidents, AI systems, rights requests with their tasks,
 *    messages and trail, intake forms, departments, saved views, notifications,
 *    imports, safeguards requests), the members and the pending invitations
 *    (kept in the organisation's settings). Most go by the database's own
 *    cascade from the organisation; the few that a cascade cannot reach in a
 *    safe order are deleted first, explicitly;
 *  - the organisation's audit trail, which can hold record contents and
 *    personal data.
 *
 * Kept, blocked (DPA clause 13: the record of the contract, and what a law
 * requires us to keep), with no record content and no data about data
 * subjects:
 *  - the acceptances of the data processing agreement (DPA_ACCEPTED), the plan
 *    changes (PLAN_CHANGE), the rights-request upgrade changes
 *    (DSAR_MODULE_CHANGE) and the retention notices (ORG_RETENTION_NOTICE).
 *    Once the organisation is gone the database detaches them from it
 *    (organizationId becomes null); their entityId still names it;
 *  - one new entry, ORGANIZATION_DELETED, outside any organisation: who asked
 *    (the owner's or administrator's account, or nobody for the retention job),
 *    why, and the plan the organisation was on. Not its name.
 *
 * The accounts of the members stay: a person keeps their account and their
 * other organisations.
 */

import type { Prisma } from "@prisma/client";
import { PILOT_DPA_ACTION } from "@/config/pilot-dpa";
import { PLAN_CHANGE } from "@/server/services/pilot/plan";
import { DSAR_MODULE_CHANGE } from "@/server/services/dsar/set-module";

export const ORGANIZATION_DELETED = "ORGANIZATION_DELETED";
export const ORG_RETENTION_NOTICE = "ORG_RETENTION_NOTICE";

/** Audit actions kept after the deletion: the record of the contract, without content. */
export const KEPT_AUDIT_ACTIONS: readonly string[] = [
  PILOT_DPA_ACTION,
  PLAN_CHANGE,
  DSAR_MODULE_CHANGE,
  ORG_RETENTION_NOTICE,
];

export type DeletionReason =
  | { by: "owner"; userId: string }
  | { by: "platform-admin"; userId: string }
  | { by: "retention"; rule: "plan-ended" | "pilot-inactive" };

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
      select: { id: true, plan: true },
    });
    if (!org) return { deleted: false, organizationId };

    // An assessment points at its template with a restricting key, and a
    // vendor's questionnaire answers at the questionnaire: delete the children
    // first so the cascade never meets a restriction half way.
    await tx.assessment.deleteMany({ where: { organizationId } });
    await tx.assessmentTemplate.deleteMany({ where: { organizationId } });
    await tx.vendor.deleteMany({ where: { organizationId } });
    await tx.vendorQuestionnaire.deleteMany({ where: { organizationId, responses: { none: {} } } });

    // The trail: everything but the record of the contract.
    await tx.auditLog.deleteMany({
      where: { organizationId, action: { notIn: [...KEPT_AUDIT_ACTIONS] } },
    });

    await tx.organization.delete({ where: { id: organizationId } });

    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: "userId" in reason ? reason.userId : null,
        entityType: "Organization",
        entityId: organizationId,
        action: ORGANIZATION_DELETED,
        changes: {
          by: reason.by,
          ...("rule" in reason ? { rule: reason.rule } : {}),
          plan: org.plan,
          deletedAt: now.toISOString(),
        },
      },
    });
    return { deleted: true, organizationId };
  });
}
