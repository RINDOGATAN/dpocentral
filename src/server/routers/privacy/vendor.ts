import { z } from "zod";
import { createTRPCRouter, publicProcedure, organizationProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import {
  VendorStatus,
  VendorRiskTier,
  ContractType,
  ContractStatus,
  QuestionnaireStatus,
  TaskStatus,
  ReviewType,
  DataCategory,
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { hasVendorCatalogAccess } from "../../services/licensing/entitlement";

export const vendorRouter = createTRPCRouter({
  // ============================================================
  // VENDOR CATALOG ACCESS
  // ============================================================

  // Check if organization has vendor catalog access
  hasVendorCatalogAccess: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const hasAccess = await hasVendorCatalogAccess(ctx.organization.id);
      return { hasAccess };
    }),

  // ============================================================
  // VENDORS
  // ============================================================

  // List vendors
  list: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z.nativeEnum(VendorStatus).optional(),
        riskTier: z.nativeEnum(VendorRiskTier).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const vendors = await ctx.prisma.vendor.findMany({
        where: {
          organizationId: ctx.organization.id,
          status: input.status,
          riskTier: input.riskTier,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          _count: {
            select: {
              contracts: true,
              questionnaireResponses: true,
              reviews: true,
              assessments: true,
            },
          },
        },
        orderBy: [{ riskTier: "desc" }, { name: "asc" }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (vendors.length > input.limit) {
        const nextItem = vendors.pop();
        nextCursor = nextItem?.id;
      }

      return { vendors, nextCursor };
    }),

  // Get vendor by ID
  getById: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          contracts: {
            orderBy: { endDate: "asc" },
          },
          questionnaireResponses: {
            include: {
              questionnaire: true,
            },
            orderBy: { createdAt: "desc" },
          },
          reviews: {
            include: {
              reviewer: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { scheduledAt: "desc" },
          },
          assessments: {
            include: {
              template: {
                select: { id: true, name: true, type: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      return vendor;
    }),

  // Create vendor
  create: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        website: z.string().optional(),
        primaryContact: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        categories: z.array(z.string()).default([]),
        dataProcessed: z.array(z.nativeEnum(DataCategory)).default([]),
        countries: z.array(z.string()).default([]),
        certifications: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.create({
        data: {
          organizationId: ctx.organization.id,
          name: input.name,
          description: input.description,
          website: input.website,
          status: VendorStatus.PROSPECTIVE,
          primaryContact: input.primaryContact,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          address: input.address,
          categories: input.categories,
          dataProcessed: input.dataProcessed,
          countries: input.countries,
          certifications: input.certifications,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Vendor",
          entityId: vendor.id,
          action: "CREATE",
          changes: input,
        },
      });

      return vendor;
    }),

  // Update vendor
  update: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
        status: z.nativeEnum(VendorStatus).optional(),
        riskTier: z.nativeEnum(VendorRiskTier).optional().nullable(),
        riskScore: z.number().optional().nullable(),
        primaryContact: z.string().optional().nullable(),
        contactEmail: z.string().email().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        categories: z.array(z.string()).optional(),
        dataProcessed: z.array(z.nativeEnum(DataCategory)).optional(),
        countries: z.array(z.string()).optional(),
        certifications: z.array(z.string()).optional(),
        nextReviewAt: z.date().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const vendor = await ctx.prisma.vendor.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data,
      });

      if (vendor.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Vendor",
          entityId: id,
          action: "UPDATE",
          changes: data,
        },
      });

      return ctx.prisma.vendor.findUnique({ where: { id } });
    }),

  // Delete vendor
  delete: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (vendor.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Vendor",
          entityId: input.id,
          action: "DELETE",
        },
      });

      return { success: true };
    }),

  // ============================================================
  // CONTRACTS
  // ============================================================

  // Add contract
  addContract: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorId: z.string(),
        type: z.nativeEnum(ContractType),
        name: z.string().min(1),
        description: z.string().optional(),
        documentUrl: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        renewalDate: z.date().optional(),
        autoRenewal: z.boolean().default(false),
        value: z.number().optional(),
        currency: z.string().optional(),
        terms: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify vendor belongs to org
      const vendor = await ctx.prisma.vendor.findFirst({
        where: { id: input.vendorId, organizationId: ctx.organization.id },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      return ctx.prisma.vendorContract.create({
        data: {
          vendorId: input.vendorId,
          type: input.type,
          name: input.name,
          description: input.description,
          documentUrl: input.documentUrl,
          startDate: input.startDate,
          endDate: input.endDate,
          renewalDate: input.renewalDate,
          autoRenewal: input.autoRenewal,
          value: input.value,
          currency: input.currency,
          terms: input.terms,
          status: ContractStatus.DRAFT,
        },
      });
    }),

  // Update contract
  updateContract: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.nativeEnum(ContractStatus).optional(),
        name: z.string().optional(),
        description: z.string().optional().nullable(),
        documentUrl: z.string().optional().nullable(),
        startDate: z.date().optional().nullable(),
        endDate: z.date().optional().nullable(),
        renewalDate: z.date().optional().nullable(),
        autoRenewal: z.boolean().optional(),
        value: z.number().optional().nullable(),
        currency: z.string().optional().nullable(),
        terms: z.record(z.string(), z.any()).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, terms, ...restData } = input;

      const contract = await ctx.prisma.vendorContract.findFirst({
        where: { id },
        include: { vendor: true },
      });

      if (!contract || contract.vendor.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract not found",
        });
      }

      return ctx.prisma.vendorContract.update({
        where: { id },
        data: {
          ...restData,
          ...(terms !== undefined && { terms: terms ?? undefined }),
        },
      });
    }),

  // Delete contract
  deleteContract: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contract = await ctx.prisma.vendorContract.findFirst({
        where: { id: input.id },
        include: { vendor: true },
      });

      if (!contract || contract.vendor.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contract not found",
        });
      }

      await ctx.prisma.vendorContract.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ============================================================
  // QUESTIONNAIRES
  // ============================================================

  // List questionnaire templates
  listQuestionnaires: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.vendorQuestionnaire.findMany({
        where: {
          OR: [
            { organizationId: ctx.organization.id },
            { isSystem: true },
          ],
          isActive: true,
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      });
    }),

  // Send questionnaire to vendor
  sendQuestionnaire: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorId: z.string(),
        questionnaireId: z.string(),
        expiresInDays: z.number().min(1).max(90).default(14),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify vendor belongs to org
      const vendor = await ctx.prisma.vendor.findFirst({
        where: { id: input.vendorId, organizationId: ctx.organization.id },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const response = await ctx.prisma.vendorQuestionnaireResponse.create({
        data: {
          vendorId: input.vendorId,
          questionnaireId: input.questionnaireId,
          status: QuestionnaireStatus.NOT_STARTED,
          token,
          expiresAt,
        },
        include: {
          questionnaire: true,
          vendor: true,
        },
      });

      // TODO: Send email to vendor with link

      return {
        ...response,
        portalUrl: `/vendor-portal/${token}`,
      };
    }),

  // Review questionnaire response
  reviewQuestionnaireResponse: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
        reviewNotes: z.string().optional(),
        score: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.prisma.vendorQuestionnaireResponse.findFirst({
        where: { id: input.id },
        include: { vendor: true },
      });

      if (!response || response.vendor.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Response not found",
        });
      }

      return ctx.prisma.vendorQuestionnaireResponse.update({
        where: { id: input.id },
        data: {
          status: input.status as QuestionnaireStatus,
          reviewNotes: input.reviewNotes,
          score: input.score,
          reviewedAt: new Date(),
        },
      });
    }),

  // ============================================================
  // VENDOR PORTAL (Public endpoints)
  // ============================================================

  // Get questionnaire by token (public)
  getQuestionnaireByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const response = await ctx.prisma.vendorQuestionnaireResponse.findUnique({
        where: { token: input.token },
        include: {
          questionnaire: true,
          vendor: {
            select: { name: true },
          },
        },
      });

      if (!response) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      if (response.expiresAt && response.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This questionnaire has expired",
        });
      }

      if (response.status === QuestionnaireStatus.SUBMITTED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This questionnaire has already been submitted",
        });
      }

      return response;
    }),

  // Submit questionnaire response (public)
  submitQuestionnaireResponse: publicProcedure
    .input(
      z.object({
        token: z.string(),
        responses: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.prisma.vendorQuestionnaireResponse.findUnique({
        where: { token: input.token },
      });

      if (!response) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      if (response.expiresAt && response.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This questionnaire has expired",
        });
      }

      return ctx.prisma.vendorQuestionnaireResponse.update({
        where: { token: input.token },
        data: {
          responses: input.responses,
          status: QuestionnaireStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });
    }),

  // Save questionnaire progress (public)
  saveQuestionnaireProgress: publicProcedure
    .input(
      z.object({
        token: z.string(),
        responses: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.prisma.vendorQuestionnaireResponse.findUnique({
        where: { token: input.token },
      });

      if (!response) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Questionnaire not found",
        });
      }

      return ctx.prisma.vendorQuestionnaireResponse.update({
        where: { token: input.token },
        data: {
          responses: input.responses,
          status: QuestionnaireStatus.IN_PROGRESS,
        },
      });
    }),

  // ============================================================
  // REVIEWS
  // ============================================================

  // Schedule review
  scheduleReview: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorId: z.string(),
        reviewerId: z.string(),
        type: z.nativeEnum(ReviewType).default(ReviewType.PERIODIC),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: { id: input.vendorId, organizationId: ctx.organization.id },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        });
      }

      return ctx.prisma.vendorReview.create({
        data: {
          vendorId: input.vendorId,
          reviewerId: input.reviewerId,
          type: input.type,
          scheduledAt: input.scheduledAt,
          status: TaskStatus.TODO,
        },
        include: {
          reviewer: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // Complete review
  completeReview: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        findings: z.string().optional(),
        riskLevel: z.nativeEnum(VendorRiskTier).optional(),
        recommendations: z.string().optional(),
        nextReviewAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const review = await ctx.prisma.vendorReview.findFirst({
        where: { id },
        include: { vendor: true },
      });

      if (!review || review.vendor.organizationId !== ctx.organization.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found",
        });
      }

      // Update review
      const updated = await ctx.prisma.vendorReview.update({
        where: { id },
        data: {
          ...data,
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Update vendor risk level and next review date
      if (input.riskLevel || input.nextReviewAt) {
        await ctx.prisma.vendor.update({
          where: { id: review.vendorId },
          data: {
            riskTier: input.riskLevel,
            lastAssessedAt: new Date(),
            nextReviewAt: input.nextReviewAt,
          },
        });
      }

      return updated;
    }),

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const now = new Date();

      const [
        total,
        byStatus,
        byRiskTier,
        expiringContracts,
        pendingQuestionnaires,
        upcomingReviews,
      ] = await Promise.all([
        ctx.prisma.vendor.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.vendor.groupBy({
          by: ["status"],
          where: { organizationId: ctx.organization.id },
          _count: true,
        }),
        ctx.prisma.vendor.groupBy({
          by: ["riskTier"],
          where: {
            organizationId: ctx.organization.id,
            riskTier: { not: null },
          },
          _count: true,
        }),
        ctx.prisma.vendorContract.count({
          where: {
            vendor: { organizationId: ctx.organization.id },
            status: "ACTIVE",
            endDate: {
              gte: now,
              lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        ctx.prisma.vendorQuestionnaireResponse.count({
          where: {
            vendor: { organizationId: ctx.organization.id },
            status: "SUBMITTED",
          },
        }),
        ctx.prisma.vendorReview.count({
          where: {
            vendor: { organizationId: ctx.organization.id },
            status: "TODO",
            scheduledAt: {
              gte: now,
              lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        byRiskTier: byRiskTier.reduce((acc, r) => ({ ...acc, [r.riskTier!]: r._count }), {}),
        expiringContracts,
        pendingQuestionnaires,
        upcomingReviews,
      };
    }),
});
