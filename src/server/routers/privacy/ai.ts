// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AI posture + audit router.
 *
 * The per-organization switch for the optional embedded-AI assists.
 * Default posture is OFF (no row = off): the app makes zero AI calls until
 * an OWNER/ADMIN explicitly enables a posture AND acknowledges the
 * responsibility sentence (acknowledged: z.literal(true) — recorded as
 * acknowledgedById/At). Feature procedures live in their domain routers
 * (assessment.generateAiNarrative, incident.generateNotificationDraft) and
 * gate through services/ai/posture.ts requireAi.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, adminOrgProcedure } from "../../trpc";
import { getAIProviderName, isAIConfigured } from "../../services/ai/llm-door";
import {
  AI_RATE_LIMIT_PER_ORG_PER_HOUR,
  getLaneAvailability,
  postureLane,
} from "../../services/ai/posture";

export const AI_POSTURES = ["off", "local_gateway", "cloud_eu", "cloud_us"] as const;

export const aiRouter = createTRPCRouter({
  // Posture + engine status for the current organization (any member).
  getStatus: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const settings = await ctx.prisma.organizationAiSettings.findUnique({
        where: { organizationId: ctx.organization.id },
        include: {
          acknowledgedBy: { select: { id: true, name: true, email: true } },
        },
      });

      const posture = settings?.posture ?? "off";
      // configured/providerName describe the CURRENT posture's lane (posture
      // off -> the no-lane default engine), so the UI reports the engine that
      // would actually answer, not just "some engine exists".
      const lane = postureLane(posture);
      const configured = isAIConfigured(lane);

      return {
        posture,
        configured,
        providerName: configured ? getAIProviderName(lane) : null,
        // Per-lane engine availability so the posture picker can flag
        // postures with no engine behind them.
        lanes: getLaneAvailability(),
        acknowledgedAt: settings?.acknowledgedAt ?? null,
        acknowledgedBy: settings?.acknowledgedBy ?? null,
        // Generation can actually run only when both are true.
        active: posture !== "off" && configured,
        rateLimitPerHour: AI_RATE_LIMIT_PER_ORG_PER_HOUR,
      };
    }),

  // Set the organization's AI posture (OWNER/ADMIN only). The acknowledgment
  // checkbox is not optional — the input requires a literal true.
  setPosture: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        posture: z.enum(AI_POSTURES),
        acknowledged: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const settings = await ctx.prisma.organizationAiSettings.upsert({
        where: { organizationId: ctx.organization.id },
        create: {
          organizationId: ctx.organization.id,
          posture: input.posture,
          acknowledgedById: ctx.session.user.id,
          acknowledgedAt: now,
        },
        update: {
          posture: input.posture,
          acknowledgedById: ctx.session.user.id,
          acknowledgedAt: now,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationAiSettings",
          entityId: settings.id,
          action: "UPDATE",
          changes: { posture: input.posture, acknowledged: true },
        },
      });

      return settings;
    }),

  // Metadata-only generation audit (who/when/feature/model/tokens — no text).
  listGenerations: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.aiGeneration.findMany({
        where: { organizationId: ctx.organization.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
