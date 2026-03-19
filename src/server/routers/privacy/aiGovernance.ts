import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure, officerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { AIRiskLevel, AISystemStatus } from "@prisma/client";
import { createAssessmentFromActivity } from "../../services/assessment-auto-create";
import {
  isAiSentinelConfigured,
  checkAiSentinelAccount,
  exportAISystems,
} from "../../services/ai-sentinel/client";
import type { DPCSystemPayload } from "../../services/ai-sentinel/types";

export const aiGovernanceRouter = createTRPCRouter({
  // ============================================================
  // AI SYSTEMS
  // ============================================================

  // List AI systems
  list: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        riskLevel: z.nativeEnum(AIRiskLevel).optional(),
        status: z.nativeEnum(AISystemStatus).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const systems = await ctx.prisma.aISystem.findMany({
        where: {
          organizationId: ctx.organization.id,
          riskLevel: input.riskLevel,
          status: input.status,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
              { provider: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          vendor: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ riskLevel: "asc" }, { name: "asc" }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (systems.length > input.limit) {
        const nextItem = systems.pop();
        nextCursor = nextItem?.id;
      }

      return { systems, nextCursor };
    }),

  // Get AI system by ID
  getById: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const system = await ctx.prisma.aISystem.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          vendor: {
            select: { id: true, name: true, certifications: true },
          },
        },
      });

      if (!system) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "AI system not found",
        });
      }

      return system;
    }),

  // Register a new AI system
  create: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        purpose: z.string().optional(),
        riskLevel: z.nativeEnum(AIRiskLevel).default(AIRiskLevel.MINIMAL),
        category: z.string().optional(),
        vendorId: z.string().optional(),
        modelType: z.string().optional(),
        provider: z.string().optional(),
        deployer: z.string().optional(),
        trainingDataSources: z.array(z.string()).default([]),
        humanOversight: z.string().optional(),
        transparencyMeasures: z.string().optional(),
        technicalDocUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const system = await ctx.prisma.aISystem.create({
        data: {
          organizationId: ctx.organization.id,
          name: input.name,
          description: input.description,
          purpose: input.purpose,
          riskLevel: input.riskLevel,
          category: input.category,
          vendorId: input.vendorId,
          modelType: input.modelType,
          provider: input.provider,
          deployer: input.deployer,
          trainingDataSources: input.trainingDataSources,
          humanOversight: input.humanOversight,
          transparencyMeasures: input.transparencyMeasures,
          technicalDocUrl: input.technicalDocUrl,
          status: AISystemStatus.DRAFT,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "AISystem",
          entityId: system.id,
          action: "CREATE",
          changes: input,
        },
      });

      return system;
    }),

  // Update AI system
  update: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional().nullable(),
        purpose: z.string().optional().nullable(),
        riskLevel: z.nativeEnum(AIRiskLevel).optional(),
        category: z.string().optional().nullable(),
        status: z.nativeEnum(AISystemStatus).optional(),
        vendorId: z.string().optional().nullable(),
        modelType: z.string().optional().nullable(),
        provider: z.string().optional().nullable(),
        deployer: z.string().optional().nullable(),
        trainingDataSources: z.array(z.string()).optional(),
        humanOversight: z.string().optional().nullable(),
        transparencyMeasures: z.string().optional().nullable(),
        technicalDocUrl: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const existing = await ctx.prisma.aISystem.findFirst({
        where: { id, organizationId: ctx.organization.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "AI system not found",
        });
      }

      const updated = await ctx.prisma.aISystem.update({
        where: { id },
        data,
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "AISystem",
          entityId: id,
          action: "UPDATE",
          changes: data,
        },
      });

      return updated;
    }),

  // Delete AI system
  delete: officerProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.aISystem.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "AI system not found",
        });
      }

      await ctx.prisma.aISystem.delete({ where: { id: input.id } });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "AISystem",
          entityId: input.id,
          action: "DELETE",
          changes: { name: existing.name },
        },
      });

      return { success: true };
    }),

  // Suggest risk level based on purpose/category
  suggestRiskLevel: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        purpose: z.string(),
        category: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { suggestRiskLevel } = await import("@/config/ai-act-classifications");
      return suggestRiskLevel(input.purpose, input.category ?? "");
    }),

  // Get classifications catalog
  getClassifications: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async () => {
      const { AI_ACT_CATEGORIES, getObligationsForRiskLevel } = await import(
        "@/config/ai-act-classifications"
      );
      return {
        categories: AI_ACT_CATEGORIES,
        obligations: {
          UNACCEPTABLE: getObligationsForRiskLevel("UNACCEPTABLE"),
          HIGH_RISK: getObligationsForRiskLevel("HIGH_RISK"),
          LIMITED: getObligationsForRiskLevel("LIMITED"),
          MINIMAL: getObligationsForRiskLevel("MINIMAL"),
        },
      };
    }),

  // Get stats
  getStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const [total, byRiskLevel, byStatus] = await Promise.all([
        ctx.prisma.aISystem.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.aISystem.groupBy({
          by: ["riskLevel"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.aISystem.groupBy({
          by: ["status"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
      ]);

      return {
        total,
        byRiskLevel: byRiskLevel.reduce(
          (acc, r) => ({ ...acc, [r.riskLevel]: r._count }),
          {} as Record<string, number>
        ),
        byStatus: byStatus.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count }),
          {} as Record<string, number>
        ),
      };
    }),

  // ============================================================
  // AI SENTINEL INTEGRATION
  // ============================================================

  // Check AI Sentinel connection status
  checkAiSentinelConnection: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const configured = isAiSentinelConfigured();
      if (!configured) {
        return { configured: false as const };
      }

      const userEmail = ctx.session.user.email ?? "";
      const account = await checkAiSentinelAccount(userEmail);

      return {
        configured: true as const,
        url: process.env.AI_SENTINEL_API_URL,
        userHasAisAccount: account.hasAccount,
        userHasAisOrg: account.hasOrg,
        aisOrgId: account.orgId,
      };
    }),

  // Export AI Systems to AI Sentinel
  exportToAiSentinel: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        systemIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAiSentinelConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI Sentinel integration is not configured",
        });
      }

      // Fetch selected (or all) AI Systems
      const systems = await ctx.prisma.aISystem.findMany({
        where: {
          organizationId: ctx.organization.id,
          ...(input.systemIds ? { id: { in: input.systemIds } } : {}),
        },
        include: {
          vendor: { select: { id: true, name: true } },
        },
      });

      if (systems.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No AI systems found to export",
        });
      }

      // Map to DPC payload
      const payloads: DPCSystemPayload[] = systems.map((s) => ({
        name: s.name,
        description: s.description,
        purpose: s.purpose,
        riskLevel: s.riskLevel,
        category: s.category,
        modelType: s.modelType,
        provider: s.provider,
        deployer: s.deployer,
        trainingDataSources: s.trainingDataSources,
        aiCapabilities: s.aiCapabilities,
        aiTechniques: s.aiTechniques,
        euAiActRole: s.euAiActRole,
        euAiActCompliant: s.euAiActCompliant,
        iso42001Certified: s.iso42001Certified,
        humanOversight: s.humanOversight,
        transparencyMeasures: s.transparencyMeasures,
        technicalDocUrl: s.technicalDocUrl,
        vendorName: s.vendor?.name,
        dpoCentralSystemId: s.id,
        dpoCentralVendorId: s.vendorId ?? undefined,
      }));

      const result = await exportAISystems(ctx.session.user.email ?? "", payloads);

      // Update synced systems with AIS IDs
      for (const mapping of result.mapped) {
        await ctx.prisma.aISystem.update({
          where: { id: mapping.dpcId },
          data: {
            aiSentinelSystemId: mapping.aisId,
            aiSentinelSyncedAt: new Date(),
          },
        });
      }

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "AISystem",
          entityId: ctx.organization.id,
          action: "EXPORT_TO_AI_SENTINEL",
          changes: {
            exported: result.exported,
            alreadyExisted: result.alreadyExisted,
            skipped: result.skipped,
            systemCount: systems.length,
          },
        },
      });

      return result;
    }),
});
