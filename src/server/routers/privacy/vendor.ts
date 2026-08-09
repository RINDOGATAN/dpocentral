// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure, officerProcedure, adminOrgProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import {
  assembleDpa,
  assembleStandaloneTia,
  checkFactConsistency,
  DpaEngineError,
  getDpaPack,
  mapVendorToDpaInputs,
} from "@/lib/dpa-engine";
import type { DpaContext } from "@/lib/dpa-engine";
import {
  VendorStatus,
  VendorRiskTier,
  ContractType,
  ContractStatus,
  TaskStatus,
  ReviewType,
  DataCategory,
} from "@prisma/client";
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
            select: { id: true, name: true, type: true, status: true, startDate: true, endDate: true, renewalDate: true, autoRenewal: true, value: true, currency: true, documentUrl: true, metadata: true },
            orderBy: { endDate: "asc" },
          },
          questionnaireResponses: {
            include: {
              questionnaire: {
                select: { id: true, name: true },
              },
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
  create: writerProcedure
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
        riskTier: z.nativeEnum(VendorRiskTier).optional(),
        metadata: z.record(z.string(), z.any()).optional(),
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
          riskTier: input.riskTier,
          primaryContact: input.primaryContact,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          address: input.address,
          categories: input.categories,
          dataProcessed: input.dataProcessed,
          countries: input.countries,
          certifications: input.certifications,
          ...(input.metadata ? { metadata: input.metadata as any } : {}),
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Vendor",
          entityId: vendor.id,
          action: "CREATE",
          changes: input as any,
        },
      });

      return vendor;
    }),

  // Update vendor
  update: writerProcedure
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
  delete: adminOrgProcedure
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
  addContract: writerProcedure
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
  updateContract: writerProcedure
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
  deleteContract: adminOrgProcedure
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
  // DPA + TIA GENERATION (Dealroom contract pack, src/lib/dpa-engine)
  // ============================================================

  // Map the vendor's register data into a reviewable fact proposal, and
  // ship the pack's parameter/clause catalog so the review form can render
  // bilingual labels without bundling the pack client-side.
  prepareDpa: officerProcedure
    .input(z.object({ organizationId: z.string(), vendorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: { id: input.vendorId, organizationId: ctx.organization.id },
        include: {
          questionnaireResponses: {
            select: { status: true, submittedAt: true, responses: true },
          },
        },
      });
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const [activities, orgJurisdictions] = await Promise.all([
        ctx.prisma.processingActivity.findMany({
          where: { organizationId: ctx.organization.id, isActive: true },
          select: { name: true, purpose: true, recipients: true },
        }),
        ctx.prisma.organizationJurisdiction.findMany({
          where: { organizationId: ctx.organization.id },
          orderBy: { isPrimary: "desc" },
          select: { jurisdiction: { select: { region: true } } },
        }),
      ]);

      const mapped = mapVendorToDpaInputs({
        vendor: {
          name: vendor.name,
          address: vendor.address,
          dataProcessed: vendor.dataProcessed,
          countries: vendor.countries,
          certifications: vendor.certifications,
          metadata: vendor.metadata,
        },
        questionnaireResponses: vendor.questionnaireResponses.map((r) => ({
          status: r.status,
          submittedAt: r.submittedAt,
          responses: r.responses,
        })),
        processingActivities: activities,
        organizationJurisdictionRegions: orgJurisdictions.map(
          (j) => j.jurisdiction.region
        ),
      });

      const pack = getDpaPack();
      return {
        ...mapped,
        issues: checkFactConsistency(mapped.facts),
        vendor: { name: vendor.name, address: vendor.address },
        organization: { name: ctx.organization.name },
        catalog: {
          parameters: pack.parameters.map((p) => ({
            id: p.id,
            type: p.type,
            required: p.required ?? false,
            default: p.default,
            label: p.label,
            hint: p.hint,
            placeholder: p.placeholder,
            options: p.options,
            optionLabels: p.optionLabels,
          })),
          clauses: [...pack.clauses]
            .sort((a, b) => a.order - b.order)
            .map((c) => ({
              id: c.id,
              title: c.title,
              options: [...c.options]
                .sort((a, b) => a.order - b.order)
                .map((o) => ({
                  id: o.id,
                  label: o.label,
                  plainDescription: o.plainDescription,
                })),
            })),
        },
      };
    }),

  // Generate the DPA (+ standalone TIA when applicable) from the human-
  // reviewed facts and store them against a VendorContract row. The PDFs
  // are re-rendered deterministically from the stored inputs by
  // GET /api/export/dpa/[contractId].
  generateDpa: officerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorId: z.string(),
        language: z.enum(["en", "es"]),
        effectiveDate: z.date(),
        dealName: z.string().max(200).optional(),
        governingLaw: z.enum(["CALIFORNIA", "ENGLAND_WALES", "SPAIN"]),
        facts: z.record(z.string(), z.string()),
        selections: z.record(z.string(), z.string()),
        controller: z.object({
          name: z.string().optional(),
          address: z.string().optional(),
          taxId: z.string().optional(),
          signatoryName: z.string().optional(),
          signatoryTitle: z.string().optional(),
        }),
        processor: z.object({
          name: z.string().optional(),
          address: z.string().optional(),
          taxId: z.string().optional(),
          signatoryName: z.string().optional(),
          signatoryTitle: z.string().optional(),
        }),
        // §7: contradictions require explicit confirmation — the codes the
        // reviewer ticked in the UI.
        confirmedIssues: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.findFirst({
        where: { id: input.vendorId, organizationId: ctx.organization.id },
      });
      if (!vendor) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" });
      }

      const issues = checkFactConsistency(input.facts);
      const unconfirmed = issues.filter(
        (i) => !input.confirmedIssues.includes(i.code)
      );
      if (unconfirmed.length) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Unconfirmed consistency issues: ${unconfirmed.map((i) => i.code).join(", ")}`,
        });
      }

      const producedAt = new Date();
      const context: DpaContext = {
        language: input.language,
        effectiveDate: input.effectiveDate,
        governingLaw: input.governingLaw,
        controller: input.controller,
        processor: input.processor,
        dealName: input.dealName,
        producedDate: producedAt,
      };

      // Assemble now so invalid inputs fail here, not at download time.
      let warnings: string[];
      let tiaIncluded: boolean;
      try {
        const assembled = assembleDpa({
          facts: input.facts,
          selections: input.selections,
          context,
        });
        warnings = assembled.warnings;
        tiaIncluded =
          assembleStandaloneTia({
            facts: input.facts,
            selections: input.selections,
            context,
          }) !== null;
      } catch (err) {
        if (err instanceof DpaEngineError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
        throw err;
      }

      const contract = await ctx.prisma.vendorContract.create({
        data: {
          vendorId: vendor.id,
          type: ContractType.DPA,
          status: ContractStatus.PENDING_SIGNATURE,
          name:
            input.dealName?.trim() ||
            `DPA — ${vendor.name} (${input.effectiveDate.toISOString().slice(0, 10)})`,
          startDate: input.effectiveDate,
          metadata: {
            dpaEngine: {
              version: 1,
              language: input.language,
              governingLaw: input.governingLaw,
              facts: input.facts,
              selections: input.selections,
              controller: input.controller,
              processor: input.processor,
              dealName: input.dealName ?? null,
              effectiveDate: input.effectiveDate.toISOString(),
              producedAt: producedAt.toISOString(),
              confirmedIssues: input.confirmedIssues,
              warnings,
              tiaIncluded,
            },
          },
        },
      });

      const dpaUrl = `/api/export/dpa/${contract.id}?doc=dpa`;
      await ctx.prisma.vendorContract.update({
        where: { id: contract.id },
        data: { documentUrl: dpaUrl },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "VendorContract",
          entityId: contract.id,
          action: "GENERATE_DPA",
          changes: {
            vendorId: vendor.id,
            language: input.language,
            tiaIncluded,
            warnings,
          },
        },
      });

      return {
        contractId: contract.id,
        dpaUrl,
        tiaUrl: tiaIncluded ? `/api/export/dpa/${contract.id}?doc=tia` : null,
        warnings,
        tiaIncluded,
      };
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

  // Note: vendor self-reported compliance questionnaires (the public "vendor
  // fills in their profile" workflow) are owned by Vendor.Watch, not DPC.
  // The DPC procedures that previously implemented a parallel "DPO sends a
  // private questionnaire to a vendor" flow were removed because they had no
  // UI, no email transport, and no public portal route. To gather vendor
  // compliance data, link the vendor to its Vendor.Watch profile.

  // ============================================================
  // REVIEWS
  // ============================================================

  // Schedule review
  scheduleReview: writerProcedure
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
  completeReview: writerProcedure
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
