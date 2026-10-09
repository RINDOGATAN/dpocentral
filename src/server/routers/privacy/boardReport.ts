// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report (owner's decision d12, 9 October 2026): read for a period,
 * and the DPO's comment saved with it. The data is assembled in
 * src/server/services/program/board-report.ts, the same for the page and for
 * the PDF (/api/export/board-report).
 *
 * Organisation-wide figures: a member limited to departments gets
 * `limited: true` and nothing else, as on the dashboard. The comment is saved
 * by an owner, an admin or a privacy officer.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, officerProcedure, organizationProcedure } from "../../trpc";
import { COMMENT_MAX, parseDay, resolvePeriod } from "@/lib/board-report";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { loadBoardReport, saveBoardReportComment } from "@/server/services/program/board-report";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const boardReportRouter = createTRPCRouter({
  get: organizationProcedure
    .input(z.object({ organizationId: z.string(), from: day.optional(), to: day.optional() }))
    .query(async ({ ctx, input }) => {
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      if (!scope.all) return { limited: true as const, report: null };
      const report = await loadBoardReport(ctx.prisma, {
        organizationId: ctx.organization.id,
        organizationName: ctx.organization.name,
        period: resolvePeriod(input.from, input.to, new Date()),
        member: { role: ctx.membership.role, userId: ctx.session.user.id },
      });
      return { limited: false as const, report };
    }),

  saveComment: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        from: day,
        to: day,
        comment: z.string().max(COMMENT_MAX * 2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      if (!scope.all) throw new TRPCError({ code: "FORBIDDEN" });
      const period = resolvePeriod(input.from, input.to, new Date());
      // Only the period asked for is saved: never a silently different one.
      if (period.from !== input.from || period.to !== input.to || !parseDay(input.from)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid period" });
      }
      return saveBoardReportComment(ctx.prisma, {
        organizationId: ctx.organization.id,
        period,
        comment: input.comment,
        userId: ctx.session.user.id,
      });
    }),
});
