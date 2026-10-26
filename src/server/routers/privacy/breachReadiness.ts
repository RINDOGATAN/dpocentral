// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The breach-readiness confirmation of step 5
 * (src/server/services/program/breach-readiness.ts). Every member reads it;
 * an owner, administrator or privacy officer confirms it. The page renders
 * the deadlines from the declared law codes in the reader's language
 * (src/config/breach-readiness.ts).
 */

import { z } from "zod";
import { createTRPCRouter, officerProcedure, organizationProcedure } from "../../trpc";
import {
  READINESS_TEXT_MAX,
  confirmBreachReadiness,
  declaredLawCodes,
  isReadinessCurrent,
  readBreachReadiness,
} from "@/server/services/program/breach-readiness";

export const breachReadinessRouter = createTRPCRouter({
  get: organizationProcedure.input(z.object({ organizationId: z.string() })).query(async ({ ctx }) => {
    const [organization, declared] = await Promise.all([
      ctx.prisma.organization.findFirst({ where: { id: ctx.organization.id }, select: { settings: true } }),
      declaredLawCodes(ctx.prisma, ctx.organization.id),
    ]);
    const record = readBreachReadiness(organization?.settings);
    const confirmer = record
      ? await ctx.prisma.user.findFirst({ where: { id: record.confirmedBy }, select: { name: true, email: true } })
      : null;
    return {
      declared,
      record,
      current: isReadinessCurrent(record, declared),
      confirmedByName: confirmer?.name || confirmer?.email || null,
    };
  }),

  confirm: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        contact: z.string().trim().min(1).max(READINESS_TEXT_MAX),
        authority: z.string().trim().max(READINESS_TEXT_MAX).nullable().optional(),
        register: z.string().trim().max(READINESS_TEXT_MAX).nullable().optional(),
        acknowledged: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return confirmBreachReadiness(ctx.prisma, {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
        contact: input.contact,
        authority: input.authority ?? null,
        register: input.register ?? null,
      });
    }),
});
