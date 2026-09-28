// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Db } from "@/lib/prisma";

/**
 * "Remove all template items": clear the vendors, data assets and processing
 * activities the quick start or an industry template created silently, but only
 * the ones a person has not touched. Nothing a person edited is ever removed.
 *
 * Two facts decide a candidate, both additive columns (the provenance quad on
 * vendors / data_assets / processing_activities):
 *   - provenance === "AUTO_TEMPLATE"  → the row was created by a template.
 *   - confirmedAt === null            → nobody has taken ownership of it.
 * A row created before these columns existed defaults to USER_ENTERED, so it is
 * treated as possibly edited and is never removed automatically.
 *
 * A candidate is KEPT if it, or any child that shows a human touch, would take
 * real work down with it:
 *   - a processing activity with an assessment past DRAFT, or a cross-border
 *     transfer, is kept;
 *   - a vendor with a contract, a review, a questionnaire response, a linked AI
 *     system, or an assessment past DRAFT is kept;
 *   - a data asset used in an incident, a rights request or a data flow, or one
 *     still linked to a processing activity that is being kept, is kept.
 *
 * Only the where-operators equality / null / not / in / notIn / OR are used, so
 * the logic is unit-tested against an in-memory Prisma (see remove.test.ts).
 */

export interface TemplateRemovalBucket {
  remove: number;
  keep: number;
}

export interface TemplateRemovalPlan {
  vendors: TemplateRemovalBucket;
  dataAssets: TemplateRemovalBucket;
  processingActivities: TemplateRemovalBucket;
  totalRemove: number;
  totalKeep: number;
  removeIds: { vendors: string[]; dataAssets: string[]; processingActivities: string[] };
}

const CANDIDATE = { provenance: "AUTO_TEMPLATE" as const, confirmedAt: null };

export async function planTemplateRemoval(
  prisma: Db,
  organizationId: string,
): Promise<TemplateRemovalPlan> {
  // --- processing activities ---
  const candidateActivities = await prisma.processingActivity.findMany({
    where: { organizationId, ...CANDIDATE },
    select: { id: true },
  });
  const candidateActivityIds = candidateActivities.map((a) => a.id);

  const protectedActivities = new Set<string>();
  if (candidateActivityIds.length > 0) {
    const [workedAssessments, transfers] = await Promise.all([
      prisma.assessment.findMany({
        where: { organizationId, processingActivityId: { in: candidateActivityIds }, status: { not: "DRAFT" } },
        select: { processingActivityId: true },
      }),
      prisma.dataTransfer.findMany({
        where: { processingActivityId: { in: candidateActivityIds } },
        select: { processingActivityId: true },
      }),
    ]);
    for (const row of workedAssessments) if (row.processingActivityId) protectedActivities.add(row.processingActivityId);
    for (const row of transfers) if (row.processingActivityId) protectedActivities.add(row.processingActivityId);
  }
  const removeActivityIds = candidateActivityIds.filter((id) => !protectedActivities.has(id));

  // --- vendors ---
  const candidateVendors = await prisma.vendor.findMany({
    where: { organizationId, ...CANDIDATE },
    select: { id: true },
  });
  const candidateVendorIds = candidateVendors.map((v) => v.id);

  const protectedVendors = new Set<string>();
  if (candidateVendorIds.length > 0) {
    const [contracts, reviews, responses, workedAssessments, systems] = await Promise.all([
      prisma.vendorContract.findMany({
        where: { vendorId: { in: candidateVendorIds } },
        select: { vendorId: true },
      }),
      prisma.vendorReview.findMany({
        where: { vendorId: { in: candidateVendorIds } },
        select: { vendorId: true },
      }),
      prisma.vendorQuestionnaireResponse.findMany({
        where: { vendorId: { in: candidateVendorIds } },
        select: { vendorId: true },
      }),
      prisma.assessment.findMany({
        where: { organizationId, vendorId: { in: candidateVendorIds }, status: { not: "DRAFT" } },
        select: { vendorId: true },
      }),
      prisma.aISystem.findMany({
        where: { vendorId: { in: candidateVendorIds } },
        select: { vendorId: true },
      }),
    ]);
    for (const row of [...contracts, ...reviews, ...responses, ...workedAssessments, ...systems]) {
      if (row.vendorId) protectedVendors.add(row.vendorId);
    }
  }
  const removeVendorIds = candidateVendorIds.filter((id) => !protectedVendors.has(id));

  // --- data assets ---
  const candidateAssets = await prisma.dataAsset.findMany({
    where: { organizationId, ...CANDIDATE },
    select: { id: true },
  });
  const candidateAssetIds = candidateAssets.map((a) => a.id);

  const protectedAssets = new Set<string>();
  if (candidateAssetIds.length > 0) {
    const [incidentAssets, dsarTasks, sourceFlows, destFlows, links] = await Promise.all([
      prisma.incidentAffectedAsset.findMany({
        where: { dataAssetId: { in: candidateAssetIds } },
        select: { dataAssetId: true },
      }),
      prisma.dSARTask.findMany({
        where: { dataAssetId: { in: candidateAssetIds } },
        select: { dataAssetId: true },
      }),
      prisma.dataFlow.findMany({
        where: { sourceAssetId: { in: candidateAssetIds } },
        select: { sourceAssetId: true },
      }),
      prisma.dataFlow.findMany({
        where: { destinationAssetId: { in: candidateAssetIds } },
        select: { destinationAssetId: true },
      }),
      // Links to a processing activity that is NOT being removed keep the asset:
      // deleting it would strip a kept activity of one of its assets.
      prisma.processingActivityAsset.findMany({
        where: {
          dataAssetId: { in: candidateAssetIds },
          processingActivityId: { notIn: removeActivityIds.length > 0 ? removeActivityIds : ["__none__"] },
        },
        select: { dataAssetId: true },
      }),
    ]);
    for (const row of incidentAssets) if (row.dataAssetId) protectedAssets.add(row.dataAssetId);
    for (const row of dsarTasks) if (row.dataAssetId) protectedAssets.add(row.dataAssetId);
    for (const row of sourceFlows) if (row.sourceAssetId) protectedAssets.add(row.sourceAssetId);
    for (const row of destFlows) if (row.destinationAssetId) protectedAssets.add(row.destinationAssetId);
    for (const row of links) if (row.dataAssetId) protectedAssets.add(row.dataAssetId);
  }
  const removeAssetIds = candidateAssetIds.filter((id) => !protectedAssets.has(id));

  const processingActivities = {
    remove: removeActivityIds.length,
    keep: candidateActivityIds.length - removeActivityIds.length,
  };
  const vendors = { remove: removeVendorIds.length, keep: candidateVendorIds.length - removeVendorIds.length };
  const dataAssets = { remove: removeAssetIds.length, keep: candidateAssetIds.length - removeAssetIds.length };

  return {
    vendors,
    dataAssets,
    processingActivities,
    totalRemove: vendors.remove + dataAssets.remove + processingActivities.remove,
    totalKeep: vendors.keep + dataAssets.keep + processingActivities.keep,
    removeIds: {
      vendors: removeVendorIds,
      dataAssets: removeAssetIds,
      processingActivities: removeActivityIds,
    },
  };
}

export interface RemoveTemplateItemsResult {
  vendors: number;
  dataAssets: number;
  processingActivities: number;
  total: number;
}

export async function removeTemplateItems(
  prisma: Db,
  args: { organizationId: string; userId: string },
): Promise<RemoveTemplateItemsResult> {
  const { organizationId, userId } = args;
  const plan = await planTemplateRemoval(prisma, organizationId);

  await prisma.$transaction(async (tx) => {
    // Activities first: their cascade removes the join rows they created.
    if (plan.removeIds.processingActivities.length > 0) {
      await tx.processingActivity.deleteMany({
        where: { id: { in: plan.removeIds.processingActivities }, organizationId },
      });
    }
    // Data assets next: their cascade removes the data elements they created.
    if (plan.removeIds.dataAssets.length > 0) {
      await tx.dataAsset.deleteMany({
        where: { id: { in: plan.removeIds.dataAssets }, organizationId },
      });
    }
    // Vendors last.
    if (plan.removeIds.vendors.length > 0) {
      await tx.vendor.deleteMany({
        where: { id: { in: plan.removeIds.vendors }, organizationId },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "Organization",
        entityId: organizationId,
        action: "DELETE_TEMPLATE_ITEMS",
        changes: {
          vendors: plan.vendors.remove,
          dataAssets: plan.dataAssets.remove,
          processingActivities: plan.processingActivities.remove,
          kept: plan.totalKeep,
        },
      },
    });
  });

  return {
    vendors: plan.vendors.remove,
    dataAssets: plan.dataAssets.remove,
    processingActivities: plan.processingActivities.remove,
    total: plan.totalRemove,
  };
}
