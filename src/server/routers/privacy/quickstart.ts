import { z } from "zod";
import { createTRPCRouter, organizationProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import {
  DataAssetType,
  DataSensitivity,
  DataCategory,
  LegalBasis,
  TransferMechanism,
  VendorStatus,
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
}

function buildVendorPreview(
  catalogVendor: {
    slug: string;
    name: string;
    category: string;
    subcategory?: string | null;
    dataLocations: string[];
  },
  mapping: VendorDataMapping
): VendorPreviewItem {
  const transfers = (catalogVendor.dataLocations || [])
    .filter(requiresTransferSafeguards)
    .map((country) => ({
      country,
      mechanism: "Standard Contractual Clauses",
    }));

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

      // VwPortfolioVendor.accountId = NextAuth User.id (shared DB)
      const portfolioVendors = await ctx.prisma.vwPortfolioVendor.findMany({
        where: { accountId: userId },
        orderBy: { createdAt: "desc" },
      });

      if (portfolioVendors.length === 0) {
        return { hasPortfolio: false as const, vendors: [], slugs: [] };
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
      })
    )
    .query(async ({ ctx, input }) => {
      // Check entitlement
      const hasAccess = await hasVendorCatalogAccess(ctx.organization.id);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Vendor Catalog access is required to import vendors. Enable this add-on to get started.",
        });
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

      return {
        previews,
        existingVendorNames: Array.from(existingVendorNames),
        totals: {
          vendors: previews.filter(
            (p) => !existingVendorNames.has(p.vendorName)
          ).length,
          assets: previews.filter(
            (p) => !existingVendorNames.has(p.vendorName)
          ).length,
          elements: previews
            .filter((p) => !existingVendorNames.has(p.vendorName))
            .reduce((sum, p) => sum + p.elementCount, 0),
          activities: previews.filter(
            (p) => !existingVendorNames.has(p.vendorName)
          ).length,
          transfers: previews
            .filter((p) => !existingVendorNames.has(p.vendorName))
            .reduce((sum, p) => sum + p.transfers.length, 0),
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
  execute: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        vendorSlugs: z.array(z.string()).max(20).default([]),
        industryId: z.string().optional(),
        skipAssetNames: z.array(z.string()).default([]),
        skipActivityNames: z.array(z.string()).default([]),
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
        const hasAccess = await hasVendorCatalogAccess(orgId);
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Vendor Catalog access is required to import vendors.",
          });
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

      // Fetch catalog vendors if needed
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

      // Execute everything in a transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const counts = {
          vendors: 0,
          assets: 0,
          elements: 0,
          activities: 0,
          flows: 0,
          transfers: 0,
        };

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
            },
          });
          counts.vendors++;
          auditEntries.push({
            entityType: "Vendor",
            entityId: vendor.id,
            action: "CREATE",
            changes: { source: "quickstart", catalogSlug: catalogVendor.slug },
          });

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
            }
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

          // Create data flows
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
      });

      return result;
    }),
});
