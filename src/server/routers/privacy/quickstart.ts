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
  Prisma,
} from "@prisma/client";
import {
  findMappingForCategory,
  GENERIC_VENDOR_MAPPING,
  requiresTransferSafeguards,
  type VendorDataMapping,
} from "../../../config/vendor-data-mappings";
import {
  getTemplateById,
  INDUSTRY_TEMPLATES,
  type IndustryTemplate,
} from "../../../config/industry-templates";
import { hasVendorCatalogAccess } from "../../services/licensing/entitlement";
import { createAssessmentFromActivity } from "../../services/assessment-auto-create";
import {
  isAiCapableVendor,
  buildAISystemFromCatalog,
  type VendorCatalogAIFields,
} from "../../../config/vendor-ai-detection";

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
}

function buildVendorPreview(
  catalogVendor: {
    slug: string;
    name: string;
    category: string;
    subcategory?: string | null;
    dataLocations: string[];
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
  const transfers = (catalogVendor.dataLocations || [])
    .filter(requiresTransferSafeguards)
    .map((country) => ({
      country,
      mechanism: "Standard Contractual Clauses",
    }));

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
    activityName: `${mapping.activity.name} — ${catalogVendor.name}`,
    isHighRisk: mapping.isHighRisk,
    transfers,
    privacyTechnologies: catalogVendor.privacyTechnologies || [],
    isAiCapable: isAiCapableVendor(aiFields),
    aiCapabilities: catalogVendor.aiCapabilities ?? [],
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
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
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
          const mapping =
            findMappingForCategory(catalog.category, catalog.subcategory) ?? GENERIC_VENDOR_MAPPING;
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
      })
    )
    .query(async ({ ctx, input }) => {
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
        const mapping =
          findMappingForCategory(vendor.category, vendor.subcategory) ?? GENERIC_VENDOR_MAPPING;
        const preview = buildVendorPreview(vendor, mapping);
        previews.push(preview);
      }

      const newPreviews = previews.filter(
        (p) => !existingVendorNames.has(p.vendorName)
      );

      return {
        previews,
        existingVendorNames: Array.from(existingVendorNames),
        totals: {
          vendors: newPreviews.length,
          assets: newPreviews.length,
          elements: newPreviews.reduce((sum, p) => sum + p.elementCount, 0),
          activities: newPreviews.length,
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
      })
    )
    .query(async ({ ctx, input }) => {
      const template = getTemplateById(input.industryId);
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
        select: { name: true },
      });
      const existingAssetNames = new Set(existingAssets.map((a) => a.name));

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
          flows: template.flows.length,
        },
      };
    }),

  // ──────────────────────────────────────────────────
  // List available industry templates (lightweight)
  // ──────────────────────────────────────────────────
  listTemplates: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(() => {
      return INDUSTRY_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        assetCount: t.assets.length,
        activityCount: t.activities.length,
        flowCount: t.flows.length,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.organization.id;
      const userId = ctx.session.user.id;
      const skipAssets = new Set(input.skipAssetNames);
      const skipActivities = new Set(input.skipActivityNames);

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
          if (input.vendorSlugs.length > remainingFree) {
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
        template = getTemplateById(input.industryId);
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

          const mapping =
            findMappingForCategory(catalogVendor.category, catalogVendor.subcategory) ??
            GENERIC_VENDOR_MAPPING;

          // Create vendor
          const vendor = await tx.vendor.create({
            data: {
              organizationId: orgId,
              name: catalogVendor.name,
              description: catalogVendor.description,
              website: catalogVendor.website,
              status: VendorStatus.PROSPECTIVE,
              categories: [catalogVendor.category],
              dataProcessed: mapping.elements
                .filter((e) => e.isPersonalData)
                .map((e) => e.category)
                .filter(
                  (c, i, arr) => arr.indexOf(c) === i
                ) as DataCategory[],
              countries: catalogVendor.dataLocations || [],
              certifications: catalogVendor.certifications || [],
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
              },
            });
            counts.assets++;
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
            const activityName = `${mapping.activity.name} — ${catalogVendor.name}`;
            if (
              !existingActivityNames.has(activityName) &&
              !skipActivities.has(activityName)
            ) {
              const activity = await tx.processingActivity.create({
                data: {
                  organizationId: orgId,
                  name: activityName,
                  description: `Auto-generated from ${catalogVendor.name} vendor import`,
                  purpose: mapping.activity.purpose,
                  legalBasis: mapping.activity.legalBasis,
                  dataSubjects: mapping.activity.dataSubjects,
                  categories: mapping.activity.categories,
                  recipients: mapping.activity.recipients,
                  retentionPeriod: mapping.activity.retentionPeriod,
                  retentionDays: mapping.activity.retentionDays,
                  isActive: true,
                },
              });
              counts.activities++;
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

              // Create data transfers for non-EU countries
              // Create data transfers for non-EU countries (batch)
              const nonEuLocations = (
                catalogVendor.dataLocations || []
              ).filter(requiresTransferSafeguards);
              if (nonEuLocations.length > 0) {
                await tx.dataTransfer.createMany({
                  data: nonEuLocations.map((country) => ({
                    organizationId: orgId,
                    processingActivityId: activity.id,
                    name: `Transfer to ${catalogVendor.name} (${country})`,
                    description: `Data transfer to ${catalogVendor.name} servers in ${country}`,
                    destinationCountry: country,
                    destinationOrg: catalogVendor.name,
                    mechanism: TransferMechanism.STANDARD_CONTRACTUAL_CLAUSES,
                    safeguards:
                      "Standard Contractual Clauses (SCCs) with supplementary measures",
                    isActive: true,
                  })),
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
          const mapping =
            findMappingForCategory(catalogVendor.category, catalogVendor.subcategory) ??
            GENERIC_VENDOR_MAPPING;
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
          const internalAssetName = `${ctx.organization.name} Internal Systems`;
          let internalAsset = await tx.dataAsset.findFirst({
            where: { organizationId: orgId, name: internalAssetName },
          });

          if (!internalAsset) {
            internalAsset = await tx.dataAsset.create({
              data: {
                organizationId: orgId,
                name: internalAssetName,
                description: "Primary internal systems that process and share data with third-party services",
                type: "APPLICATION",
                hostingType: "On-premise / Cloud",
                isProduction: true,
              },
            });
            counts.assets++;
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
            await tx.dataFlow.create({
              data: {
                organizationId: orgId,
                name: `Data flow to ${vaf.vendorName}`,
                description: `Automated data sharing with ${vaf.vendorName}`,
                sourceAssetId: internalAsset.id,
                destinationAssetId: vaf.assetId,
                dataCategories: vaf.categories,
                isAutomated: true,
                frequency: "Continuous",
              },
            });
            counts.flows++;

            if (vaf.returnFlow) {
              await tx.dataFlow.create({
                data: {
                  organizationId: orgId,
                  name: `Data flow from ${vaf.vendorName}`,
                  description: vaf.returnFlow.description,
                  sourceAssetId: vaf.assetId,
                  destinationAssetId: internalAsset.id,
                  dataCategories: vaf.returnFlow.categories ?? vaf.categories,
                  isAutomated: true,
                  frequency: vaf.returnFlow.frequency ?? "On request",
                },
              });
              counts.flows++;
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
            reason: `Auto-generated: ${hrVendor.vendorName} flagged as high-risk during quickstart import${hrVendor.hasTransfers ? " (includes international transfers)" : ""}`,
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
              },
            });
            counts.assets++;
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
              },
            });
            counts.activities++;
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

          // Create data flows (and reverse flows where the template marks them bidirectional)
          for (const templateFlow of template.flows) {
            const sourceId = assetNameToId.get(templateFlow.sourceAssetName);
            const destId = assetNameToId.get(templateFlow.destAssetName);
            if (sourceId && destId) {
              await tx.dataFlow.create({
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

              if (templateFlow.returnFlow) {
                await tx.dataFlow.create({
                  data: {
                    organizationId: orgId,
                    name: `${templateFlow.destAssetName} to ${templateFlow.sourceAssetName}`,
                    description: templateFlow.returnFlow.description,
                    sourceAssetId: destId,
                    destinationAssetId: sourceId,
                    dataCategories:
                      templateFlow.returnFlow.dataCategories ?? templateFlow.dataCategories,
                    frequency: templateFlow.returnFlow.frequency ?? "On request",
                    isAutomated: templateFlow.isAutomated,
                  },
                });
                counts.flows++;
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

        return counts;
      }, { timeout: 30000 });

      // Create AI systems outside the transaction — gracefully skip if table missing
      if (pendingAiSystems.length > 0) {
        try {
          for (const { data: aiData, catalogSlug } of pendingAiSystems) {
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

      return result;
    }),
});
