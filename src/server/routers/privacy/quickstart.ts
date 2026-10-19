// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, organizationProcedure, writerProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import {
  DataAssetType,
  DataSensitivity,
  DataCategory,
  LegalBasis,
  TransferMechanism,
  VendorStatus,
  VendorRiskTier,
  Prisma,
} from "@prisma/client";
import {
  declaresDpf,
  transferDestinationsFor,
  vendorMappingFor,
  type VendorDataMapping,
} from "../../../config/vendor-data-mappings";
import { VENDOR_QUICKSTART_TEXT } from "../../../config/vendor-data-mappings-es";
import {
  defaultReturnFlowFrequency,
  getLocalizedTemplateById,
  getLocalizedTemplates,
  flowRecordCount,
  returnFlowName,
  type IndustryTemplate,
} from "../../../config/industry-templates";
import { hasVendorCatalogAccess } from "../../services/licensing/entitlement";
import {
  assertPilotCapacity,
  hasPilotRoom,
  pilotLocale,
  type PilotResource,
} from "../../services/pilot/caps";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { isHostedDeployment } from "@/lib/hosted";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { quickstartSettingsAfterRun } from "@/server/services/program/quickstart-settings";
import { flowPairKey, newTemplateFlowCount } from "@/server/services/program/quickstart-flows";

// Capped resources a quickstart batch can add.
const PILOT_BATCH_RESOURCES: PilotResource[] = [
  "vendors",
  "dataAssets",
  "dataElements",
  "processingActivities",
  "dataFlows",
  "dataTransfers",
  "assessments",
];
import { createAssessmentFromActivity } from "../../services/assessment-auto-create";
import {
  isAiCapableVendor,
  buildAISystemFromCatalog,
  type VendorCatalogAIFields,
} from "../../../config/vendor-ai-detection";
import { recordName, legacyRecordName } from "@/lib/record-name";

// ============================================================
// HELPERS
// ============================================================

interface VendorPreviewItem {
  vendorName: string;
  vendorSlug: string;
  category: string;
  assetName: string;
  assetType: DataAssetType;
  elementCount: number;
  elements: string[];
  activityName: string;
  isHighRisk: boolean;
  transfers: { country: string; mechanism: string }[];
  privacyTechnologies: string[];
  isAiCapable: boolean;
  aiCapabilities: string[];
  /** The build also draws a flow back from this vendor (vendor-data-mappings). */
  hasReturnFlow: boolean;
}

function buildVendorPreview(
  catalogVendor: {
    slug: string;
    name: string;
    category: string;
    subcategory?: string | null;
    dataLocations: string[];
    transferSafeguards?: string | null;
    frameworks?: string[];
    certifications?: string[];
    privacyTechnologies?: string[];
    aiCapabilities?: string[];
    aiTechniques?: string[];
    euAiActRole?: string | null;
    euAiActCompliant?: boolean | null;
    iso42001Certified?: boolean | null;
    aiModels?: unknown;
    euAiActAnnexIIIDomains?: string[];
    tags?: string[];
  },
  mapping: VendorDataMapping
): VendorPreviewItem {
  // Locations inside the EEA ("EU", "EEA", "EU (Germany)") or with a full
  // adequacy decision ("UK" -> GB) need no transfer record; the US with a
  // declared DPF certification is recorded under the adequacy decision (to
  // be checked), every other destination under SCCs.
  const dpf = declaresDpf(catalogVendor);
  const transfers = transferDestinationsFor(catalogVendor.dataLocations || []).countries.map(
    (country) => ({
      country,
      mechanism:
        country === "US" && dpf ? "ADEQUACY_DECISION" : "STANDARD_CONTRACTUAL_CLAUSES",
    })
  );

  const aiFields: VendorCatalogAIFields = {
    slug: catalogVendor.slug,
    name: catalogVendor.name,
    category: catalogVendor.category,
    subcategory: catalogVendor.subcategory,
    aiCapabilities: catalogVendor.aiCapabilities ?? [],
    aiTechniques: catalogVendor.aiTechniques ?? [],
    euAiActRole: catalogVendor.euAiActRole,
    euAiActCompliant: catalogVendor.euAiActCompliant,
    iso42001Certified: catalogVendor.iso42001Certified,
    aiModels: catalogVendor.aiModels,
    euAiActAnnexIIIDomains: catalogVendor.euAiActAnnexIIIDomains,
    tags: catalogVendor.tags,
  };

  return {
    vendorName: catalogVendor.name,
    vendorSlug: catalogVendor.slug,
    category: catalogVendor.category,
    assetName: `${catalogVendor.name} (${mapping.label})`,
    assetType: mapping.asset.type,
    elementCount: mapping.elements.length,
    elements: mapping.elements.map((e) => e.name),
    activityName: recordName(mapping.activity.name, catalogVendor.name),
    isHighRisk: mapping.isHighRisk,
    transfers,
    privacyTechnologies: catalogVendor.privacyTechnologies || [],
    isAiCapable: isAiCapableVendor(aiFields),
    aiCapabilities: catalogVendor.aiCapabilities ?? [],
    hasReturnFlow: !!mapping.returnFlow,
  };
}

// ============================================================
// ROUTER
// ============================================================

export const quickstartRouter = createTRPCRouter({
  // ──────────────────────────────────────────────────
  // Detect Vendor.Watch portfolio for the current user
  // ──────────────────────────────────────────────────
  getPortfolio: organizationProcedure
    .input(z.object({ organizationId: z.string(), locale: z.enum(["en", "es"]).optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const locale = input.locale ?? pilotLocale(localeFromCookieGetter(ctx.getCookie));
      const empty = { hasPortfolio: false as const, vendors: [], slugs: [] };

      // VwPortfolioVendor.accountId = NextAuth User.id (shared DB)
      // Wrapped in try-catch: table may not exist in dev or fresh environments
      let portfolioVendors;
      try {
        portfolioVendors = await ctx.prisma.vwPortfolioVendor.findMany({
          where: { accountId: userId },
          orderBy: { createdAt: "desc" },
        });
      } catch {
        return empty;
      }

      if (portfolioVendors.length === 0) {
        return empty;
      }

      // Join with VendorCatalog to get display info
      const slugs = portfolioVendors.map((pv) => pv.vendorSlug);
      const catalogVendors = await ctx.prisma.vendorCatalog.findMany({
        where: { slug: { in: slugs } },
        select: {
          slug: true,
          name: true,
          category: true,
          subcategory: true,
          description: true,
          website: true,
          dataLocations: true,
          certifications: true,
          gdprCompliant: true,
          privacyTechnologies: true,
          isVerified: true,
        },
      });

      const catalogBySlug = new Map(catalogVendors.map((v) => [v.slug, v]));

      // Check which are already imported as DPC Vendors
      const existingVendors = await ctx.prisma.vendor.findMany({
        where: {
          organizationId: ctx.organization.id,
          name: { in: catalogVendors.map((v) => v.name) },
        },
        select: { name: true },
      });
      const existingNames = new Set(existingVendors.map((v) => v.name));

      const vendors = portfolioVendors
        .map((pv) => {
          const catalog = catalogBySlug.get(pv.vendorSlug);
          if (!catalog) return null;
          const mapping = vendorMappingFor(catalog.category, catalog.subcategory, locale);
          return {
            slug: pv.vendorSlug,
            name: catalog.name,
            category: catalog.subcategory
              ? `${catalog.category} > ${catalog.subcategory}`
              : catalog.category,
            description: catalog.description,
            criticality: pv.criticality,
            dataCategories: pv.dataCategories,
            purposes: pv.purposes,
            isVerified: catalog.isVerified,
            gdprCompliant: catalog.gdprCompliant,
            alreadyImported: existingNames.has(catalog.name),
            mappingLabel: mapping.label,
            elementCount: mapping.elements.length,
            isHighRisk: mapping.isHighRisk,
          };
        })
        .filter(Boolean);

      return {
        hasPortfolio: true as const,
        vendors,
        slugs: vendors
          .filter((v) => v && !v.alreadyImported)
          .map((v) => v!.slug),
      };
    }),

  // ──────────────────────────────────────────────────
  // Preview what importing selected vendors would create
  // ──────────────────────────────────────────────────
  previewVendorImport: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorSlugs: z.array(z.string()).min(1).max(20),
        fromPortfolio: z.boolean().default(false),
        /** The screen's language, for the records' text; the locale cookie when absent. */
        locale: z.enum(["en", "es"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const locale = input.locale ?? pilotLocale(localeFromCookieGetter(ctx.getCookie));
      if (input.fromPortfolio) {
        // Validate slugs belong to the user's VW portfolio
        const portfolioVendors = await ctx.prisma.vwPortfolioVendor.findMany({
          where: {
            accountId: ctx.session.user.id,
            vendorSlug: { in: input.vendorSlugs },
          },
          select: { vendorSlug: true },
        });
        const validSlugs = new Set(portfolioVendors.map((pv) => pv.vendorSlug));
        const invalidSlugs = input.vendorSlugs.filter((s) => !validSlugs.has(s));
        if (invalidSlugs.length > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Some vendor slugs are not in your Vendor.Watch portfolio.",
          });
        }

        // Count already-imported free portfolio vendors
        const usedFreeSlots = await ctx.prisma.vendor.count({
          where: {
            organizationId: ctx.organization.id,
            metadata: { path: ["fromPortfolio"], equals: true },
          },
        });
        const remainingFree = Math.max(0, 5 - usedFreeSlots);
        if (input.vendorSlugs.length > remainingFree) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You can import up to 5 vendors for free from your Vendor.Watch portfolio. You have ${remainingFree} free slot${remainingFree !== 1 ? "s" : ""} remaining. Subscribe to the Vendor Catalog add-on to import more.`,
          });
        }
      } else {
        // Allow up to 5 free quickstart imports; require license after that
        const hasAccess = await hasVendorCatalogAccess(ctx.organization.id);
        if (!hasAccess) {
          const usedFreeSlots = await ctx.prisma.vendor.count({
            where: {
              organizationId: ctx.organization.id,
              metadata: { path: ["source"], equals: "quickstart" },
            },
          });
          const remainingFree = Math.max(0, 5 - usedFreeSlots);
          if (input.vendorSlugs.length > remainingFree) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `You can import up to 5 vendors for free during quickstart. You have ${remainingFree} free slot${remainingFree !== 1 ? "s" : ""} remaining. Subscribe to the Vendor Catalog add-on to import more.`,
            });
          }
        }
      }

      // Fetch selected catalog vendors
      const catalogVendors = await ctx.prisma.vendorCatalog.findMany({
        where: { slug: { in: input.vendorSlugs } },
        select: {
          slug: true,
          name: true,
          category: true,
          subcategory: true,
          description: true,
          website: true,
          dataLocations: true,
          certifications: true,
          transferSafeguards: true,
          frameworks: true,
          gdprCompliant: true,
          privacyTechnologies: true,
          aiCapabilities: true,
          aiTechniques: true,
          euAiActRole: true,
          euAiActCompliant: true,
          iso42001Certified: true,
          aiModels: true,
          euAiActAnnexIIIDomains: true,
          tags: true,
        },
      });

      // Check which vendors/assets already exist
      const existingVendors = await ctx.prisma.vendor.findMany({
        where: {
          organizationId: ctx.organization.id,
          name: { in: catalogVendors.map((v) => v.name) },
        },
        select: { name: true },
      });
      const existingVendorNames = new Set(existingVendors.map((v) => v.name));

      const previews: VendorPreviewItem[] = [];
      for (const vendor of catalogVendors) {
        const mapping = vendorMappingFor(vendor.category, vendor.subcategory, locale);
        const preview = buildVendorPreview(vendor, mapping);
        previews.push(preview);
      }

      const newPreviews = previews.filter(
        (p) => !existingVendorNames.has(p.vendorName)
      );

      // What execute adds around the vendors' own records, so the review
      // promises what the build creates: the one internal-systems record (once
      // per organisation, whichever language an earlier run wrote it in),
      // and a flow to each new vendor plus a return flow where its mapping has
      // one.
      const orgName = ctx.organization.name;
      const internalAsset =
        newPreviews.length > 0
          ? await ctx.prisma.dataAsset.findFirst({
              where: {
                organizationId: ctx.organization.id,
                name: {
                  in: [
                    VENDOR_QUICKSTART_TEXT.en.internalSystemsName(orgName),
                    VENDOR_QUICKSTART_TEXT.es.internalSystemsName(orgName),
                  ],
                },
              },
              select: { id: true },
            })
          : null;
      const internalAssetToCreate = newPreviews.length > 0 && !internalAsset ? 1 : 0;
      const flows = newPreviews.reduce((sum, p) => sum + (p.hasReturnFlow ? 2 : 1), 0);

      return {
        previews,
        existingVendorNames: Array.from(existingVendorNames),
        totals: {
          vendors: newPreviews.length,
          assets: newPreviews.length + internalAssetToCreate,
          elements: newPreviews.reduce((sum, p) => sum + p.elementCount, 0),
          activities: newPreviews.length,
          flows,
          transfers: newPreviews.reduce((sum, p) => sum + p.transfers.length, 0),
          aiSystems: newPreviews.filter((p) => p.isAiCapable).length,
        },
      };
    }),

  // ──────────────────────────────────────────────────
  // Preview what an industry template would create
  // ──────────────────────────────────────────────────
  previewIndustryTemplate: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        industryId: z.string(),
        /** The screen's language; the locale cookie when absent. */
        locale: z.enum(["en", "es"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // The template's text follows the screen's language; execute reads
      // the locale cookie the screen's language comes from, so the names
      // previewed are the names created.
      const template = getLocalizedTemplateById(
        input.industryId,
        input.locale ?? pilotLocale(localeFromCookieGetter(ctx.getCookie))
      );
      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Industry template not found",
        });
      }

      // Check which assets already exist
      const existingAssets = await ctx.prisma.dataAsset.findMany({
        where: {
          organizationId: ctx.organization.id,
          name: { in: template.assets.map((a) => a.name) },
        },
        select: { id: true, name: true },
      });
      const existingAssetNames = new Set(existingAssets.map((a) => a.name));
      const existingAssetIds = new Map(existingAssets.map((a) => [a.name, a.id] as const));
      const existingFlowPairs = new Set(
        existingAssets.length > 0
          ? (
              await ctx.prisma.dataFlow.findMany({
                where: {
                  organizationId: ctx.organization.id,
                  sourceAssetId: { in: existingAssets.map((a) => a.id) },
                },
                select: { sourceAssetId: true, destinationAssetId: true },
              })
            ).map((f) => flowPairKey(f.sourceAssetId, f.destinationAssetId))
          : [],
      );

      const existingActivities = await ctx.prisma.processingActivity.findMany({
        where: {
          organizationId: ctx.organization.id,
          name: { in: template.activities.map((a) => a.name) },
        },
        select: { name: true },
      });
      const existingActivityNames = new Set(
        existingActivities.map((a) => a.name)
      );

      return {
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          icon: template.icon,
        },
        assets: template.assets.map((a) => ({
          name: a.name,
          type: a.type,
          description: a.description,
          elementCount: a.elements.length,
          elements: a.elements.map((e) => e.name),
          alreadyExists: existingAssetNames.has(a.name),
        })),
        activities: template.activities.map((a) => ({
          name: a.name,
          purpose: a.purpose,
          legalBasis: a.legalBasis,
          legalBasisNote: a.legalBasisNote ?? null,
          assetNames: a.assetNames,
          alreadyExists: existingActivityNames.has(a.name),
        })),
        flows: template.flows.map((f) => ({
          name: f.name,
          description: f.description,
          sourceAssetName: f.sourceAssetName,
          destAssetName: f.destAssetName,
          frequency: f.frequency,
        })),
        totals: {
          assets: template.assets.filter(
            (a) => !existingAssetNames.has(a.name)
          ).length,
          elements: template.assets
            .filter((a) => !existingAssetNames.has(a.name))
            .reduce((sum, a) => sum + a.elements.length, 0),
          activities: template.activities.filter(
            (a) => !existingActivityNames.has(a.name)
          ).length,
          // A two-way flow is created as two flows (out and back): count both,
          // less any direction already recorded, so the review promises what
          // the build creates.
          flows: newTemplateFlowCount(template.flows, existingAssetIds, existingFlowPairs),
        },
      };
    }),

  // ──────────────────────────────────────────────────
  // List available industry templates (lightweight)
  // ──────────────────────────────────────────────────
  listTemplates: organizationProcedure
    .input(z.object({ organizationId: z.string(), locale: z.enum(["en", "es"]).optional() }))
    .query(({ ctx, input }) => {
      const locale = input.locale ?? pilotLocale(localeFromCookieGetter(ctx.getCookie));
      return getLocalizedTemplates(locale).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        assetCount: t.assets.length,
        activityCount: t.activities.length,
        flowCount: flowRecordCount(t.flows),
      }));
    }),

  // ──────────────────────────────────────────────────
  // Execute quickstart — create all records in a transaction
  // ──────────────────────────────────────────────────
  execute: writerProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorSlugs: z.array(z.string()).max(20).default([]),
        industryId: z.string().optional(),
        skipAssetNames: z.array(z.string()).default([]),
        skipActivityNames: z.array(z.string()).default([]),
        fromPortfolio: z.boolean().default(false),
        programName: z.string().max(200).optional(),
        /** The screen's language, for the template's text; the locale cookie when absent. */
        locale: z.enum(["en", "es"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organization.id;
      const userId = ctx.session.user.id;
      const pilotLang = pilotLocale(localeFromCookieGetter(ctx.getCookie));
      const templateLang = input.locale ?? pilotLang;
      const vendorText = VENDOR_QUICKSTART_TEXT[templateLang];
      const skipAssets = new Set(input.skipAssetNames);
      const skipActivities = new Set(input.skipActivityNames);

      // The quick start sets up the whole organisation, so a member limited to
      // departments may not run it (src/lib/department-limit.ts); the screens
      // do not offer it to them either.
      const scope = await loadBusinessUnitScope(ctx.prisma, ctx.membership.id);
      if (!scope.all) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            pilotLang === "es"
              ? "El inicio rápido prepara toda la organización, y tu acceso se limita a tu departamento. Pide a un administrador que lo ponga en marcha."
              : "The quick start sets up the whole organization, and your access is limited to your department. Ask an administrator to run it.",
        });
      }

      // Validate at least one path is selected
      if (input.vendorSlugs.length === 0 && !input.industryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Select at least one vendor to import or an industry template",
        });
      }

      // Validate vendor catalog access if vendor path selected
      if (input.vendorSlugs.length > 0) {
        if (input.fromPortfolio) {
          // Validate slugs belong to the user's VW portfolio
          const portfolioVendors = await ctx.prisma.vwPortfolioVendor.findMany({
            where: {
              accountId: userId,
              vendorSlug: { in: input.vendorSlugs },
            },
            select: { vendorSlug: true },
          });
          const validSlugs = new Set(portfolioVendors.map((pv) => pv.vendorSlug));
          const invalidSlugs = input.vendorSlugs.filter((s) => !validSlugs.has(s));
          if (invalidSlugs.length > 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Some vendor slugs are not in your Vendor.Watch portfolio.",
            });
          }

          // Count already-imported free portfolio vendors
          const usedFreeSlots = await ctx.prisma.vendor.count({
            where: {
              organizationId: orgId,
              metadata: { path: ["fromPortfolio"], equals: true },
            },
          });
          const remainingFree = Math.max(0, 5 - usedFreeSlots);
          // The hosted pilot opens every module; its bound is the vendors
          // ceiling, checked at the end of the transaction below.
          if (!isHostedDeployment() && input.vendorSlugs.length > remainingFree) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `You can import up to 5 vendors for free from your Vendor.Watch portfolio. You have ${remainingFree} free slot${remainingFree !== 1 ? "s" : ""} remaining. Subscribe to the Vendor Catalog add-on to import more.`,
            });
          }
        } else {
          const hasAccess = await hasVendorCatalogAccess(orgId);
          if (!hasAccess) {
            const usedFreeSlots = await ctx.prisma.vendor.count({
              where: {
                organizationId: orgId,
                metadata: { path: ["source"], equals: "quickstart" },
              },
            });
            const remainingFree = Math.max(0, 5 - usedFreeSlots);
            if (input.vendorSlugs.length > remainingFree) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: `You can import up to 5 vendors for free during quickstart. You have ${remainingFree} free slot${remainingFree !== 1 ? "s" : ""} remaining. Subscribe to the Vendor Catalog add-on to import more.`,
              });
            }
          }
        }
      }

      // Validate industry template if selected
      let template: IndustryTemplate | undefined;
      if (input.industryId) {
        template = getLocalizedTemplateById(input.industryId, templateLang);
        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Industry template not found",
          });
        }
      }

      // Fetch catalog vendors if needed (include AI fields for auto-registration)
      const catalogVendors =
        input.vendorSlugs.length > 0
          ? await ctx.prisma.vendorCatalog.findMany({
              where: { slug: { in: input.vendorSlugs } },
            })
          : [];

      // Fetch existing names for deduplication (parallel)
      const [existingVendorNames, existingAssetNames, existingActivityNames] =
        await Promise.all([
          ctx.prisma.vendor
            .findMany({ where: { organizationId: orgId }, select: { name: true } })
            .then((v) => new Set(v.map((x) => x.name))),
          ctx.prisma.dataAsset
            .findMany({ where: { organizationId: orgId }, select: { name: true } })
            .then((a) => new Set(a.map((x) => x.name))),
          ctx.prisma.processingActivity
            .findMany({ where: { organizationId: orgId }, select: { name: true } })
            .then((a) => new Set(a.map((x) => x.name))),
        ]);

      // AI systems are created after the main transaction to avoid poisoning
      // the transaction if the ai_systems table doesn't exist yet.
      const pendingAiSystems: { data: NonNullable<ReturnType<typeof buildAISystemFromCatalog>>; catalogSlug: string }[] = [];

      // Execute everything in a transaction (extended timeout for large imports)
      const result = await ctx.prisma.$transaction(async (tx) => {
        const counts = {
          vendors: 0,
          assets: 0,
          elements: 0,
          activities: 0,
          flows: 0,
          transfers: 0,
          assessments: 0,
          aiSystems: 0,
        };

        // Every record made, named, so the result screen can link each one to
        // its own page (a flow has no page: it links to its source asset).
        const created = {
          vendors: [] as { id: string; name: string }[],
          assets: [] as { id: string; name: string }[],
          activities: [] as { id: string; name: string }[],
          flows: [] as { id: string; name: string; sourceAssetId: string }[],
        };

        // Track high-risk vendors for auto-assessment creation
        const highRiskVendors: {
          vendorId: string;
          vendorName: string;
          activityId: string;
          hasTransfers: boolean;
        }[] = [];

        const auditEntries: {
          entityType: string;
          entityId: string;
          action: string;
          changes?: object;
        }[] = [];

        // Map from asset name → created asset ID (for linking)
        const assetNameToId = new Map<string, string>();

        // ─── VENDOR PATH ──────────────────────────────
        for (const catalogVendor of catalogVendors) {
          // Skip existing vendors
          if (existingVendorNames.has(catalogVendor.name)) continue;

          const mapping = vendorMappingFor(
            catalogVendor.category,
            catalogVendor.subcategory,
            templateLang,
          );

          // Create vendor
          const vendor = await tx.vendor.create({
            data: {
              organizationId: orgId,
              name: catalogVendor.name,
              description: catalogVendor.description,
              website: catalogVendor.website,
              // The person picked vendors they use, so the record is active,
              // and it carries the risk the preview showed ("High risk").
              // Vendors already recorded are skipped above, so a re-run never
              // changes their status or risk.
              status: VendorStatus.ACTIVE,
              riskTier: mapping.isHighRisk ? VendorRiskTier.HIGH : null,
              categories: [catalogVendor.category],
              dataProcessed: mapping.elements
                .filter((e) => e.isPersonalData)
                .map((e) => e.category)
                .filter(
                  (c, i, arr) => arr.indexOf(c) === i
                ) as DataCategory[],
              countries: catalogVendor.dataLocations || [],
              certifications: catalogVendor.certifications || [],
              // Queryable provenance (item, stage 3): the quick start made this,
              // and nobody has confirmed it yet, so "Remove all template items"
              // may clear it until a person edits it.
              provenance: "AUTO_TEMPLATE",
              sourceRef: "quickstart",
              metadata: {
                source: "quickstart",
                ...(input.fromPortfolio ? { fromPortfolio: true } : {}),
                ...(catalogVendor.privacyTechnologies?.length
                  ? { privacyTechnologies: catalogVendor.privacyTechnologies }
                  : {}),
              },
            },
          });
          counts.vendors++;
          created.vendors.push({ id: vendor.id, name: vendor.name });
          auditEntries.push({
            entityType: "Vendor",
            entityId: vendor.id,
            action: "CREATE",
            changes: { source: "quickstart", catalogSlug: catalogVendor.slug },
          });

          // Collect AI system data for deferred creation (outside transaction)
          const aiSystemData = buildAISystemFromCatalog(
            {
              slug: catalogVendor.slug,
              name: catalogVendor.name,
              category: catalogVendor.category,
              subcategory: catalogVendor.subcategory,
              aiCapabilities: catalogVendor.aiCapabilities,
              aiTechniques: catalogVendor.aiTechniques,
              euAiActRole: catalogVendor.euAiActRole,
              euAiActCompliant: catalogVendor.euAiActCompliant,
              iso42001Certified: catalogVendor.iso42001Certified,
              aiModels: catalogVendor.aiModels,
              euAiActAnnexIIIDomains: catalogVendor.euAiActAnnexIIIDomains,
              tags: catalogVendor.tags,
            },
            vendor.id,
            catalogVendor.name,
            templateLang,
          );
          if (aiSystemData) {
            pendingAiSystems.push({ data: aiSystemData, catalogSlug: catalogVendor.slug });
          }

          // Create data asset for this vendor
          const assetName = `${catalogVendor.name} (${mapping.label})`;
          if (!existingAssetNames.has(assetName) && !skipAssets.has(assetName)) {
            const asset = await tx.dataAsset.create({
              data: {
                organizationId: orgId,
                name: assetName,
                description: mapping.asset.description,
                type: mapping.asset.type,
                hostingType: mapping.asset.hostingType,
                vendor: catalogVendor.name,
                isProduction: true,
                provenance: "AUTO_TEMPLATE",
                sourceRef: "quickstart",
                // Provenance for the "From … quick start" badge (item 3).
                metadata: { source: "quickstart" },
              },
            });
            counts.assets++;
            created.assets.push({ id: asset.id, name: asset.name });
            assetNameToId.set(assetName, asset.id);
            existingAssetNames.add(assetName);
            auditEntries.push({
              entityType: "DataAsset",
              entityId: asset.id,
              action: "CREATE",
              changes: { source: "quickstart" },
            });

            // Create data elements (batch)
            await tx.dataElement.createMany({
              data: mapping.elements.map((elem) => ({
                organizationId: orgId,
                dataAssetId: asset.id,
                name: elem.name,
                category: elem.category,
                sensitivity: elem.sensitivity,
                isPersonalData: elem.isPersonalData,
                isSpecialCategory: elem.isSpecialCategory,
                retentionDays: elem.retentionDays,
              })),
            });
            counts.elements += mapping.elements.length;

            // Create processing activity for this vendor
            const activityName = recordName(mapping.activity.name, catalogVendor.name);
            // An activity created before 11 Oct 2026 carries the older name.
            const legacyActivityName = legacyRecordName(mapping.activity.name, catalogVendor.name);
            if (
              !existingActivityNames.has(activityName) &&
              !existingActivityNames.has(legacyActivityName) &&
              !skipActivities.has(activityName)
            ) {
              const activity = await tx.processingActivity.create({
                data: {
                  organizationId: orgId,
                  name: activityName,
                  description: vendorText.activityDescription(catalogVendor.name),
                  purpose: mapping.activity.purpose,
                  legalBasis: mapping.activity.legalBasis,
                  dataSubjects: mapping.activity.dataSubjects,
                  categories: mapping.activity.categories,
                  recipients: mapping.activity.recipients,
                  retentionPeriod: mapping.activity.retentionPeriod,
                  retentionDays: mapping.activity.retentionDays,
                  isActive: true,
                  provenance: "AUTO_TEMPLATE",
                  sourceRef: "quickstart",
                  // Provenance for the "From … quick start" badge (item 3).
                  metadata: { source: "quickstart" },
                },
              });
              counts.activities++;
              created.activities.push({ id: activity.id, name: activity.name });
              existingActivityNames.add(activityName);
              auditEntries.push({
                entityType: "ProcessingActivity",
                entityId: activity.id,
                action: "CREATE",
                changes: { source: "quickstart" },
              });

              // Link asset to activity
              await tx.processingActivityAsset.create({
                data: {
                  processingActivityId: activity.id,
                  dataAssetId: asset.id,
                },
              });

              // Create data transfers (batch) for the destinations outside
              // the EEA without a full adequacy decision. Catalogue locations
              // are read as countries first ("EU" and "EEA" need no record,
              // "UK" is GB and adequate, "India (...)" is IN). A US vendor
              // that declares the EU-US Data Privacy Framework is recorded
              // under the adequacy decision, with its certification still to
              // be checked; the rest under SCCs.
              const nonEuLocations = transferDestinationsFor(
                catalogVendor.dataLocations || []
              ).countries;
              const dpf = declaresDpf(catalogVendor);
              if (nonEuLocations.length > 0) {
                await tx.dataTransfer.createMany({
                  data: nonEuLocations.map((country) => {
                    const underDpf = country === "US" && dpf;
                    return {
                      organizationId: orgId,
                      processingActivityId: activity.id,
                      vendorId: vendor.id,
                      name: vendorText.transferName(catalogVendor.name, country),
                      description: vendorText.transferDescription(catalogVendor.name, country),
                      destinationCountry: country,
                      destinationOrg: catalogVendor.name,
                      mechanism: underDpf
                        ? TransferMechanism.ADEQUACY_DECISION
                        : TransferMechanism.STANDARD_CONTRACTUAL_CLAUSES,
                      safeguards: underDpf
                        ? vendorText.transferSafeguardsDpf
                        : vendorText.transferSafeguards,
                      isActive: true,
                    };
                  }),
                });
                counts.transfers += nonEuLocations.length;
              }

              // Track high-risk vendors for auto-assessment
              if (mapping.isHighRisk) {
                highRiskVendors.push({
                  vendorId: vendor.id,
                  vendorName: catalogVendor.name,
                  activityId: activity.id,
                  hasTransfers: nonEuLocations.length > 0,
                });
              }
            }
          }
        }

        // ─── AUTO-GENERATE DATA FLOWS (internal ↔ vendor) ───
        // Collect all vendor asset IDs with their data categories and return-flow config
        const vendorAssetFlows: {
          assetId: string;
          vendorName: string;
          categories: DataCategory[];
          returnFlow?: {
            description: string;
            categories?: DataCategory[];
            frequency?: string;
          };
        }[] = [];
        for (const catalogVendor of catalogVendors) {
          if (existingVendorNames.has(catalogVendor.name)) continue;
          const mapping = vendorMappingFor(
            catalogVendor.category,
            catalogVendor.subcategory,
            templateLang,
          );
          const assetName = `${catalogVendor.name} (${mapping.label})`;
          const assetId = assetNameToId.get(assetName);
          if (assetId) {
            vendorAssetFlows.push({
              assetId,
              vendorName: catalogVendor.name,
              categories: [...new Set(mapping.elements.map((e) => e.category))] as DataCategory[],
              returnFlow: mapping.returnFlow,
            });
          }
        }

        if (vendorAssetFlows.length > 0) {
          // Find or create the internal systems asset
          // One internal-systems record per organisation, whichever language
          // an earlier run wrote it in.
          const internalAssetName = vendorText.internalSystemsName(ctx.organization.name);
          let internalAsset = await tx.dataAsset.findFirst({
            where: {
              organizationId: orgId,
              name: {
                in: [
                  internalAssetName,
                  VENDOR_QUICKSTART_TEXT.en.internalSystemsName(ctx.organization.name),
                  VENDOR_QUICKSTART_TEXT.es.internalSystemsName(ctx.organization.name),
                ],
              },
            },
          });

          if (!internalAsset) {
            internalAsset = await tx.dataAsset.create({
              data: {
                organizationId: orgId,
                name: internalAssetName,
                description: vendorText.internalSystemsDescription,
                type: "APPLICATION",
                hostingType: vendorText.internalSystemsHosting,
                isProduction: true,
                // Drafted like every other quick-start record: "To confirm"
                // until a person confirms it (template-items/drafts.ts).
                provenance: "AUTO_TEMPLATE",
                sourceRef: "quickstart",
                metadata: { source: "quickstart" },
              },
            });
            counts.assets++;
            created.assets.push({ id: internalAsset.id, name: internalAsset.name });
            assetNameToId.set(internalAssetName, internalAsset.id);
            auditEntries.push({
              entityType: "DataAsset",
              entityId: internalAsset.id,
              action: "CREATE",
              changes: { source: "quickstart", type: "internal-systems" },
            });
          }

          // Create outbound (internal → vendor) and, where applicable, return (vendor → internal) flows
          for (const vaf of vendorAssetFlows) {
            const outbound = await tx.dataFlow.create({
              data: {
                organizationId: orgId,
                name: vendorText.flowTo(vaf.vendorName),
                description: vendorText.flowToDescription(vaf.vendorName),
                sourceAssetId: internalAsset.id,
                destinationAssetId: vaf.assetId,
                dataCategories: vaf.categories,
                isAutomated: true,
                frequency: "Continuous",
              },
            });
            counts.flows++;
            created.flows.push({ id: outbound.id, name: outbound.name, sourceAssetId: outbound.sourceAssetId });

            if (vaf.returnFlow) {
              const inbound = await tx.dataFlow.create({
                data: {
                  organizationId: orgId,
                  name: vendorText.flowFrom(vaf.vendorName),
                  description: vaf.returnFlow.description,
                  sourceAssetId: vaf.assetId,
                  destinationAssetId: internalAsset.id,
                  dataCategories: vaf.returnFlow.categories ?? vaf.categories,
                  isAutomated: true,
                  frequency: vaf.returnFlow.frequency ?? "On request",
                },
              });
              counts.flows++;
              created.flows.push({ id: inbound.id, name: inbound.name, sourceAssetId: inbound.sourceAssetId });
            }
          }
        }

        // ─── AUTO-ASSESSMENT FOR HIGH-RISK VENDORS ───
        for (const hrVendor of highRiskVendors) {
          const result = await createAssessmentFromActivity({
            tx: tx as unknown as Prisma.TransactionClient,
            organizationId: orgId,
            userId,
            processingActivityId: hrVendor.activityId,
            vendorId: hrVendor.vendorId,
            vendorName: hrVendor.vendorName,
            assessmentType: "DPIA",
            reason:
              templateLang === "es"
                ? `Creada automáticamente: el inicio rápido ha marcado ${hrVendor.vendorName} como de alto riesgo${hrVendor.hasTransfers ? " (incluye transferencias internacionales)" : ""}`
                : `Auto-generated: ${hrVendor.vendorName} flagged as high-risk during quickstart import${hrVendor.hasTransfers ? " (includes international transfers)" : ""}`,
            locale: templateLang,
          });
          if (result.created) {
            counts.assessments++;
          }
        }

        // ─── INDUSTRY TEMPLATE PATH ──────────────────
        if (template) {
          // Create assets
          for (const templateAsset of template.assets) {
            if (
              existingAssetNames.has(templateAsset.name) ||
              skipAssets.has(templateAsset.name)
            ) {
              // Still resolve existing asset ID for linking
              const existing = await tx.dataAsset.findFirst({
                where: {
                  organizationId: orgId,
                  name: templateAsset.name,
                },
                select: { id: true },
              });
              if (existing) {
                assetNameToId.set(templateAsset.name, existing.id);
              }
              continue;
            }

            const asset = await tx.dataAsset.create({
              data: {
                organizationId: orgId,
                name: templateAsset.name,
                description: templateAsset.description,
                type: templateAsset.type,
                hostingType: templateAsset.hostingType,
                owner: templateAsset.owner,
                isProduction: true,
                provenance: "AUTO_TEMPLATE",
                sourceRef: template.id,
                // Provenance for the "From the … template" badge (item 3).
                metadata: { source: "template", templateId: template.id, templateName: template.name },
              },
            });
            counts.assets++;
            created.assets.push({ id: asset.id, name: asset.name });
            assetNameToId.set(templateAsset.name, asset.id);
            existingAssetNames.add(templateAsset.name);
            auditEntries.push({
              entityType: "DataAsset",
              entityId: asset.id,
              action: "CREATE",
              changes: {
                source: "quickstart",
                template: template.id,
              },
            });

            // Create data elements (batch)
            await tx.dataElement.createMany({
              data: templateAsset.elements.map((elem) => ({
                organizationId: orgId,
                dataAssetId: asset.id,
                name: elem.name,
                category: elem.category,
                sensitivity: elem.sensitivity,
                isPersonalData: elem.isPersonalData,
                isSpecialCategory: elem.isSpecialCategory,
                retentionDays: elem.retentionDays,
              })),
            });
            counts.elements += templateAsset.elements.length;
          }

          // Create processing activities
          for (const templateActivity of template.activities) {
            if (
              existingActivityNames.has(templateActivity.name) ||
              skipActivities.has(templateActivity.name)
            ) {
              continue;
            }

            const activity = await tx.processingActivity.create({
              data: {
                organizationId: orgId,
                name: templateActivity.name,
                description: templateActivity.description,
                purpose: templateActivity.purpose,
                legalBasis: templateActivity.legalBasis,
                dataSubjects: templateActivity.dataSubjects,
                categories: templateActivity.categories,
                recipients: templateActivity.recipients,
                retentionPeriod: templateActivity.retentionPeriod,
                retentionDays: templateActivity.retentionDays,
                isActive: true,
                provenance: "AUTO_TEMPLATE",
                sourceRef: template.id,
                // Provenance for the "From the … template" badge (item 3).
                metadata: { source: "template", templateId: template.id, templateName: template.name },
              },
            });
            counts.activities++;
            created.activities.push({ id: activity.id, name: activity.name });
            existingActivityNames.add(templateActivity.name);
            auditEntries.push({
              entityType: "ProcessingActivity",
              entityId: activity.id,
              action: "CREATE",
              changes: {
                source: "quickstart",
                template: template.id,
              },
            });

            // Link assets to activity
            for (const assetName of templateActivity.assetNames) {
              const assetId = assetNameToId.get(assetName);
              if (assetId) {
                await tx.processingActivityAsset.create({
                  data: {
                    processingActivityId: activity.id,
                    dataAssetId: assetId,
                  },
                });
              }
            }
          }

          // Create data flows (and reverse flows where the template marks them
          // bidirectional). A flow already recorded between the same two
          // systems in the same direction is skipped, so running the quick
          // start again with the same template adds no duplicate flows.
          const existingFlowPairs = new Set(
            (
              await tx.dataFlow.findMany({
                where: { organizationId: orgId },
                select: { sourceAssetId: true, destinationAssetId: true },
              })
            ).map((f) => flowPairKey(f.sourceAssetId, f.destinationAssetId)),
          );
          for (const templateFlow of template.flows) {
            const sourceId = assetNameToId.get(templateFlow.sourceAssetName);
            const destId = assetNameToId.get(templateFlow.destAssetName);
            if (sourceId && destId && !existingFlowPairs.has(flowPairKey(sourceId, destId))) {
              existingFlowPairs.add(flowPairKey(sourceId, destId));
              const flow = await tx.dataFlow.create({
                data: {
                  organizationId: orgId,
                  name: templateFlow.name,
                  description: templateFlow.description,
                  sourceAssetId: sourceId,
                  destinationAssetId: destId,
                  dataCategories: templateFlow.dataCategories,
                  frequency: templateFlow.frequency,
                  isAutomated: templateFlow.isAutomated,
                },
              });
              counts.flows++;
              created.flows.push({ id: flow.id, name: flow.name, sourceAssetId: flow.sourceAssetId });

              if (templateFlow.returnFlow && !existingFlowPairs.has(flowPairKey(destId, sourceId))) {
                existingFlowPairs.add(flowPairKey(destId, sourceId));
                const back = await tx.dataFlow.create({
                  data: {
                    organizationId: orgId,
                    name: returnFlowName(templateFlow.destAssetName, templateFlow.sourceAssetName, templateLang),
                    description: templateFlow.returnFlow.description,
                    sourceAssetId: destId,
                    destinationAssetId: sourceId,
                    dataCategories:
                      templateFlow.returnFlow.dataCategories ?? templateFlow.dataCategories,
                    frequency: templateFlow.returnFlow.frequency ?? defaultReturnFlowFrequency(templateLang),
                    isAutomated: templateFlow.isAutomated,
                  },
                });
                counts.flows++;
                created.flows.push({ id: back.id, name: back.name, sourceAssetId: back.sourceAssetId });
              }
            }
          }
        }

        // ─── AUDIT LOG ENTRIES (batch) ──────────────────
        if (auditEntries.length > 0) {
          await tx.auditLog.createMany({
            data: auditEntries.map((entry) => ({
              organizationId: orgId,
              userId,
              entityType: entry.entityType,
              entityId: entry.entityId,
              action: entry.action,
              changes: entry.changes,
              metadata: { source: "quickstart" },
            })),
          });
        }

        // Hosted pilot: a batch that takes the organisation over a records
        // ceiling rolls back as a whole (no-op on the kit).
        for (const resource of PILOT_BATCH_RESOURCES) {
          await assertPilotCapacity(tx, orgId, resource, 0, pilotLang);
        }

        return { ...counts, created };
      }, { timeout: 30000 });

      // Create AI systems outside the transaction — gracefully skip if table missing
      if (pendingAiSystems.length > 0) {
        try {
          for (const { data: aiData, catalogSlug } of pendingAiSystems) {
            if (!(await hasPilotRoom(ctx.prisma, orgId, "aiSystems"))) break;
            await ctx.prisma.aISystem.create({
              data: {
                organizationId: orgId,
                name: aiData.name,
                description: aiData.description,
                purpose: aiData.purpose,
                riskLevel: aiData.riskLevel,
                category: aiData.category,
                modelType: aiData.modelType,
                provider: aiData.provider,
                vendorId: aiData.vendorId,
                aiCapabilities: aiData.aiCapabilities,
                aiTechniques: aiData.aiTechniques,
                euAiActRole: aiData.euAiActRole,
                euAiActCompliant: aiData.euAiActCompliant,
                iso42001Certified: aiData.iso42001Certified,
                aiModels: aiData.aiModels ?? undefined,
                catalogSlug: aiData.catalogSlug,
                status: "DRAFT",
              },
            });
            result.aiSystems++;
          }
        } catch (aiErr) {
          console.warn("[quickstart] Skipping AI system creation (table may not exist):", aiErr);
        }
      }

      // Record on the organisation (additive merge into its settings JSON) that
      // the quick start was run to the end, and the programme's name when one
      // was given. The path's quick start step and day 1 of the 30/60/90-day
      // plan read `settings.quickstart.completedAt`
      // (services/program/path-counts.ts, plan-start.ts): without it a run
      // with a template and no vendors left "Next step: Quick start" and the
      // plan "Not started". The first completion is kept, so a second run never
      // moves day 1. Best-effort: a failure here never fails the quickstart.
      try {
        const org = await ctx.prisma.organization.findUnique({
          where: { id: orgId },
          select: { settings: true },
        });
        const settings = quickstartSettingsAfterRun(org?.settings, {
          now: new Date(),
          programName: input.programName,
        });
        await ctx.prisma.organization.update({
          where: { id: orgId },
          data: { settings: settings as Prisma.InputJsonValue },
        });
      } catch (settingsErr) {
        console.warn("[quickstart] Could not record the quick start on the organization:", settingsErr);
      }

      return result;
    }),
});
