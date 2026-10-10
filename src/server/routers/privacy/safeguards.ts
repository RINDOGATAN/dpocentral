// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards question: the first-visit welcome card on /privacy and the
 * same question in Settings, next to the AI setting. Hosted service only;
 * see src/server/services/safeguards for the rules.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure, adminOrgProcedure } from "../../trpc";
import { isHostedDeployment } from "@/lib/hosted";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import {
  MAX_OPEN_REQUESTS_PER_ORG,
  REQUEST_CHOICES,
  USER_COUNT_BANDS,
  sendSafeguardsRequestNotice,
  shouldShowWelcome,
} from "@/server/services/safeguards";

const ALL_CHOICES = ["shared_eu", "managed", "own_hardware", "later"] as const;

function assertHosted() {
  if (!isHostedDeployment()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This question belongs to the hosted service only.",
    });
  }
}

export const safeguardsRouter = createTRPCRouter({
  /** Whether the welcome card is shown to this person, with the form's pre-fill. */
  getWelcome: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const show = shouldShowWelcome(ctx.organization, ctx.session.user.id);
      if (!show) return { show: false as const };
      return {
        show: true as const,
        prefill: {
          name: ctx.session.user.name ?? "",
          email: ctx.session.user.email ?? "",
          organizationName: ctx.organization.name,
        },
      };
    }),

  /** The recorded answer and any open request, for the Settings card. */
  getStatus: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      if (!isHostedDeployment()) return { hosted: false as const };
      const openRequest = await ctx.prisma.safeguardsRequest.findFirst({
        where: { organizationId: ctx.organization.id, status: "open" },
        orderBy: { createdAt: "desc" },
        select: { choice: true, createdAt: true },
      });
      return {
        hosted: true as const,
        choice: ctx.organization.safeguardsChoice,
        choiceAt: ctx.organization.safeguardsChoiceAt,
        openRequest,
        prefill: {
          name: ctx.session.user.name ?? "",
          email: ctx.session.user.email ?? "",
          organizationName: ctx.organization.name,
        },
      };
    }),

  /**
   * Record an answer without a request: a, "decide later" (counts as a), or
   * b/c when the person chose "Not now" on the short form. Closes the card.
   */
  setChoice: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        choice: z.enum(ALL_CHOICES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertHosted();
      const now = new Date();
      await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          safeguardsChoice: input.choice,
          safeguardsChoiceById: ctx.session.user.id,
          safeguardsChoiceAt: now,
          welcomeUserId: null,
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Organization",
          entityId: ctx.organization.id,
          action: "UPDATE",
          changes: { safeguardsChoice: input.choice },
        },
      });
      return { choice: input.choice };
    }),

  /**
   * Choice b or c with the short form: record the answer, store the request
   * and mail it to the tech firm's sales inbox. Nobody else is contacted.
   */
  submitRequest: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        choice: z.enum(REQUEST_CHOICES),
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(320),
        organizationName: z.string().trim().min(1).max(200),
        country: z.string().trim().min(1).max(100),
        userCount: z.enum(USER_COUNT_BANDS),
        message: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertHosted();

      const open = await ctx.prisma.safeguardsRequest.count({
        where: { organizationId: ctx.organization.id, status: "open" },
      });
      if (open >= MAX_OPEN_REQUESTS_PER_ORG) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "We already have your request and will write to you.",
        });
      }

      const now = new Date();
      const locale = localeFromCookieGetter(ctx.getCookie) ?? "en";
      const request = await ctx.prisma.safeguardsRequest.create({
        data: {
          organizationId: ctx.organization.id,
          choice: input.choice,
          name: input.name,
          email: input.email,
          organizationName: input.organizationName,
          country: input.country,
          userCount: input.userCount,
          message: input.message ? input.message : null,
          locale,
        },
      });

      await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          safeguardsChoice: input.choice,
          safeguardsChoiceById: ctx.session.user.id,
          safeguardsChoiceAt: now,
          welcomeUserId: null,
        },
      });

      // Identifiers only: the person's details stay in the request row, which
      // the purge deletes; the audit trail keeps none of them.
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "SafeguardsRequest",
          entityId: request.id,
          action: "CREATE",
          changes: { safeguardsChoice: input.choice },
        },
      });

      // Never throws; a mail failure is logged loudly and the row is kept.
      const notice = await sendSafeguardsRequestNotice({
        id: request.id,
        organizationId: ctx.organization.id,
        choice: input.choice,
        name: input.name,
        email: input.email,
        organizationName: input.organizationName,
        country: input.country,
        userCount: input.userCount,
        message: input.message ? input.message : null,
        locale,
        createdAt: request.createdAt ?? now,
      });

      return { stored: true as const, delivered: notice.delivered };
    }),
});
