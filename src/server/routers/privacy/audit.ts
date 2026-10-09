// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Audit router: reading the organisation's own audit trail (owner's
 * decision, 9 October 2026, as AI Sentinel has it).
 *
 * The trail was always written; until now nothing in the product read it
 * beyond the platform operator's screens. A record that cannot be produced is
 * not a record: counsel answering a discovery request, and a supervisory
 * authority asking who changed what and when, both need the whole trail,
 * filtered and exportable (the CSV is GET /api/export/audit-trail).
 *
 * RBAC: officerProcedure (OWNER / ADMIN / PRIVACY_OFFICER, the roles in
 * src/lib/audit-access.ts). Entries about rights requests show the reference
 * and the action only. There is deliberately no write path of any kind.
 */

import { z } from "zod";
import { createTRPCRouter, officerProcedure } from "../../trpc";
import { isDsarModuleEnabled } from "@/config/features";
import { isRightsRequestEntry } from "@/lib/audit-access";
import { AUDIT_ROW_SELECT, auditWhere, toAuditViews } from "@/server/services/audit/trail";

/** One page. The page asks for the next with a cursor rather than a bigger page. */
export const AUDIT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const filterInput = z.object({
  organizationId: z.string(),
  entityType: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  from: z.date().optional(),
  to: z.date().optional(),
});

export const auditRouter = createTRPCRouter({
  /**
   * One page of the trail, newest first. Cursor paging rather than offset: the
   * trail grows while it is being read, and an offset would skip or repeat rows.
   */
  list: officerProcedure
    .input(
      filterInput.extend({
        cursor: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const take = input.limit ?? AUDIT_PAGE_SIZE;
      const rows = await ctx.prisma.auditLog.findMany({
        where: auditWhere(ctx.organization.id, input),
        // The id breaks ties between entries written in the same instant, so
        // the cursor never skips or repeats one.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: AUDIT_ROW_SELECT,
      });
      const hasMore = rows.length > take;
      const page = hasMore ? rows.slice(0, take) : rows;
      return {
        entries: await toAuditViews(ctx.prisma, ctx.organization.id, page),
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    }),

  /**
   * The values present in this organisation's trail, so the filters offer what
   * actually exists rather than a fixed list that drifts.
   */
  facets: officerProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const where = auditWhere(ctx.organization.id, {});
      const [actions, entityTypes, actors, total, oldest] = await Promise.all([
        ctx.prisma.auditLog.groupBy({
          by: ["action"],
          where,
          _count: { action: true },
          orderBy: { _count: { action: "desc" } },
          take: 100,
        }),
        ctx.prisma.auditLog.groupBy({
          by: ["entityType"],
          where,
          _count: { entityType: true },
          orderBy: { _count: { entityType: "desc" } },
          take: 100,
        }),
        ctx.prisma.auditLog.findMany({
          where: { ...where, userId: { not: null } },
          distinct: ["userId"],
          select: { userId: true, user: { select: { name: true, email: true } } },
          take: 100,
        }),
        ctx.prisma.auditLog.count({ where }),
        ctx.prisma.auditLog.findFirst({
          where,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);
      const dsarOn = isDsarModuleEnabled();
      return {
        actions: actions.map((a) => ({ value: a.action, count: a._count.action })),
        entityTypes: entityTypes
          .filter((e) => dsarOn || !isRightsRequestEntry(e.entityType))
          .map((e) => ({ value: e.entityType, count: e._count.entityType })),
        actors: actors
          .filter((a) => a.userId)
          .map((a) => ({
            id: a.userId as string,
            name: a.user?.name ?? null,
            email: a.user?.email ?? null,
          })),
        total,
        earliest: oldest?.createdAt ?? null,
      };
    }),
});
