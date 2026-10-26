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
 * The organisation's own API inference key (services/ai/org-key.ts): set
 * and removed by OWNER/ADMIN only, encrypted at rest, never returned after
 * saving (status gives the provider, model and last four characters), and
 * recorded in the audit trail (AI_KEY_SET, AI_KEY_REMOVED) without the key.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, organizationProcedure, adminOrgProcedure } from "../../trpc";
import { getAIProviderName, isAIConfigured } from "../../services/ai/llm-door";
import {
  checkOrgKeyInput,
  encryptOrgKey,
  keyLast4,
  OrgKeyInputError,
  OrgKeySecretMissingError,
  orgKeyRequired,
  ORG_AI_PROVIDERS,
  ORG_AI_PROVIDER_IDS,
  ORG_KEY_SETTINGS_PATH,
  resolveOrgEngine,
} from "../../services/ai/org-key";
import {
  AI_RATE_LIMIT_PER_ORG_PER_HOUR,
  getLaneAvailability,
  isAiBlockedForUsJurisdiction,
  postureLane,
} from "../../services/ai/posture";

export const AI_POSTURES = ["off", "local_gateway", "cloud_eu", "cloud_us"] as const;

/** The columns of the settings row that hold the key, cleared together. */
const NO_KEY = {
  keyProvider: null,
  keyBaseUrl: null,
  keyModel: null,
  keyCiphertext: null,
  keyIv: null,
  keyLast4: null,
  keySetById: null,
  keySetAt: null,
} as const;

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
      const usJurisdictionBlocked = await isAiBlockedForUsJurisdiction(
        ctx.prisma,
        ctx.organization.id
      );
      // The organisation's own key answers first; without one, the
      // deployment's engine for the CURRENT posture's lane (posture off ->
      // the no-lane default engine), unless the deployment requires an
      // organisation key. The key itself never leaves the server.
      const keyRequired = orgKeyRequired();
      const { state: keyState, engine } = resolveOrgEngine(settings);
      const lane = postureLane(posture);
      const configured = engine !== null || (!keyRequired && isAIConfigured(lane));
      const lanes = getLaneAvailability();

      return {
        posture,
        configured,
        providerName: engine ? engine.label : configured ? getAIProviderName(lane) : null,
        // Per-lane engine availability so the posture picker can flag
        // postures with no engine behind them. An organisation key serves
        // every lane.
        lanes: engine ? { local_gateway: true, cloud_eu: true, cloud_us: true } : lanes,
        orgKeyRequired: keyRequired,
        key: {
          state: keyState,
          provider: settings?.keyProvider ?? null,
          baseUrl: settings?.keyBaseUrl ?? null,
          model: settings?.keyModel ?? null,
          last4: settings?.keyLast4 ?? null,
          setAt: settings?.keySetAt ?? null,
        },
        keySettingsPath: ORG_KEY_SETTINGS_PATH,
        providers: ORG_AI_PROVIDER_IDS.map((id) => ({
          id,
          label: ORG_AI_PROVIDERS[id].label,
          needsBaseUrl: id === "openai_compatible",
          defaultModel: ORG_AI_PROVIDERS[id].defaultModel,
        })),
        acknowledgedAt: settings?.acknowledgedAt ?? null,
        acknowledgedBy: settings?.acknowledgedBy ?? null,
        // AI is unavailable to an organization that declares a US state,
        // whatever posture it saved (services/ai/posture.ts).
        usJurisdictionBlocked,
        // Generation can actually run only when all of these hold.
        active: posture !== "off" && configured && !usJurisdictionBlocked,
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
      // Switching AI on is refused while the organization declares a US
      // state; switching it off stays possible.
      if (
        input.posture !== "off" &&
        (await isAiBlockedForUsJurisdiction(ctx.prisma, ctx.organization.id))
      ) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_us_jurisdiction" });
      }

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

      // Never the whole row: it holds the encrypted key.
      return {
        id: settings.id,
        posture: settings.posture,
        acknowledgedById: settings.acknowledgedById,
        acknowledgedAt: settings.acknowledgedAt,
      };
    }),

  // Save the organisation's own API inference key (OWNER/ADMIN only). The
  // key is encrypted before it is stored and is never returned.
  setKey: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        provider: z.enum(ORG_AI_PROVIDER_IDS as [string, ...string[]]),
        apiKey: z.string().min(1).max(500),
        baseUrl: z.string().max(500).optional().nullable(),
        model: z.string().max(200).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let checked;
      try {
        checked = checkOrgKeyInput({
          provider: input.provider as keyof typeof ORG_AI_PROVIDERS,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
          model: input.model,
        });
      } catch (err) {
        if (err instanceof OrgKeyInputError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `ai_key_${err.problem}` });
        }
        throw err;
      }

      let sealed;
      try {
        sealed = encryptOrgKey(checked.apiKey, ctx.organization.id);
      } catch (err) {
        if (err instanceof OrgKeySecretMissingError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ai_key_no_secret" });
        }
        throw err;
      }

      const now = new Date();
      const data = {
        keyProvider: checked.provider,
        keyBaseUrl: checked.baseUrl,
        keyModel: checked.model,
        keyCiphertext: sealed.ciphertext,
        keyIv: sealed.iv,
        keyLast4: keyLast4(checked.apiKey),
        keySetById: ctx.session.user.id,
        keySetAt: now,
      };
      const settings = await ctx.prisma.organizationAiSettings.upsert({
        where: { organizationId: ctx.organization.id },
        create: { organizationId: ctx.organization.id, ...data },
        update: data,
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationAiSettings",
          entityId: settings.id,
          action: "AI_KEY_SET",
          // Never the key: the provider, the model and the last four characters.
          changes: { provider: checked.provider, model: checked.model, baseUrl: checked.baseUrl, last4: data.keyLast4 },
        },
      });

      return { provider: checked.provider, model: checked.model, baseUrl: checked.baseUrl, last4: data.keyLast4, setAt: now };
    }),

  // Remove the organisation's own key (OWNER/ADMIN only).
  removeKey: adminOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const settings = await ctx.prisma.organizationAiSettings.findUnique({
        where: { organizationId: ctx.organization.id },
      });
      if (!settings?.keyCiphertext) return { removed: false };

      await ctx.prisma.organizationAiSettings.update({
        where: { organizationId: ctx.organization.id },
        data: NO_KEY,
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationAiSettings",
          entityId: settings.id,
          action: "AI_KEY_REMOVED",
          changes: { provider: settings.keyProvider, last4: settings.keyLast4 },
        },
      });
      return { removed: true };
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
