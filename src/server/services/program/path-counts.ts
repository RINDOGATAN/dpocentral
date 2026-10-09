// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The counts the privacy program path reads (src/components/guided/path-config.ts).
 *
 * Counts only, every one scoped to the organisation, all issued at once: no
 * record leaves the database, so the menu stays cheap to fill in. The rules
 * that turn these numbers into "done / started / not started" live next to
 * each step in the path config, not here.
 */

import type { Db } from "@/lib/prisma";
import type { PathCounts } from "@/components/guided/path-config";
import { isIntakeConfigured } from "@/server/services/dsar/defaultIntakeForm";
import { DRAFT_WHERE } from "@/server/services/template-items/drafts";

function settingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadPathCounts(
  prisma: Db,
  organizationId: string,
): Promise<PathCounts> {
  const org = { organizationId };
  // A draft: created by the quick start, a template or another client's copy,
  // and not yet confirmed by a person (services/template-items/drafts.ts).
  const drafts = { organizationId, ...DRAFT_WHERE };

  const [
    organization,
    dataAssets,
    dataAssetsDrafts,
    processingActivities,
    processingActivitiesDrafts,
    jurisdictions,
    vendors,
    vendorsDrafts,
    vendorsAssessed,
    vendorAssessments,
    assessments,
    assessmentsApproved,
    liaAssessments,
    liaApproved,
    transfers,
    transfersDrafts,
    dsarRequests,
    intakeForm,
    incidents,
    aiSystems,
  ] = await Promise.all([
    prisma.organization.findFirst({ where: { id: organizationId }, select: { settings: true } }),
    prisma.dataAsset.count({ where: org }),
    prisma.dataAsset.count({ where: drafts }),
    prisma.processingActivity.count({ where: org }),
    prisma.processingActivity.count({ where: drafts }),
    prisma.organizationJurisdiction.count({ where: org }),
    prisma.vendor.count({ where: org }),
    prisma.vendor.count({ where: drafts }),
    prisma.vendor.count({ where: { ...org, assessments: { some: { status: "APPROVED" } } } }),
    prisma.assessment.count({ where: { ...org, vendorId: { not: null } } }),
    prisma.assessment.count({ where: org }),
    prisma.assessment.count({ where: { ...org, status: "APPROVED" } }),
    prisma.assessment.count({ where: { ...org, template: { type: "LIA" } } }),
    prisma.assessment.count({ where: { ...org, status: "APPROVED", template: { type: "LIA" } } }),
    prisma.dataTransfer.count({ where: org }),
    prisma.dataTransfer.count({ where: { ...org, processingActivity: DRAFT_WHERE } }),
    prisma.dSARRequest.count({ where: org }),
    // The active intake form's shape, not just its presence: every org is
    // auto-seeded a default form so the public portal works out of the box, so
    // the mere existence of a form is no signal. We read its fields and decide
    // whether the org has actually set up its intake (isIntakeConfigured).
    prisma.dSARIntakeForm.findFirst({
      where: { ...org, isActive: true },
      select: {
        slug: true,
        title: true,
        description: true,
        thankYouMessage: true,
        privacyNoticeUrl: true,
        customCss: true,
        fields: true,
      },
    }),
    prisma.incident.count({ where: org }),
    // The AI systems table is optional on some deployments (the quick start
    // guards its creation the same way); an unreadable table counts as none.
    prisma.aISystem.count({ where: org }).catch(() => 0),
  ]);

  const settings = settingsObject(organization?.settings);
  const quickstart = settingsObject(settings.quickstart);

  return {
    quickstartCompleted: typeof quickstart.completedAt === "string",
    dataAssets,
    dataAssetsDrafts,
    processingActivities,
    processingActivitiesDrafts,
    jurisdictions,
    vendors,
    vendorsDrafts,
    vendorsAssessed,
    vendorAssessments,
    assessments,
    assessmentsApproved,
    liaAssessments,
    liaApproved,
    transfers,
    transfersDrafts,
    dsarRequests,
    dsarIntakeConfigured: intakeForm ? isIntakeConfigured(intakeForm) : false,
    incidents,
    aiSystems,
  };
}

/** Records drafted and not yet confirmed, across the three kinds. */
export function draftTotal(counts: PathCounts): number {
  return counts.dataAssetsDrafts + counts.processingActivitiesDrafts + counts.vendorsDrafts;
}
