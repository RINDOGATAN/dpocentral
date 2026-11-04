// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * An owner deletes one organisation: the one open in Settings. Owner of that
 * organisation only (ownerOrgProcedure
 * checks the role in the organisation named by the input). Only that
 * organisation goes: the person's account and their other organisations stay.
 *
 * The owner confirms by typing the organisation's name. The deletion is
 * deleteOrganizationCompletely (src/server/services/organization/delete.ts).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, ownerOrgProcedure } from "../../trpc";
import { deleteOrganizationCompletely, type DeleteOrgDb } from "@/server/services/organization/delete";
import { logger } from "@/lib/logger";
import { confirmsName } from "@/lib/confirm-name";

export { confirmsName };

export const organizationDeletionRouter = createTRPCRouter({
  status: ownerOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return { canDelete: true, name: ctx.organization.name };
    }),

  delete: ownerOrgProcedure
    .input(z.object({ organizationId: z.string(), confirmName: z.string().max(400) }))
    .mutation(async ({ ctx, input }) => {
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
