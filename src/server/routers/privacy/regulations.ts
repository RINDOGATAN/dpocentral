import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";

export const regulationsRouter = createTRPCRouter({
  // List all available jurisdictions from the catalog
  listAvailable: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        search: z.string().optional(),
        category: z.enum(["comprehensive", "sectoral", "ai_governance", "emerging"]).optional(),
        region: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch the jurisdiction catalog dynamically
      const { JURISDICTION_CATALOG } = await import("@/config/jurisdiction-catalog");

      let filtered = [...JURISDICTION_CATALOG];

      if (input.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter(
          (j) =>
            j.name.toLowerCase().includes(q) ||
            j.shortName.toLowerCase().includes(q) ||
            j.code.toLowerCase().includes(q) ||
            j.region.toLowerCase().includes(q)
        );
      }

      if (input.category) {
        filtered = filtered.filter((j) => j.category === input.category);
      }

      if (input.region) {
        filtered = filtered.filter((j) => j.region === input.region || j.country === input.region);
      }

      // Check which jurisdictions the org already has
      const orgJurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        include: { jurisdiction: true },
      });
      const appliedCodes = new Set(orgJurisdictions.map((oj) => oj.jurisdiction.code));

      return {
        jurisdictions: filtered.map((j) => ({
          ...j,
          isApplied: appliedCodes.has(j.code),
        })),
        totalApplied: orgJurisdictions.length,
      };
    }),

  // Get applicability wizard questions
  getApplicabilityQuestions: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async () => {
      const { APPLICABILITY_QUESTIONS } = await import("@/config/jurisdiction-catalog");
      return { questions: APPLICABILITY_QUESTIONS };
    }),

  // Check which jurisdictions apply based on wizard answers
  checkApplicability: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        answers: z.record(z.string(), z.boolean()),
      })
    )
    .query(async ({ input }) => {
      const { APPLICABILITY_QUESTIONS, JURISDICTION_CATALOG, getApplicableJurisdictions } =
        await import("@/config/jurisdiction-catalog");

      const applicable = getApplicableJurisdictions(input.answers);

      return {
        applicableJurisdictions: applicable,
        questionCount: APPLICABILITY_QUESTIONS.length,
        answeredCount: Object.keys(input.answers).length,
      };
    }),

  // Apply a jurisdiction to the organization
  applyJurisdiction: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        jurisdictionCode: z.string(),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { JURISDICTION_CATALOG } = await import("@/config/jurisdiction-catalog");

      const catalogEntry = JURISDICTION_CATALOG.find((j) => j.code === input.jurisdictionCode);
      if (!catalogEntry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Jurisdiction not found in catalog",
        });
      }

      // Upsert the jurisdiction in the DB
      const jurisdiction = await ctx.prisma.jurisdiction.upsert({
        where: { code: input.jurisdictionCode },
        update: {},
        create: {
          code: catalogEntry.code,
          name: catalogEntry.name,
          region: catalogEntry.region,
          dsarDeadlineDays: catalogEntry.dsarDeadlineDays,
          breachNotificationHours: catalogEntry.breachNotificationHours,
          requirements: {
            keyRequirements: catalogEntry.keyRequirements,
            applicabilityCriteria: catalogEntry.applicabilityCriteria,
            penalties: catalogEntry.penalties,
          },
        },
      });

      // Link to organization
      const orgJurisdiction = await ctx.prisma.organizationJurisdiction.upsert({
        where: {
          organizationId_jurisdictionId: {
            organizationId: ctx.organization.id,
            jurisdictionId: jurisdiction.id,
          },
        },
        update: { isPrimary: input.isPrimary },
        create: {
          organizationId: ctx.organization.id,
          jurisdictionId: jurisdiction.id,
          isPrimary: input.isPrimary,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationJurisdiction",
          entityId: orgJurisdiction.id,
          action: "CREATE",
          changes: { jurisdictionCode: input.jurisdictionCode, isPrimary: input.isPrimary },
        },
      });

      return { jurisdiction, orgJurisdiction };
    }),

  // Remove a jurisdiction from the organization
  removeJurisdiction: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        jurisdictionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.organizationJurisdiction.deleteMany({
        where: {
          organizationId: ctx.organization.id,
          jurisdictionId: input.jurisdictionId,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationJurisdiction",
          entityId: input.jurisdictionId,
          action: "DELETE",
        },
      });

      return { success: true };
    }),

  // List applied jurisdictions for the org
  listApplied: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const orgJurisdictions = await ctx.prisma.organizationJurisdiction.findMany({
        where: { organizationId: ctx.organization.id },
        include: { jurisdiction: true },
        orderBy: { createdAt: "asc" },
      });

      return {
        jurisdictions: orgJurisdictions.map((oj) => ({
          id: oj.id,
          jurisdictionId: oj.jurisdictionId,
          code: oj.jurisdiction.code,
          name: oj.jurisdiction.name,
          region: oj.jurisdiction.region,
          dsarDeadlineDays: oj.jurisdiction.dsarDeadlineDays,
          breachNotificationHours: oj.jurisdiction.breachNotificationHours,
          isPrimary: oj.isPrimary,
          createdAt: oj.createdAt,
        })),
      };
    }),
});
