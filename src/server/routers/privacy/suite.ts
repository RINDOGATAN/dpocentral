// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The suite link to AI Sentinel, as this application's screens use it
 * (src/server/services/suite/link-ais.ts). Linking, unlinking and syncing on
 * demand are for owners and administrators; any member can read the state.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminOrgProcedure, createTRPCRouter, organizationProcedure, protectedProcedure } from "../../trpc";
import { isAiSentinelConfigured } from "../../services/ai-sentinel/client";
import {
  LINK_ROLES,
  SuiteCallError,
  aisLinkableOrganizations,
  dpoCentralPublicUrl,
  linkToAiSentinel,
  readAisLink,
  syncWithAiSentinel,
  unlinkFromAiSentinel,
} from "../../services/suite/link-ais";

function asTrpcError(err: unknown): TRPCError {
  if (err instanceof SuiteCallError) {
    const code =
      err.status === 403 ? "FORBIDDEN" : err.status === 404 ? "NOT_FOUND" : err.status === 409 ? "CONFLICT" : "BAD_GATEWAY";
    return new TRPCError({ code: code as "FORBIDDEN", message: err.message });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI Sentinel link failed" });
}

export const suiteRouter = createTRPCRouter({
  /** The link state of one organisation, for any member. */
  status: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const link = readAisLink(ctx.organization.settings);
      const fromAis = await ctx.prisma.aISystem.count({
        where: { organizationId: ctx.organization.id, metadata: { path: ["importedFrom"], equals: "aisentinel" } },
      });
      return {
        configured: isAiSentinelConfigured(),
        link,
        fromAiSentinel: fromAis,
        canManage: LINK_ROLES.includes(ctx.membership.role),
      };
    }),

  /** The organisations here and there the signed-in person may link. */
  options: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email ?? "";
    const memberships = await ctx.prisma.organizationMember.findMany({
      where: { userId: ctx.session.user.id, role: { in: [...LINK_ROLES] as ("OWNER" | "ADMIN")[] } },
      include: { organization: { select: { id: true, name: true, settings: true } } },
      orderBy: { joinedAt: "asc" },
    });
    const dpc = memberships.map((m) => {
      const link = readAisLink(m.organization.settings);
      return { id: m.organization.id, name: m.organization.name, linkedTo: link?.active ? link.aisOrganizationId : null };
    });
    if (!isAiSentinelConfigured() || !email) return { configured: false, dpc, ais: [], error: null as string | null };
    try {
      const ais = await aisLinkableOrganizations(email);
      return { configured: true, dpc, ais, error: null as string | null };
    } catch (err) {
      return { configured: true, dpc, ais: [], error: err instanceof Error ? err.message : "error" };
    }
  }),

  link: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), aisOrganizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.session.user.email;
      if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "Your account has no e-mail address" });
      const existing = readAisLink(ctx.organization.settings);
      if (existing?.active && existing.aisOrganizationId !== input.aisOrganizationId) {
        throw new TRPCError({ code: "CONFLICT", message: "This organization is already linked to another AI Sentinel organization." });
      }
      try {
        return await linkToAiSentinel(ctx.prisma, {
          organizationId: ctx.organization.id,
          aisOrganizationId: input.aisOrganizationId,
          userId: ctx.session.user.id,
          email,
          baseUrl: dpoCentralPublicUrl(),
        });
      } catch (err) {
        throw asTrpcError(err);
      }
    }),

  syncNow: adminOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      try {
        return await syncWithAiSentinel(ctx.prisma, ctx.organization.id, dpoCentralPublicUrl());
      } catch (err) {
        throw asTrpcError(err);
      }
    }),

  unlink: adminOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      return unlinkFromAiSentinel(ctx.prisma, ctx.organization.id, ctx.session.user.id, ctx.session.user.email ?? "");
    }),
});
