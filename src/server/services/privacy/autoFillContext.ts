// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shared auto-fill context assembly for DPIA generation.
 *
 * Extracted from the inline assembly in routers/privacy/assessment.ts so the
 * deterministic rule path (assessment.generateDpiaFromActivity) and the
 * optional AI path (assessment.generateAiNarrative) load and shape the SAME
 * processing-activity data. Org-scoped: the activity and vendor lookups are
 * always filtered by organizationId.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { TRPCError } from "@trpc/server";
import type { ProcessingActivity, Vendor } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import type { AutoFillContext } from "@/config/dpia-auto-fill-rules";

type PrismaLike = Pick<Db, "processingActivity" | "vendor">;

export interface AutoFillAsset {
  name: string;
  type: string;
  hostingType: string | null;
  vendor: string | null;
}

export interface AutoFillElement {
  name: string;
  category: string;
  sensitivity: string;
  isSpecialCategory: boolean;
}

export interface AutoFillTransfer {
  destinationCountry: string;
  mechanism: string;
  safeguards: string | null;
}

export interface BuiltAutoFillContext {
  /** The processing activity row (with assets+elements+transfers loaded). */
  activity: ProcessingActivity;
  /** The linked vendor row, when requested and found. */
  vendor: Vendor | null;
  assets: AutoFillAsset[];
  elements: AutoFillElement[];
  transfers: AutoFillTransfer[];
  /** The rule-engine/AI-prompt context shape (dpia-auto-fill-rules.ts). */
  context: AutoFillContext;
}

/**
 * Load a processing activity (org-scoped) and flatten its linked data into
 * the AutoFillContext consumed by both the rule engine and the AI prompt
 * builder. Throws NOT_FOUND when the activity does not belong to the org.
 */
export async function buildAutoFillContext(
  prisma: PrismaLike,
  organizationId: string,
  processingActivityId: string,
  vendorId?: string
): Promise<BuiltAutoFillContext> {
  // Load the processing activity with all linked data
  const activity = await prisma.processingActivity.findFirst({
    where: {
      id: processingActivityId,
      organizationId,
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
      transfers: true,
    },
  });

  if (!activity) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Processing activity not found",
    });
  }

  // Load vendor if specified
  const vendor = vendorId
    ? await prisma.vendor.findFirst({
        where: { id: vendorId, organizationId },
      })
    : null;

  // Build auto-fill context
  const assets: AutoFillAsset[] = activity.assets.map((pa: any) => ({
    name: pa.dataAsset.name,
    type: pa.dataAsset.type,
    hostingType: pa.dataAsset.hostingType,
    vendor: pa.dataAsset.vendor,
  }));

  const elements: AutoFillElement[] = activity.assets.flatMap((pa: any) =>
    pa.dataAsset.dataElements.map((e: any) => ({
      name: e.name,
      category: e.category,
      sensitivity: e.sensitivity,
      isSpecialCategory: e.isSpecialCategory,
    }))
  );

  const transfers: AutoFillTransfer[] = activity.transfers.map((t: any) => ({
    destinationCountry: t.destinationCountry,
    mechanism: t.mechanism,
    safeguards: t.safeguards,
  }));

  const context: AutoFillContext = {
    activity: {
      name: activity.name,
      purpose: activity.purpose,
      legalBasis: String(activity.legalBasis),
      dataSubjects: activity.dataSubjects,
      categories: activity.categories.map((c) => String(c)),
      recipients: activity.recipients,
      retentionPeriod: activity.retentionPeriod ?? "Not specified",
      retentionDays: activity.retentionDays,
      automatedDecisionMaking: activity.automatedDecisionMaking,
      automatedDecisionDetails: activity.automatedDecisionDetail,
    },
    assets,
    elements,
    transfers,
    vendor: vendor
      ? {
          name: vendor.name,
          certifications: vendor.certifications,
          countries: vendor.countries,
        }
      : null,
  };

  return { activity, vendor, assets, elements, transfers, context };
}
