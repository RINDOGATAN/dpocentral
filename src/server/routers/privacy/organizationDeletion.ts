// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The owner deletes the organisation (Settings). Owner only.
 *
 * Hosted service: a pilot organisation may be deleted at any time (DPA
 * clause 13). An organisation on the paid plan may not be deleted from here
 * while the plan runs: once the plan ends it returns to the pilot, and from
 * then the owner may delete it (or it is deleted 30 days after the end,
 * src/server/services/organization/retention.ts). On the self-hosted kit the
 * owner may always delete it.
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

/** Why the owner may not delete the organisation now, or null. */
export function deletionBlockedReason(
  org: { plan?: string | null },
  hosted: boolean = isHostedDeployment()
): "paid-plan" | null {
  return hosted && isPaidPlan(org) ? "paid-plan" : null;
}

/** The typed confirmation: the organisation's name, ignoring outer spaces. */
export function confirmsName(typed: string, name: string): boolean {
  return typed.trim() === name.trim() && name.trim().length > 0;
}

export const organizationDeletionRouter = createTRPCRouter({
  status: ownerOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(({ ctx }) => {
      const reason = deletionBlockedReason(ctx.organization);
      return { canDelete: reason === null, reason, name: ctx.organization.name };
    }),

  delete: ownerOrgProcedure
    .input(z.object({ organizationId: z.string(), confirmName: z.string().max(400) }))
    .mutation(async ({ ctx, input }) => {
      if (deletionBlockedReason(ctx.organization) !== null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The organization is on the paid plan; it can be deleted once the plan has ended.",
        });
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
