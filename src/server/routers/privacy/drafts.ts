// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Drafts router: the records the quick start, a template or another client's
 * copy drafted, and the person's confirmation of them (owner's decision d2,
 * 9 October 2026; the rule is in src/server/services/template-items/drafts.ts).
 *
 * - `summary` and `list` are reads, for every member (a viewer may see what is
 *   waiting; only some roles may confirm it).
 * - `confirm` takes one record or many (the "Review and confirm" page), all or
 *   nothing, and is open to the owner, the admins and the privacy officers, as
 *   AI Sentinel opens it to its owner, admins and AI officers.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, officerProcedure, organizationProcedure } from "../../trpc";
import {
  confirmDrafts,
  countDrafts,
  DRAFT_KINDS,
  DraftNotFoundError,
  listDrafts,
  MAX_CONFIRM_ITEMS,
} from "@/server/services/template-items/drafts";

export const draftsRouter = createTRPCRouter({
  summary: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(({ ctx }) => countDrafts(ctx.prisma, ctx.organization.id)),

  list: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(({ ctx }) => listDrafts(ctx.prisma, ctx.organization.id)),

  confirm: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        items: z
          .array(z.object({ kind: z.enum(DRAFT_KINDS), id: z.string().min(1) }))
          .min(1)
          .max(MAX_CONFIRM_ITEMS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await confirmDrafts(ctx.prisma, {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          items: input.items,
        });
      } catch (error) {
        if (error instanceof DraftNotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND", message: error.message });
        }
        throw error;
      }
    }),
});
