// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Start from another client" (directive stage 2b): an owner or admin copies a
 * privacy programme from one client into another, as drafts. The rules and the
 * copy itself are in src/config/client-template.ts and
 * src/server/services/client-template/copy.ts; this router adds the checks.
 *
 * Permission: the person must be an owner or an admin of BOTH organisations,
 * read from their own memberships. `copy` runs on the target through
 * adminOrgProcedure (owner/admin of the target, and the pilot read-only rule
 * applies), then checks the role on both sides again.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { OrganizationRole } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import { createTRPCRouter, adminOrgProcedure, protectedProcedure } from "../../trpc";
import { COPY_PARTS, TEMPLATE_ROLES } from "@/config/client-template";
import {
  applyClientTemplate,
  assertTemplatePermission,
  planClientTemplate,
} from "@/server/services/client-template/copy";

const MAX_SOURCES = 50;
const partsInput = z.array(z.enum(COPY_PARTS)).min(1);

export const clientTemplateRouter = createTRPCRouter({
  /** Organisations the person may copy from: where they are an owner or an admin. */
  sources: protectedProcedure
    .input(z.object({ excludeOrganizationId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const memberships = await ctx.prisma.organizationMember.findMany({
        where: {
          userId: ctx.session.user.id,
          role: { in: [...TEMPLATE_ROLES] as OrganizationRole[] },
          ...(input?.excludeOrganizationId ? { organizationId: { not: input.excludeOrganizationId } } : {}),
        },
        select: { organization: { select: { id: true, name: true } } },
        orderBy: { organization: { name: "asc" } },
        take: MAX_SOURCES,
      });
      return memberships.map((m) => m.organization);
    }),

  /**
   * What the copy would write: counts per part, what is skipped because the
   * target already has it, and every flag. Writes nothing. `targetOrganizationId`
   * is left out for a client that does not exist yet.
   */
  preview: protectedProcedure
    .input(
      z.object({
        sourceOrganizationId: z.string(),
        targetOrganizationId: z.string().optional(),
        targetName: z.string().min(1).max(200),
        parts: partsInput,
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertTemplatePermission(
        ctx.prisma,
        ctx.session.user.id,
        input.sourceOrganizationId,
        input.targetOrganizationId ?? null,
      );
      const plan = await planClientTemplate(ctx.prisma, {
        sourceOrganizationId: input.sourceOrganizationId,
        targetOrganizationId: input.targetOrganizationId ?? null,
        targetName: input.targetName,
        parts: input.parts,
      });
      return {
        parts: plan.parts,
        counts: plan.counts,
        skipped: plan.skipped,
        replacements: plan.replacements,
        flagged: plan.flagged,
      };
    }),

  /**
   * Copy into the organisation in `organizationId` (the target). When the
   * scrub has flagged anything, the person must have seen the list and say so
   * (`acknowledgeFlags`); otherwise nothing is written.
   */
  copy: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        sourceOrganizationId: z.string(),
        parts: partsInput,
        acknowledgeFlags: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertTemplatePermission(ctx.prisma, userId, input.sourceOrganizationId, ctx.organization.id);

      return ctx.prisma.$transaction(
        async (tx) => {
          // The interactive-transaction client carries the same delegates as
          // the extended client the services type against.
          const txDb = tx as unknown as Db;
          const plan = await planClientTemplate(txDb, {
            sourceOrganizationId: input.sourceOrganizationId,
            targetOrganizationId: ctx.organization.id,
            targetName: ctx.organization.name,
            parts: input.parts,
          });
          if (plan.flagged.length > 0 && !input.acknowledgeFlags) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Some copied text still points at the other client. Review the list before copying.",
            });
          }
          return applyClientTemplate(txDb, plan, {
            targetOrganizationId: ctx.organization.id,
            userId,
          });
        },
        { timeout: 30000 },
      );
    }),
});
