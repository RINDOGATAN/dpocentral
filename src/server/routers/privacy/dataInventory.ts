// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { transferOverlay } from "@/server/services/data-flows/transfer-markers";
import { canonicalCountryCode, isIsoCountryCode } from "@/lib/country-code";
import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure, adminOrgProcedure } from "../../trpc";
import { markConfirmed } from "@/server/services/template-items/mark";
import { withDerivedRisk } from "@/server/services/assessment/risk-score";
import { TRPCError } from "@trpc/server";
import { DataAssetType, DataSensitivity, DataCategory, LegalBasis, ProcessingRole, TransferMechanism, Prisma } from "@prisma/client";
import { hasRopaExportAccess } from "../../services/licensing/entitlement";
import { assertIdsInOrg } from "../../org-ownership";
import {
  businessUnitScopeWhere,
  departmentForNewRecord,
  departmentScopeConditions,
  elementScopeWhere,
  flowScopeWhere,
  loadBusinessUnitScope,
  mayUseDepartment,
  scopeAnd,
  transferScopeWhere,
  type BusinessUnitScope,
} from "@/server/services/business-units/scope";
import type { Db } from "@/lib/prisma";
import { CHECKLIST_STATES, checklistAnswersOf, withChecklistAnswer } from "@/lib/transfer-checklist";
import {
  generateFlowsForActivity,
  syncGeneratedFlows,
  takenOverMetadata,
  isDraftFlow,
  confirmedMetadata,
} from "@/server/services/data-flows/auto-flows";

// Generated flows (activity -> chain of its systems): see
// src/server/services/data-flows/auto-flows.ts.

/**
 * A transfer's destination: an ISO 3166-1 alpha-2 code, trimmed and in
 * capitals, with the aliases UK and EL stored as GB and GR (the adequacy and
 * EEA rules compare codes).
 */
const transferCountrySchema = z
  .string()
  .transform((v) => canonicalCountryCode(v))
  .refine((v) => isIsoCountryCode(v), { message: "The destination must be a two-letter ISO 3166 country code." });

/**
 * Validate a department id: null/undefined clears it; a non-empty id must belong
 * to this organisation, so a record can never point at another org's department.
 * Returns the id to store (or null).
 */
async function resolveBusinessUnitId(
  prisma: Pick<Db, "businessUnit">,
  organizationId: string,
  businessUnitId: string | null | undefined,
): Promise<string | null> {
  if (!businessUnitId) return null;
  const found = await prisma.businessUnit.findFirst({
    where: { id: businessUnitId, organizationId },
    select: { id: true },
  });
  if (!found) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown department." });
  }
  return businessUnitId;
}

// Department scope (src/server/services/business-units/scope.ts): a member
// limited to departments reads and writes only the systems, records, elements,
// flows and transfers of those departments, on every procedure below, not only
// on the lists.
const OUTSIDE_DEPARTMENT = "That department is outside your access.";
const CHOOSE_DEPARTMENT = "Choose one of your departments for this record.";
const TRANSFER_NEEDS_ACTIVITY = "Link this transfer to a processing activity of your department.";

function scopeOf(ctx: { prisma: Pick<Db, "businessUnitMember">; membership: { id: string } }): Promise<BusinessUnitScope> {
  return loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
}

/** The department a new record goes to, or a refusal (see departmentForNewRecord). */
function newRecordDepartment(scope: BusinessUnitScope, requested: string | null | undefined) {
  const r = departmentForNewRecord(scope, requested);
  if (!r.ok) {
    throw r.reason === "outside"
      ? new TRPCError({ code: "FORBIDDEN", message: OUTSIDE_DEPARTMENT })
      : new TRPCError({ code: "BAD_REQUEST", message: CHOOSE_DEPARTMENT });
  }
  return r.businessUnitId;
}

function assertMayUseDepartment(scope: BusinessUnitScope, businessUnitId: string | null | undefined) {
  if (!mayUseDepartment(scope, businessUnitId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: OUTSIDE_DEPARTMENT });
  }
}

/**
 * Art. 30 fields of an activity: its role (controller, joint controller or
 * processor), the joint controller, its own security measures (empty: the
 * organisation's general description applies) and, for a processor activity,
 * the controller on whose behalf it is carried out.
 */
const ART30_ACTIVITY_FIELDS = {
  role: z.nativeEnum(ProcessingRole).optional(),
  jointControllerDetails: z.string().max(5000).nullable().optional(),
  securityMeasures: z.string().max(5000).nullable().optional(),
  clientControllerName: z.string().max(300).nullable().optional(),
  clientControllerContact: z.string().max(5000).nullable().optional(),
  clientRepresentative: z.string().max(5000).nullable().optional(),
  clientDpo: z.string().max(5000).nullable().optional(),
};

/** A review date as the form sends it ("YYYY-MM-DD"), stored at UTC midnight. */
const reviewDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(`${v}T00:00:00.000Z`)));

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
        // The department to narrow to (a business unit id, or "unassigned"), on
        // top of whatever the member is already limited to server-side.
        department: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      const deptConditions = departmentScopeConditions(scope, input.department);
      const assets = await ctx.prisma.dataAsset.findMany({
        where: {
          organizationId: ctx.organization.id,
          type: input.type,
          ...(deptConditions.length > 0 ? { AND: deptConditions as never } : {}),
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        include: {
          dataElements: {
            orderBy: { name: "asc" as const },
          },
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
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      const deptConditions = departmentScopeConditions(scope);
      const asset = await ctx.prisma.dataAsset.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
          ...(deptConditions.length > 0 ? { AND: deptConditions as never } : {}),
        },
        include: {
          dataElements: {
            orderBy: { name: "asc" },
          },
          processingActivityAssets: {
            include: {
              processingActivity: true,
              linkedElements: {
                include: { dataElement: true },
              },
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
          message: "System not found",
        });
      }

      return asset;
    }),

  // Create a data asset
  createAsset: writerProcedure
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
        businessUnitId: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const businessUnitId = await resolveBusinessUnitId(
        ctx.prisma,
        ctx.organization.id,
        newRecordDepartment(scope, input.businessUnitId),
      );
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
          businessUnitId,
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
  updateAsset: writerProcedure
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
        businessUnitId: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.any()).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, metadata, businessUnitId, ...restData } = input;
      const scope = await scopeOf(ctx);

      if (businessUnitId !== undefined) {
        assertMayUseDepartment(scope, businessUnitId);
        await resolveBusinessUnitId(ctx.prisma, ctx.organization.id, businessUnitId);
      }

      const asset = await ctx.prisma.dataAsset.updateMany({
        where: { id, organizationId: ctx.organization.id, ...scopeAnd(scope) },
        data: {
          ...restData,
          ...(businessUnitId !== undefined && { businessUnitId }),
          ...(metadata !== undefined && { metadata: metadata ?? undefined }),
        },
      });

      if (asset.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "System not found",
        });
      }

      // A person has taken ownership: a template item they edit is kept.
      await markConfirmed(ctx.prisma, {
        model: "dataAsset",
        id,
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
      });

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
  deleteAsset: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // The activities this system belongs to: their generated chains close
      // the gap it leaves (A -> B -> C becomes A -> C).
      const scope = await scopeOf(ctx);
      const linkedActivities = await ctx.prisma.processingActivityAsset.findMany({
        where: { dataAssetId: input.id, processingActivity: { organizationId: ctx.organization.id } },
        select: { processingActivityId: true },
      });

      const asset = await ctx.prisma.dataAsset.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id, ...scopeAnd(scope) },
      });

      if (asset.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "System not found",
        });
      }

      if (linkedActivities.length > 0) {
        await syncGeneratedFlows(
          ctx.prisma,
          ctx.organization.id,
          linkedActivities.map((l) => l.processingActivityId)
        );
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

  // Get a single data element with parent asset and linked activities
  getElement: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const element = await ctx.prisma.dataElement.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id, ...elementScopeWhere(scope) },
        include: {
          dataAsset: {
            select: { id: true, name: true, type: true, vendor: true },
          },
          activityAssetLinks: {
            include: {
              processingActivityAsset: {
                include: {
                  processingActivity: {
                    select: {
                      id: true,
                      name: true,
                      purpose: true,
                      legalBasis: true,
                      isActive: true,
                      businessUnitId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!element) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data element not found",
        });
      }

      // Only the records the member may see (a limited member's system can be
      // used by another department's record).
      const linkedActivities = element.activityAssetLinks
        .filter((link) => scope.all || mayUseDepartment(scope, link.processingActivityAsset.processingActivity.businessUnitId))
        .map((link) => {
          const { businessUnitId: _bu, ...activity } = link.processingActivityAsset.processingActivity;
          void _bu;
          return { linkId: link.id, activity };
        });

      return {
        id: element.id,
        name: element.name,
        description: element.description,
        category: element.category,
        sensitivity: element.sensitivity,
        isPersonalData: element.isPersonalData,
        isSpecialCategory: element.isSpecialCategory,
        retentionDays: element.retentionDays,
        legalBasis: element.legalBasis,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt,
        dataAsset: element.dataAsset,
        linkedActivities,
      };
    }),

  // Add data element to asset
  addElement: writerProcedure
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
      // Verify asset belongs to org (and to the member's departments)
      const scope = await scopeOf(ctx);
      const asset = await ctx.prisma.dataAsset.findFirst({
        where: { id: input.dataAssetId, organizationId: ctx.organization.id, ...scopeAnd(scope) },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "System not found",
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
  updateElement: writerProcedure
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
      const scope = await scopeOf(ctx);

      const element = await ctx.prisma.dataElement.updateMany({
        where: { id, organizationId: ctx.organization.id, ...elementScopeWhere(scope) },
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
  deleteElement: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const element = await ctx.prisma.dataElement.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id, ...elementScopeWhere(scope) },
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
        department: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      const deptConditions = departmentScopeConditions(scope, input.department);
      const activities = await ctx.prisma.processingActivity.findMany({
        where: {
          organizationId: ctx.organization.id,
          isActive: input.isActive,
          ...(deptConditions.length > 0 ? { AND: deptConditions as never } : {}),
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
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      const deptConditions = departmentScopeConditions(scope);
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
          ...(deptConditions.length > 0 ? { AND: deptConditions as never } : {}),
        },
        include: {
          assets: {
            include: {
              linkedElements: {
                include: { dataElement: true },
              },
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
  createActivity: writerProcedure
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
        ...ART30_ACTIVITY_FIELDS,
        businessUnitId: z.string().nullable().optional(),
        assetIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { assetIds, organizationId: _orgId, businessUnitId, ...data } = input;
      const scope = await scopeOf(ctx);

      // Every linked asset must belong to the caller's organisation (and to
      // the member's departments)
      await assertIdsInOrg(
        ctx.prisma.dataAsset,
        assetIds,
        { organizationId: ctx.organization.id, ...scopeAnd(scope) },
        "Data asset"
      );

      const resolvedBusinessUnitId = await resolveBusinessUnitId(
        ctx.prisma,
        ctx.organization.id,
        newRecordDepartment(scope, businessUnitId),
      );

      const activity = await ctx.prisma.processingActivity.create({
        data: {
          organizationId: ctx.organization.id,
          businessUnitId: resolvedBusinessUnitId,
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
  updateActivity: writerProcedure
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
        ...ART30_ACTIVITY_FIELDS,
        // When the activity was last reviewed and when it is next due (Art. 24(1)).
        lastReviewedAt: reviewDate,
        nextReviewAt: reviewDate,
        businessUnitId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, businessUnitId, ...data } = input;
      const scope = await scopeOf(ctx);

      if (businessUnitId !== undefined) {
        // A limited member may not move a record out of their departments.
        assertMayUseDepartment(scope, businessUnitId);
        await resolveBusinessUnitId(ctx.prisma, ctx.organization.id, businessUnitId);
      }

      const activity = await ctx.prisma.processingActivity.updateMany({
        where: { id, organizationId: ctx.organization.id, ...scopeAnd(scope) },
        data: {
          ...data,
          ...(businessUnitId !== undefined && { businessUnitId }),
        },
      });

      if (activity.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Processing activity not found",
        });
      }

      // Switching an activity off removes its generated flows from the map;
      // switching it back on draws them again.
      if (data.isActive !== undefined) {
        await syncGeneratedFlows(ctx.prisma, ctx.organization.id, [id]);
      }

      // A person has taken ownership: a template item they edit is kept.
      await markConfirmed(ctx.prisma, {
        model: "processingActivity",
        id,
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
      });

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

  // Link assets to activity (with optional element-level granularity)
  // Delete a processing activity (owners and admins). Its links to systems
  // go with it (cascade); transfers and assessments that pointed at it are
  // kept and lose the link (SetNull); the flows generated from it go too.
  deleteActivity: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id, ...scopeAnd(scope) },
        select: { id: true, name: true },
      });
      if (!activity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Processing activity not found" });
      }
      await ctx.prisma.processingActivity.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });
      await syncGeneratedFlows(ctx.prisma, ctx.organization.id, [input.id]);
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "ProcessingActivity",
          entityId: input.id,
          action: "DELETE",
          changes: { name: activity.name },
        },
      });
      return { success: true };
    }),

  linkAssets: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        activityId: z.string(),
        assets: z.array(
          z.object({
            assetId: z.string(),
            elementIds: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify activity belongs to org (and to the member's departments)
      const scope = await scopeOf(ctx);
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: { id: input.activityId, organizationId: ctx.organization.id, ...scopeAnd(scope) },
      });

      if (!activity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Processing activity not found",
        });
      }

      // Every asset, and every element of that asset, must belong to the
      // caller's organisation (checked before the existing links are removed)
      await assertIdsInOrg(
        ctx.prisma.dataAsset,
        input.assets.map((a) => a.assetId),
        { organizationId: ctx.organization.id, ...scopeAnd(scope) },
        "Data asset"
      );
      for (const { assetId, elementIds } of input.assets) {
        await assertIdsInOrg(
          ctx.prisma.dataElement,
          elementIds ?? [],
          { organizationId: ctx.organization.id, dataAssetId: assetId },
          "Data element"
        );
      }

      // Remove existing links (cascade deletes element links). A limited
      // member replaces only the links to systems they can see; links to
      // other departments' systems stay.
      const assetInScope = businessUnitScopeWhere(scope);
      await ctx.prisma.processingActivityAsset.deleteMany({
        where: { processingActivityId: input.activityId, ...(assetInScope ? { dataAsset: assetInScope } : {}) },
      });

      // Create asset links with optional element-level specificity
      for (const { assetId, elementIds } of input.assets) {
        const paAsset = await ctx.prisma.processingActivityAsset.create({
          data: {
            processingActivityId: input.activityId,
            dataAssetId: assetId,
          },
        });

        if (elementIds && elementIds.length > 0) {
          await ctx.prisma.processingActivityAssetElement.createMany({
            data: elementIds.map((dataElementId) => ({
              processingActivityAssetId: paAsset.id,
              dataElementId,
            })),
          });
        }
      }

      // The activity's generated flows follow its systems: stale ones go,
      // missing ones are drawn.
      const { created: flowsCreated, removed: flowsRemoved } = await syncGeneratedFlows(
        ctx.prisma,
        ctx.organization.id,
        [input.activityId]
      );

      return { success: true, flowsCreated, flowsRemoved };
    }),

  // Link processing activities to a data asset (with optional element-level granularity)
  linkActivitiesToAsset: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        assetId: z.string(),
        activities: z.array(
          z.object({
            activityId: z.string(),
            elementIds: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const asset = await ctx.prisma.dataAsset.findFirst({
        where: { id: input.assetId, organizationId: ctx.organization.id, ...scopeAnd(scope) },
      });

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "System not found",
        });
      }

      // Every activity, and every element of this asset, must belong to the
      // caller's organisation (checked before the existing links are removed)
      await assertIdsInOrg(
        ctx.prisma.processingActivity,
        input.activities.map((a) => a.activityId),
        { organizationId: ctx.organization.id, ...scopeAnd(scope) },
        "Processing activity"
      );
      await assertIdsInOrg(
        ctx.prisma.dataElement,
        input.activities.flatMap((a) => a.elementIds ?? []),
        { organizationId: ctx.organization.id, dataAssetId: input.assetId },
        "Data element"
      );

      // Activities this asset was linked to before: their chains change too.
      // A limited member replaces only the links to records they can see.
      const activityInScope = businessUnitScopeWhere(scope);
      const linkScope = activityInScope ? { processingActivity: activityInScope } : {};
      const previous = await ctx.prisma.processingActivityAsset.findMany({
        where: { dataAssetId: input.assetId, ...linkScope },
        select: { processingActivityId: true },
      });

      // Remove existing links for this asset (cascade deletes element links)
      await ctx.prisma.processingActivityAsset.deleteMany({
        where: { dataAssetId: input.assetId, ...linkScope },
      });

      // Create activity links with optional element-level specificity
      for (const { activityId, elementIds } of input.activities) {
        const paAsset = await ctx.prisma.processingActivityAsset.create({
          data: {
            processingActivityId: activityId,
            dataAssetId: input.assetId,
          },
        });

        if (elementIds && elementIds.length > 0) {
          await ctx.prisma.processingActivityAssetElement.createMany({
            data: elementIds.map((dataElementId) => ({
              processingActivityAssetId: paAsset.id,
              dataElementId,
            })),
          });
        }
      }

      // Bring the generated flows of every affected activity (linked before
      // or now) in line with their systems.
      const { created: flowsCreated, removed: flowsRemoved } = await syncGeneratedFlows(
        ctx.prisma,
        ctx.organization.id,
        [...previous.map((p) => p.processingActivityId), ...input.activities.map((a) => a.activityId)]
      );

      return { success: true, flowsCreated, flowsRemoved };
    }),

  // Manually trigger flow generation for an activity (useful for
  // existing activities where flows weren't auto-generated at link time,
  // or when the user wants to regenerate after editing assets).
  regenerateFlows: writerProcedure
    .input(z.object({ organizationId: z.string(), activityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const activity = await ctx.prisma.processingActivity.findFirst({
        where: { id: input.activityId, organizationId: ctx.organization.id, ...scopeAnd(scope) },
        select: { id: true },
      });
      if (!activity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Processing activity not found" });
      }
      const flowsCreated = await generateFlowsForActivity(
        ctx.prisma,
        ctx.organization.id,
        input.activityId
      );
      return { flowsCreated };
    }),

  // Regenerate flows for all activities in the org
  regenerateAllFlows: writerProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const scope = await scopeOf(ctx);
      const activities = await ctx.prisma.processingActivity.findMany({
        where: { organizationId: ctx.organization.id, isActive: true, ...scopeAnd(scope) },
        select: { id: true },
      });
      let flowsCreated = 0;
      for (const a of activities) {
        flowsCreated += await generateFlowsForActivity(
          ctx.prisma,
          ctx.organization.id,
          a.id
        );
      }
      return { flowsCreated, activitiesProcessed: activities.length };
    }),

  // ============================================================
  // DATA FLOWS
  // ============================================================

  // List data flows
  listFlows: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const scope = await scopeOf(ctx);
      return ctx.prisma.dataFlow.findMany({
        where: { organizationId: ctx.organization.id, ...flowScopeWhere(scope) },
        include: {
          sourceAsset: true,
          destinationAsset: true,
        },
        orderBy: { name: "asc" },
      });
    }),

  // The map's transfer layer: which systems send data outside the EEA, every
  // transfer outside the EEA with its safeguard and status, and the vendors
  // drawn as nodes of their own (src/server/services/data-flows/transfer-markers.ts).
  mapTransferMarkers: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organization.id;
      const scope = await scopeOf(ctx);
      const [assets, transfers, vendors] = await Promise.all([
        ctx.prisma.dataAsset.findMany({
          where: { organizationId, ...scopeAnd(scope) },
          select: { id: true, name: true, vendor: true, type: true },
        }),
        ctx.prisma.dataTransfer.findMany({
          where: { organizationId, isActive: true, ...transferScopeWhere(scope) },
          select: {
            id: true,
            name: true,
            vendorId: true,
            destinationCountry: true,
            destinationOrg: true,
            processingActivityId: true,
            isActive: true,
            mechanism: true,
            tiaCompleted: true,
            sccExpiryDate: true,
            complianceStatus: true,
            adequacyScopeConfirmed: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        // Vendors in use: their countries flag transfers not yet recorded.
        ctx.prisma.vendor.findMany({
          where: { organizationId, status: { not: "TERMINATED" } },
          select: { id: true, name: true, countries: true },
          orderBy: { name: "asc" },
        }),
      ]);
      const activityIds = [...new Set(transfers.map((t) => t.processingActivityId).filter((id): id is string => !!id))];
      const links = activityIds.length
        ? await ctx.prisma.processingActivityAsset.findMany({
            where: { processingActivityId: { in: activityIds }, processingActivity: { organizationId } },
            select: { processingActivityId: true, dataAssetId: true },
          })
        : [];
      const activityAssets = new Map<string, string[]>();
      for (const l of links) {
        activityAssets.set(l.processingActivityId, [...(activityAssets.get(l.processingActivityId) ?? []), l.dataAssetId]);
      }
      return transferOverlay(assets, transfers, activityAssets, vendors);
    }),

  // Get a single data flow
  getFlow: organizationProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const flow = await ctx.prisma.dataFlow.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
          ...flowScopeWhere(scope),
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
  createFlow: writerProcedure
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
      }).refine((v) => v.sourceAssetId !== v.destinationAssetId, {
        message: "A flow needs two different systems.",
        path: ["destinationAssetId"],
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Both ends of the flow must belong to the caller's organisation (and
      // to the member's departments)
      const scope = await scopeOf(ctx);
      await assertIdsInOrg(
        ctx.prisma.dataAsset,
        [input.sourceAssetId, input.destinationAssetId],
        { organizationId: ctx.organization.id, ...scopeAnd(scope) },
        "Data asset"
      );

      const fields = {
        name: input.name,
        description: input.description,
        sourceAssetId: input.sourceAssetId,
        destinationAssetId: input.destinationAssetId,
        dataCategories: input.dataCategories,
        frequency: input.frequency,
        volume: input.volume,
        encryptionMethod: input.encryptionMethod,
        isAutomated: input.isAutomated,
      };

      // A generated draft already joining the same two systems in the same
      // direction is taken over (it becomes this flow) instead of a second,
      // overlapping flow being drawn.
      const sameDirection = await ctx.prisma.dataFlow.findMany({
        where: {
          organizationId: ctx.organization.id,
          sourceAssetId: input.sourceAssetId,
          destinationAssetId: input.destinationAssetId,
        },
        select: { id: true, metadata: true },
        orderBy: { createdAt: "asc" },
      });
      const draft = sameDirection.find((f) => isDraftFlow(f.metadata));

      const flow = draft
        ? await ctx.prisma.dataFlow.update({
            where: { id: draft.id },
            data: {
              ...fields,
              metadata: takenOverMetadata(draft.metadata) as Prisma.InputJsonValue,
            },
            include: { sourceAsset: true, destinationAsset: true },
          })
        : await ctx.prisma.dataFlow.create({
            data: { organizationId: ctx.organization.id, ...fields },
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
          action: draft ? "UPDATE" : "CREATE",
          changes: draft ? { ...input, takenOverDraft: true } : input,
        },
      });

      return flow;
    }),

  // Update data flow
  updateFlow: writerProcedure
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

      // A re-pointed end must belong to the caller's organisation (and to
      // the member's departments)
      const scope = await scopeOf(ctx);
      await assertIdsInOrg(
        ctx.prisma.dataAsset,
        [input.sourceAssetId, input.destinationAssetId],
        { organizationId: ctx.organization.id, ...scopeAnd(scope) },
        "Data asset"
      );

      // A generated flow that a person edits becomes theirs: it is no
      // longer removed or redrawn when the activity's systems change.
      const current = await ctx.prisma.dataFlow.findFirst({
        where: { id, organizationId: ctx.organization.id, ...flowScopeWhere(scope) },
        select: { metadata: true, sourceAssetId: true, destinationAssetId: true },
      });
      // A flow never starts and ends at the same system.
      const nextSource = input.sourceAssetId ?? current?.sourceAssetId;
      const nextDestination = input.destinationAssetId ?? current?.destinationAssetId;
      if (nextSource && nextDestination && nextSource === nextDestination) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A flow needs two different systems." });
      }
      const metadata = current ? takenOverMetadata(current.metadata) : undefined;

      const flow = await ctx.prisma.dataFlow.updateMany({
        where: { id, organizationId: ctx.organization.id, ...flowScopeWhere(scope) },
        data: {
          ...data,
          ...(metadata !== undefined && metadata !== current?.metadata
            ? { metadata: metadata as Prisma.InputJsonValue }
            : {}),
        },
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
  // Confirm a generated flow as it is (a draft "to confirm"): it becomes the
  // organisation's own flow, is drawn solid and appears in the PDF reports.
  confirmFlow: writerProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const current = await ctx.prisma.dataFlow.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id, ...flowScopeWhere(scope) },
        select: { metadata: true },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Data flow not found" });
      }
      if (!isDraftFlow(current.metadata)) return { success: true, changed: false };

      await ctx.prisma.dataFlow.updateMany({
        where: { id: input.id, organizationId: ctx.organization.id },
        data: {
          metadata: confirmedMetadata(current.metadata, ctx.session.user.id, new Date()) as Prisma.InputJsonValue,
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataFlow",
          entityId: input.id,
          action: "CONFIRM",
        },
      });
      return { success: true, changed: true };
    }),

  deleteFlow: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const flow = await ctx.prisma.dataFlow.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id, ...flowScopeWhere(scope) },
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
      const scope = await scopeOf(ctx);
      const transfers = await ctx.prisma.dataTransfer.findMany({
        where: { organizationId: ctx.organization.id, ...transferScopeWhere(scope) },
        include: {
          processingActivity: true,
          jurisdiction: true,
          vendor: { select: { id: true, name: true } },
          assessments: {
            select: {
              id: true,
              status: true,
              riskLevel: true,
              riskScore: true,
              completedAt: true,
              template: { select: { type: true, sections: true, scoringLogic: true } },
              responses: { select: { questionId: true, response: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      });
      // Risk level derived from the assessment's answers.
      return transfers.map((t) => ({
        ...t,
        assessments: t.assessments.map(({ template, responses, ...a }) =>
          withDerivedRisk(a, template, responses)
        ),
      }));
    }),

  // Create data transfer
  createTransfer: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        processingActivityId: z.string().optional(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        destinationCountry: transferCountrySchema,
        destinationOrg: z.string().optional(),
        jurisdictionId: z.string().optional(),
        mechanism: z.nativeEnum(TransferMechanism),
        safeguards: z.string().optional(),
        documentUrl: z.string().optional(),
        tiaCompleted: z.boolean().default(false),
        tiaDate: z.date().optional(),
        adequacyScopeConfirmed: z.boolean().optional().nullable(),
        adequacyScopeReference: z.string().max(2000).optional().nullable(),
        vendorId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // The linked activity and vendor must belong to the caller's
      // organisation, and the activity to the member's departments
      // (jurisdictions are global reference rows, not organisation data). A
      // limited member's transfer must name one of their records, or they
      // could not see it afterwards.
      const scope = await scopeOf(ctx);
      if (!scope.all && !input.processingActivityId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: TRANSFER_NEEDS_ACTIVITY });
      }
      await assertIdsInOrg(
        ctx.prisma.processingActivity,
        [input.processingActivityId],
        { organizationId: ctx.organization.id, ...scopeAnd(scope) },
        "Processing activity"
      );
      await assertIdsInOrg(
        ctx.prisma.vendor,
        [input.vendorId ?? undefined],
        { organizationId: ctx.organization.id },
        "Vendor"
      );

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
          adequacyScopeConfirmed: input.adequacyScopeConfirmed ?? null,
          adequacyScopeReference: input.adequacyScopeReference || null,
          adequacyScopeCheckedAt: input.adequacyScopeConfirmed != null ? new Date() : null,
          vendorId: input.vendorId || null,
        },
        include: {
          processingActivity: true,
          jurisdiction: true,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataTransfer",
          entityId: transfer.id,
          action: "CREATE",
          changes: {
            name: input.name,
            destinationCountry: input.destinationCountry,
            mechanism: input.mechanism,
            ...(input.adequacyScopeConfirmed != null
              ? { adequacyScopeConfirmed: input.adequacyScopeConfirmed }
              : {}),
          },
        },
      });

      return transfer;
    }),

  // ============================================================
  // TRANSFER COMPLIANCE (Feature 4)
  // ============================================================

  // The choices a transfer form offers: the organisation's processing
  // activities and vendors (names only, plus vendor countries).
  transferFormOptions: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const organizationId = ctx.organization.id;
      const [activities, vendors] = await Promise.all([
        ctx.prisma.processingActivity.findMany({
          where: { organizationId },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "asc" },
          take: 500,
        }),
        ctx.prisma.vendor.findMany({
          where: { organizationId },
          select: { id: true, name: true, countries: true, status: true },
          orderBy: { name: "asc" },
          take: 500,
        }),
      ]);
      return { activities, vendors };
    }),

  // Get transfer compliance stats
  getTransferStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const scope = await scopeOf(ctx);
      const transfers = await ctx.prisma.dataTransfer.findMany({
        where: { organizationId: ctx.organization.id, isActive: true, ...transferScopeWhere(scope) },
        select: {
          id: true,
          destinationCountry: true,
          mechanism: true,
          complianceStatus: true,
          sccExpiryDate: true,
          tiaCompleted: true,
        },
      });

      const total = transfers.length;
      const compliant = transfers.filter((t) => t.complianceStatus === "COMPLIANT").length;
      const needsReview = transfers.filter((t) => t.complianceStatus === "NEEDS_REVIEW").length;
      const nonCompliant = transfers.filter((t) => t.complianceStatus === "NON_COMPLIANT").length;
      const pending = transfers.filter((t) => !t.complianceStatus || t.complianceStatus === "PENDING").length;
      const withoutTia = transfers.filter((t) => !t.tiaCompleted && t.mechanism === "STANDARD_CONTRACTUAL_CLAUSES").length;

      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringSoon = transfers.filter(
        (t) => t.sccExpiryDate && t.sccExpiryDate > now && t.sccExpiryDate <= thirtyDays
      ).length;

      const countries = [...new Set(transfers.map((t) => t.destinationCountry))];

      return {
        total,
        compliant,
        needsReview,
        nonCompliant,
        pending,
        withoutTia,
        expiringSoon,
        destinationCountries: countries,
      };
    }),

  // Update transfer compliance details
  // Delete a transfer record (owners and admins). Assessments that pointed
  // at it are kept and lose the link (SetNull).
  deleteTransfer: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const transfer = await ctx.prisma.dataTransfer.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id, ...transferScopeWhere(scope) },
        select: { id: true, name: true },
      });
      if (!transfer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transfer not found" });
      }
      await ctx.prisma.dataTransfer.deleteMany({
        where: { id: input.id, organizationId: ctx.organization.id },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataTransfer",
          entityId: input.id,
          action: "DELETE",
          changes: { name: transfer.name },
        },
      });
      return { success: true };
    }),

  updateTransferCompliance: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        complianceStatus: z.enum(["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"]).optional(),
        sccExpiryDate: z.date().optional().nullable(),
        supplementaryMeasures: z.any().optional(),
        tiaCompleted: z.boolean().optional(),
        tiaDate: z.date().optional().nullable(),
        safeguards: z.string().optional(),
        adequacyScopeConfirmed: z.boolean().optional().nullable(),
        adequacyScopeReference: z.string().max(2000).optional().nullable(),
        processingActivityId: z.string().optional().nullable(),
        vendorId: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId, ...fields } = input;
      // A linked activity or vendor must belong to the caller's organisation.
      if (fields.processingActivityId) {
        await assertIdsInOrg(
          ctx.prisma.processingActivity,
          [fields.processingActivityId],
          { organizationId: ctx.organization.id },
          "Processing activity"
        );
      }
      if (fields.vendorId) {
        await assertIdsInOrg(
          ctx.prisma.vendor,
          [fields.vendorId],
          { organizationId: ctx.organization.id },
          "Vendor"
        );
      }
      const data = {
        ...fields,
        // When the scope answer is given, the date it was checked goes with it.
        ...(fields.adequacyScopeConfirmed !== undefined
          ? { adequacyScopeCheckedAt: fields.adequacyScopeConfirmed === null ? null : new Date() }
          : {}),
      };

      const scope = await scopeOf(ctx);
      const transfer = await ctx.prisma.dataTransfer.findFirst({
        where: { id, organizationId: ctx.organization.id, ...transferScopeWhere(scope) },
      });

      if (!transfer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data transfer not found",
        });
      }

      const updated = await ctx.prisma.dataTransfer.update({
        where: { id },
        data,
        include: {
          processingActivity: true,
          jurisdiction: true,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataTransfer",
          entityId: id,
          action: "UPDATE_COMPLIANCE",
          changes: data,
        },
      });

      return updated;
    }),

  // One answer on the Schrems II checklist (done, not applicable or pending,
  // with an optional note), kept in the transfer's metadata.
  updateTransferChecklistItem: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        id: z.string(),
        itemId: z.string(),
        state: z.enum(CHECKLIST_STATES),
        note: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { SCHREMS_II_CHECKLIST } = await import("@/config/transfer-compliance-rules");
      if (!SCHREMS_II_CHECKLIST.some((item) => item.id === input.itemId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown checklist item" });
      }
      const scope = await scopeOf(ctx);
      const transfer = await ctx.prisma.dataTransfer.findFirst({
        where: { id: input.id, organizationId: ctx.organization.id, ...transferScopeWhere(scope) },
        select: { id: true, metadata: true },
      });
      if (!transfer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Data transfer not found" });
      }
      const metadata = withChecklistAnswer(transfer.metadata, input.itemId, {
        state: input.state,
        note: input.note?.trim() || undefined,
        at: new Date().toISOString(),
      });
      await ctx.prisma.dataTransfer.update({
        where: { id: input.id },
        data: { metadata: metadata as Prisma.InputJsonValue },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "DataTransfer",
          entityId: input.id,
          action: "UPDATE_CHECKLIST",
          changes: { itemId: input.itemId, state: input.state },
        },
      });
      return { success: true };
    }),

  // Get Schrems II compliance checklist for a transfer
  getTransferComplianceChecklist: organizationProcedure
    .input(z.object({ organizationId: z.string(), transferId: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = await scopeOf(ctx);
      const transfer = await ctx.prisma.dataTransfer.findFirst({
        where: { id: input.transferId, organizationId: ctx.organization.id, ...transferScopeWhere(scope) },
        include: {
          processingActivity: true,
          jurisdiction: true,
          vendor: { select: { id: true, name: true } },
          // The transfer's latest TIA, for the start / continue / view action.
          assessments: {
            select: { id: true, status: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!transfer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Data transfer not found",
        });
      }

      const {
        SCHREMS_II_CHECKLIST,
        SUPPLEMENTARY_MEASURES,
        adequacyCoverage,
        getAdequacyDecision,
        getTransferComplianceStatus,
      } = await import("@/config/transfer-compliance-rules");

      // A partial decision (US under the DPF, Canada under PIPEDA) covers the
      // transfer only when the record confirms the recipient is in scope.
      const coverage = adequacyCoverage(transfer.destinationCountry, transfer.adequacyScopeConfirmed);
      const isAdequate = coverage === "EEA" || coverage === "FULL" || coverage === "PARTIAL_CONFIRMED";
      const adequacyDecision = getAdequacyDecision(transfer.destinationCountry);

      const autoStatus = getTransferComplianceStatus({
        mechanism: transfer.mechanism,
        destinationCountry: transfer.destinationCountry,
        tiaCompleted: transfer.tiaCompleted,
        sccExpiryDate: transfer.sccExpiryDate,
        supplementaryMeasures: transfer.supplementaryMeasures as Record<string, unknown> | undefined,
        adequacyScopeConfirmed: transfer.adequacyScopeConfirmed,
      });

      // Transfers the adequacy decision covers don't need the Schrems II /
      // supplementary measures checklists. Return empty arrays in that case
      // so the UI doesn't render irrelevant items.
      const checklist = isAdequate ? [] : SCHREMS_II_CHECKLIST;
      const supplementaryMeasuresList = isAdequate ? [] : SUPPLEMENTARY_MEASURES;

      return {
        transfer: {
          id: transfer.id,
          name: transfer.name,
          destinationCountry: transfer.destinationCountry,
          destinationOrg: transfer.destinationOrg,
          mechanism: transfer.mechanism,
          // The recorded status only; the rules' result is a suggestion
          // shown beside it, never in its place.
          complianceStatus: transfer.complianceStatus,
          suggestedStatus: autoStatus,
          sccExpiryDate: transfer.sccExpiryDate,
          tiaCompleted: transfer.tiaCompleted,
          supplementaryMeasures: transfer.supplementaryMeasures,
          safeguards: transfer.safeguards,
          processingActivityId: transfer.processingActivityId,
          processingActivityName: transfer.processingActivity?.name ?? null,
          vendorId: transfer.vendorId,
          vendorName: transfer.vendor?.name ?? null,
          adequacyScopeConfirmed: transfer.adequacyScopeConfirmed,
          adequacyScopeReference: transfer.adequacyScopeReference,
          adequacyScopeCheckedAt: transfer.adequacyScopeCheckedAt,
          tia: transfer.assessments[0] ?? null,
        },
        adequacyCoverage: coverage,
        isAdequateCountry: isAdequate,
        adequacyDecision,
        checklist,
        checklistAnswers: isAdequate ? {} : checklistAnswersOf(transfer.metadata),
        supplementaryMeasures: supplementaryMeasuresList,
      };
    }),

  // ============================================================
  // ROPA EXPORT
  // ============================================================

  // Check if organization has ROPA export access
  hasRopaExportAccess: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const hasAccess = await hasRopaExportAccess(ctx.organization.id);
      return { hasAccess };
    }),

  // Export ROPA data
  exportROPA: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      // Premium feature guard
      const hasAccess = await hasRopaExportAccess(ctx.organization.id);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ROPA Export requires a premium subscription. Enable this add-on to export your Record of Processing Activities.",
        });
      }

      const scope = await scopeOf(ctx);
      const activities = await ctx.prisma.processingActivity.findMany({
        where: {
          organizationId: ctx.organization.id,
          isActive: true,
          ...scopeAnd(scope),
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
