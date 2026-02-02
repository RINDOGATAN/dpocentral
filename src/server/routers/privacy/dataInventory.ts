import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { DataAssetType, DataSensitivity, DataCategory, LegalBasis, TransferMechanism } from "@prisma/client";

export const dataInventoryRouter = createTRPCRouter({
  // ============================================================
  // DATA ASSETS
  // ============================================================

  // List all data assets
  listAssets: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        type: z.nativeEnum(DataAssetType).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const assets = await ctx.prisma.dataAsset.findMany({
        where: {
          organizationId: ctx.organization.id,
          type: input.type,
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
              dataElements: true,
              processingActivityAssets: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (assets.length > input.limit) {
        const nextItem = assets.pop();
        nextCursor = nextItem?.id;
      }

      return { assets, nextCursor };
    }),

  // Get a single data asset
  getAsset: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const asset = await ctx.prisma.dataAsset.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          dataElements: {
            orderBy: { name: "asc" },
          },
          processingActivityAssets: {
            include: {
              processingActivity: true,
            },
          },
          sourceFlows: {
            include: {
              destinationAsset: true,
            },
          },
          destFlows: {
            include: {
              sourceAsset: true,
            },
          },
        },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data asset not found",
        });
      }

      return asset;
    }),

  // Create a data asset
  createAsset: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        type: z.nativeEnum(DataAssetType),
        owner: z.string().optional(),
        location: z.string().optional(),
        hostingType: z.string().optional(),
        vendor: z.string().optional(),
        isProduction: z.boolean().default(true),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.prisma.dataAsset.create({
        data: {
          organizationId: ctx.organization.id,
          name: input.name,
          description: input.description,
          type: input.type,
          owner: input.owner,
          location: input.location,
          hostingType: input.hostingType,
          vendor: input.vendor,
          isProduction: input.isProduction,
          metadata: input.metadata,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataAsset",
          entityId: asset.id,
          action: "CREATE",
          changes: input,
        },
      });

      return asset;
    }),

  // Update a data asset
  updateAsset: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        type: z.nativeEnum(DataAssetType).optional(),
        owner: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        hostingType: z.string().optional().nullable(),
        vendor: z.string().optional().nullable(),
        isProduction: z.boolean().optional(),
        metadata: z.record(z.string(), z.any()).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, metadata, ...restData } = input;

      const asset = await ctx.prisma.dataAsset.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data: {
          ...restData,
          ...(metadata !== undefined && { metadata: metadata ?? undefined }),
        },
      });

      if (asset.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data asset not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataAsset",
          entityId: id,
          action: "UPDATE",
          changes: { ...restData, metadata },
        },
      });

      // Security: Return with org check to prevent data leak
      return ctx.prisma.dataAsset.findFirst({
        where: { id, organizationId: ctx.organization.id },
      });
    }),

  // Delete a data asset
  deleteAsset: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.prisma.dataAsset.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (asset.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data asset not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataAsset",
          entityId: input.id,
          action: "DELETE",
        },
      });

      return { success: true };
    }),

  // ============================================================
  // DATA ELEMENTS
  // ============================================================

  // Add data element to asset
  addElement: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        dataAssetId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        category: z.nativeEnum(DataCategory),
        sensitivity: z.nativeEnum(DataSensitivity).default(DataSensitivity.INTERNAL),
        isPersonalData: z.boolean().default(true),
        isSpecialCategory: z.boolean().default(false),
        retentionDays: z.number().optional(),
        legalBasis: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify asset belongs to org
      const asset = await ctx.prisma.dataAsset.findFirst({
        where: { id: input.dataAssetId, organizationId: ctx.organization.id },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data asset not found",
        });
      }

      const element = await ctx.prisma.dataElement.create({
        data: {
          organizationId: ctx.organization.id,
          dataAssetId: input.dataAssetId,
          name: input.name,
          description: input.description,
          category: input.category,
          sensitivity: input.sensitivity,
          isPersonalData: input.isPersonalData,
          isSpecialCategory: input.isSpecialCategory,
          retentionDays: input.retentionDays,
          legalBasis: input.legalBasis,
        },
      });

      return element;
    }),

  // Update data element
  updateElement: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        category: z.nativeEnum(DataCategory).optional(),
        sensitivity: z.nativeEnum(DataSensitivity).optional(),
        isPersonalData: z.boolean().optional(),
        isSpecialCategory: z.boolean().optional(),
        retentionDays: z.number().optional().nullable(),
        legalBasis: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const element = await ctx.prisma.dataElement.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data,
      });

      if (element.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data element not found",
        });
      }

      // Security: Return with org check to prevent data leak
      return ctx.prisma.dataElement.findFirst({
        where: { id, organizationId: ctx.organization.id },
      });
    }),

  // Delete data element
  deleteElement: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const element = await ctx.prisma.dataElement.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (element.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data element not found",
        });
      }

      return { success: true };
    }),

  // ============================================================
  // PROCESSING ACTIVITIES (ROPA)
  // ============================================================

  // List processing activities
  listActivities: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const activities = await ctx.prisma.processingActivity.findMany({
        where: {
          organizationId: ctx.organization.id,
          isActive: input.isActive,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { purpose: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          assets: {
            include: {
              dataAsset: true,
            },
          },
          _count: {
            select: {
              transfers: true,
              assessments: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (activities.length > input.limit) {
        const nextItem = activities.pop();
        nextCursor = nextItem?.id;
      }

      return { activities, nextCursor };
    }),

  // Get a single processing activity
  getActivity: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          assets: {
            include: {
              dataAsset: {
                include: {
                  dataElements: true,
                },
              },
            },
          },
          transfers: {
            include: {
              jurisdiction: true,
            },
          },
          assessments: true,
        },
      });

      if (!activity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Processing activity not found",
        });
      }

      return activity;
    }),

  // Create a processing activity
  createActivity: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        purpose: z.string().min(1),
        legalBasis: z.nativeEnum(LegalBasis),
        legalBasisDetail: z.string().optional(),
        dataSubjects: z.array(z.string()),
        categories: z.array(z.nativeEnum(DataCategory)),
        recipients: z.array(z.string()).default([]),
        retentionPeriod: z.string().optional(),
        retentionDays: z.number().optional(),
        automatedDecisionMaking: z.boolean().default(false),
        automatedDecisionDetail: z.string().optional(),
        assetIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { assetIds, organizationId: _orgId, ...data } = input;

      const activity = await ctx.prisma.processingActivity.create({
        data: {
          organizationId: ctx.organization.id,
          ...data,
          assets: {
            create: assetIds.map((assetId) => ({
              dataAssetId: assetId,
            })),
          },
        },
        include: {
          assets: {
            include: {
              dataAsset: true,
            },
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "ProcessingActivity",
          entityId: activity.id,
          action: "CREATE",
          changes: input,
        },
      });

      return activity;
    }),

  // Update a processing activity
  updateActivity: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        purpose: z.string().optional(),
        legalBasis: z.nativeEnum(LegalBasis).optional(),
        legalBasisDetail: z.string().optional().nullable(),
        dataSubjects: z.array(z.string()).optional(),
        categories: z.array(z.nativeEnum(DataCategory)).optional(),
        recipients: z.array(z.string()).optional(),
        retentionPeriod: z.string().optional().nullable(),
        retentionDays: z.number().optional().nullable(),
        automatedDecisionMaking: z.boolean().optional(),
        automatedDecisionDetail: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const activity = await ctx.prisma.processingActivity.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data,
      });

      if (activity.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Processing activity not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "ProcessingActivity",
          entityId: id,
          action: "UPDATE",
          changes: data,
        },
      });

      // Security: Return with org check to prevent data leak
      return ctx.prisma.processingActivity.findFirst({
        where: { id, organizationId: ctx.organization.id },
      });
    }),

  // Link assets to activity
  linkAssets: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        activityId: z.string(),
        assetIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify activity belongs to org
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: { id: input.activityId, organizationId: ctx.organization.id },
      });

      if (!activity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Processing activity not found",
        });
      }

      // Remove existing links and create new ones
      await ctx.prisma.processingActivityAsset.deleteMany({
        where: { processingActivityId: input.activityId },
      });

      await ctx.prisma.processingActivityAsset.createMany({
        data: input.assetIds.map((assetId) => ({
          processingActivityId: input.activityId,
          dataAssetId: assetId,
        })),
      });

      return { success: true };
    }),

  // ============================================================
  // DATA FLOWS
  // ============================================================

  // List data flows
  listFlows: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.dataFlow.findMany({
        where: { organizationId: ctx.organization.id },
        include: {
          sourceAsset: true,
          destinationAsset: true,
        },
        orderBy: { name: "asc" },
      });
    }),

  // Get a single data flow
  getFlow: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const flow = await ctx.prisma.dataFlow.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          sourceAsset: true,
          destinationAsset: true,
        },
      });

      if (!flow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data flow not found",
        });
      }

      return flow;
    }),

  // Create data flow
  createFlow: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        sourceAssetId: z.string(),
        destinationAssetId: z.string(),
        dataCategories: z.array(z.nativeEnum(DataCategory)),
        frequency: z.string().optional(),
        volume: z.string().optional(),
        encryptionMethod: z.string().optional(),
        isAutomated: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const flow = await ctx.prisma.dataFlow.create({
        data: {
          organizationId: ctx.organization.id,
          name: input.name,
          description: input.description,
          sourceAssetId: input.sourceAssetId,
          destinationAssetId: input.destinationAssetId,
          dataCategories: input.dataCategories,
          frequency: input.frequency,
          volume: input.volume,
          encryptionMethod: input.encryptionMethod,
          isAutomated: input.isAutomated,
        },
        include: {
          sourceAsset: true,
          destinationAsset: true,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataFlow",
          entityId: flow.id,
          action: "CREATE",
          changes: input,
        },
      });

      return flow;
    }),

  // Update data flow
  updateFlow: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        sourceAssetId: z.string().optional(),
        destinationAssetId: z.string().optional(),
        dataCategories: z.array(z.nativeEnum(DataCategory)).optional(),
        frequency: z.string().optional().nullable(),
        volume: z.string().optional().nullable(),
        encryptionMethod: z.string().optional().nullable(),
        isAutomated: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...data } = input;

      const flow = await ctx.prisma.dataFlow.updateMany({
        where: { id, organizationId: ctx.organization.id },
        data,
      });

      if (flow.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data flow not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataFlow",
          entityId: id,
          action: "UPDATE",
          changes: data,
        },
      });

      return ctx.prisma.dataFlow.findFirst({
        where: { id, organizationId: ctx.organization.id },
        include: {
          sourceAsset: true,
          destinationAsset: true,
        },
      });
    }),

  // Delete data flow
  deleteFlow: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const flow = await ctx.prisma.dataFlow.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });

      if (flow.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data flow not found",
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataFlow",
          entityId: input.id,
          action: "DELETE",
        },
      });

      return { success: true };
    }),

  // ============================================================
  // DATA TRANSFERS
  // ============================================================

  // List data transfers
  listTransfers: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return ctx.prisma.dataTransfer.findMany({
        where: { organizationId: ctx.organization.id },
        include: {
          processingActivity: true,
          jurisdiction: true,
        },
        orderBy: { name: "asc" },
      });
    }),

  // Create data transfer
  createTransfer: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        processingActivityId: z.string().optional(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        destinationCountry: z.string(),
        destinationOrg: z.string().optional(),
        jurisdictionId: z.string().optional(),
        mechanism: z.nativeEnum(TransferMechanism),
        safeguards: z.string().optional(),
        documentUrl: z.string().optional(),
        tiaCompleted: z.boolean().default(false),
        tiaDate: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const transfer = await ctx.prisma.dataTransfer.create({
        data: {
          organizationId: ctx.organization.id,
          processingActivityId: input.processingActivityId,
          name: input.name,
          description: input.description,
          destinationCountry: input.destinationCountry,
          destinationOrg: input.destinationOrg,
          jurisdictionId: input.jurisdictionId,
          mechanism: input.mechanism,
          safeguards: input.safeguards,
          documentUrl: input.documentUrl,
          tiaCompleted: input.tiaCompleted,
          tiaDate: input.tiaDate,
        },
        include: {
          processingActivity: true,
          jurisdiction: true,
        },
      });

      return transfer;
    }),

  // ============================================================
  // ROPA EXPORT
  // ============================================================

  // Export ROPA data
  exportROPA: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const activities = await ctx.prisma.processingActivity.findMany({
        where: {
          organizationId: ctx.organization.id,
          isActive: true,
        },
        include: {
          assets: {
            include: {
              dataAsset: {
                include: {
                  dataElements: true,
                },
              },
            },
          },
          transfers: {
            include: {
              jurisdiction: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Format for ROPA export
      return activities.map((activity) => ({
        name: activity.name,
        description: activity.description,
        purpose: activity.purpose,
        legalBasis: activity.legalBasis,
        legalBasisDetail: activity.legalBasisDetail,
        dataSubjects: activity.dataSubjects,
        dataCategories: activity.categories,
        recipients: activity.recipients,
        retentionPeriod: activity.retentionPeriod,
        automatedDecisionMaking: activity.automatedDecisionMaking,
        automatedDecisionDetail: activity.automatedDecisionDetail,
        systems: activity.assets.map((a) => ({
          name: a.dataAsset.name,
          type: a.dataAsset.type,
          location: a.dataAsset.location,
          elements: a.dataAsset.dataElements.map((e) => ({
            name: e.name,
            category: e.category,
            sensitivity: e.sensitivity,
          })),
        })),
        transfers: activity.transfers.map((t) => ({
          destination: t.destinationCountry,
          organization: t.destinationOrg,
          mechanism: t.mechanism,
          safeguards: t.safeguards,
        })),
        lastReviewed: activity.lastReviewedAt,
        nextReview: activity.nextReviewAt,
      }));
    }),
});
