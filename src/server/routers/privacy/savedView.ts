// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Saved list views: a named filter set a person keeps for one list in one
 * organisation.
 *
 * These are a personal preference, not a governance record: they belong to one
 * user, are visible only to that user, and carry no audit entry. Every query is
 * scoped by organizationId, the signed-in user's id and the list, so one
 * person's saved views can never be read or removed by another. Viewers may save
 * views (a personal convenience is not a write to the organisation's data), so
 * these use organizationProcedure rather than a writer/admin procedure.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure } from "../../trpc";
import { LIST_KEYS, sanitizeFilters, type ListKey } from "@/lib/list-views";

export const savedViewRouter = createTRPCRouter({
  list: organizationProcedure
    .input(z.object({ organizationId: z.string(), list: z.enum(LIST_KEYS) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.savedView.findMany({
        where: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          list: input.list,
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, filters: true, createdAt: true },
      });
      // Re-sanitise on the way out, so a view saved before a vocabulary changed
      // can never surface a value the filter no longer honours.
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        filters: sanitizeFilters(input.list as ListKey, (r.filters ?? {}) as Record<string, unknown>),
      }));
    }),

  create: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        list: z.enum(LIST_KEYS),
        name: z.string().trim().min(1).max(80),
        filters: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // A person keeps a handful of views per list, not hundreds; the cap stops
      // a runaway client and keeps the chip row readable.
      const count = await ctx.prisma.savedView.count({
        where: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          list: input.list,
        },
      });
      if (count >= 30) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You have reached the maximum number of saved views.",
        });
      }

      const filters = sanitizeFilters(input.list as ListKey, input.filters);

      const created = await ctx.prisma.savedView.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          list: input.list,
          name: input.name,
          filters: filters as Record<string, string>,
        },
        select: { id: true, name: true, filters: true },
      });
      return {
        id: created.id,
        name: created.name,
        filters: sanitizeFilters(input.list as ListKey, (created.filters ?? {}) as Record<string, unknown>),
      };
    }),

  remove: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.savedView.deleteMany({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
        },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Saved view not found" });
      }
      return { deleted: true };
    }),
});
