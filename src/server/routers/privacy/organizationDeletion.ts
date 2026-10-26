// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * An owner deletes one organisation: the one open in Settings, or any client
 * row in "All clients". Owner of that organisation only (ownerOrgProcedure
 * checks the role in the organisation named by the input). Only that
 * organisation goes: the person's account and their other organisations stay.
 *
 * Hosted service: a pilot organisation may be deleted at any time (DPA
 * clause 13). The paid plan belongs to the billing group (every organisation
 * with the same billing owner, src/server/services/pilot/umbrella.ts):
 *  - while another organisation of the group remains, one may be deleted; the
 *    plan and its subscription carry on for the others, untouched;
 *  - the group's last organisation may not be deleted while the plan runs:
 *    once the plan ends it returns to the pilot, and from then the owner may
 *    delete it (or it is deleted 30 days after the end,
 *    src/server/services/organization/retention.ts);
 *  - an organisation with the rights-request upgrade active (its own
 *    subscription) may not be deleted until the upgrade has ended.
 * On the self-hosted kit the owner may always delete it.
 *
 * The owner confirms by typing the organisation's name. The deletion is
 * deleteOrganizationCompletely (src/server/services/organization/delete.ts),
 * the same path as the platform administrator's.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, ownerOrgProcedure } from "../../trpc";
import { isHostedDeployment } from "@/lib/hosted";
import { isPaidPlan } from "@/server/services/pilot/caps";
import { deleteOrganizationCompletely, type DeleteOrgDb } from "@/server/services/organization/delete";
import { logger } from "@/lib/logger";
import { confirmsName } from "@/lib/confirm-name";

export type DeletionBlockedReason = "paid-plan" | "dsar-module";

/**
 * Why the owner may not delete the organisation now, or null.
 * `othersInGroup`: how many other organisations share its billing group.
 */
export function deletionBlockedReason(
  org: { plan?: string | null; dsarModuleStatus?: string | null },
  hosted: boolean = isHostedDeployment(),
  othersInGroup: number = 0
): DeletionBlockedReason | null {
  if (!hosted) return null;
  if (org.dsarModuleStatus === "ACTIVE") return "dsar-module";
  return isPaidPlan(org) && othersInGroup === 0 ? "paid-plan" : null;
}

type GroupCountDb = {
  organization: { count: (args: { where: { billingOwnerId: string; id: { not: string } } }) => Promise<number> };
};

/** The other organisations of the same billing group (none without a billing owner). */
export async function othersInBillingGroup(
  db: GroupCountDb,
  org: { id: string; billingOwnerId?: string | null }
): Promise<number> {
  if (!org.billingOwnerId) return 0;
  return db.organization.count({ where: { billingOwnerId: org.billingOwnerId, id: { not: org.id } } });
}

/**
 * Whether this organisation may be deleted now, reading its billing group only
 * when the plan makes it matter. `planContinues`: it is on the paid plan and
 * the plan carries on for the group's other organisations.
 */
async function deletionState(
  db: GroupCountDb,
  org: { id: string; plan?: string | null; dsarModuleStatus?: string | null; billingOwnerId?: string | null }
): Promise<{ reason: DeletionBlockedReason | null; hosted: boolean; planContinues: boolean }> {
  const hosted = isHostedDeployment();
  const others = hosted && isPaidPlan(org) ? await othersInBillingGroup(db, org) : 0;
  return { reason: deletionBlockedReason(org, hosted, others), hosted, planContinues: others > 0 };
}

const BLOCKED_MESSAGE: Record<DeletionBlockedReason, string> = {
  "paid-plan": "The organization is on the paid plan; it can be deleted once the plan has ended.",
  "dsar-module": "The organization has the rights-request upgrade; it can be deleted once the upgrade has ended.",
};

export { confirmsName };

export const organizationDeletionRouter = createTRPCRouter({
  status: ownerOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const { reason, hosted, planContinues } = await deletionState(ctx.prisma, ctx.organization);
      return { canDelete: reason === null, reason, name: ctx.organization.name, hosted, planContinues };
    }),

  delete: ownerOrgProcedure
    .input(z.object({ organizationId: z.string(), confirmName: z.string().max(400) }))
    .mutation(async ({ ctx, input }) => {
      const { reason } = await deletionState(ctx.prisma, ctx.organization);
      if (reason !== null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: BLOCKED_MESSAGE[reason] });
      }
      if (!confirmsName(input.confirmName, ctx.organization.name)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The name typed does not match the organization's name." });
      }
      const result = await deleteOrganizationCompletely(ctx.prisma as unknown as DeleteOrgDb, ctx.organization.id, {
        by: "owner",
        userId: ctx.session.user.id,
      });
      logger.info("Organisation deleted by its owner", { organizationId: ctx.organization.id });
      return { deleted: result.deleted };
    }),
});
