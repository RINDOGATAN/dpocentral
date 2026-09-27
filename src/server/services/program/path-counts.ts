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

  const [
    organization,
    dataAssets,
    processingActivities,
    jurisdictions,
    vendors,
    vendorsAssessed,
    vendorAssessments,
    assessments,
    assessmentsApproved,
    transfers,
    dsarRequests,
    dsarIntakeForms,
    incidents,
    aiSystems,
  ] = await Promise.all([
    prisma.organization.findFirst({ where: { id: organizationId }, select: { settings: true } }),
    prisma.dataAsset.count({ where: org }),
    prisma.processingActivity.count({ where: org }),
    prisma.organizationJurisdiction.count({ where: org }),
    prisma.vendor.count({ where: org }),
    prisma.vendor.count({ where: { ...org, assessments: { some: { status: "APPROVED" } } } }),
    prisma.assessment.count({ where: { ...org, vendorId: { not: null } } }),
    prisma.assessment.count({ where: org }),
    prisma.assessment.count({ where: { ...org, status: "APPROVED" } }),
    prisma.dataTransfer.count({ where: org }),
    prisma.dSARRequest.count({ where: org }),
    prisma.dSARIntakeForm.count({ where: { ...org, isActive: true } }),
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
    processingActivities,
    jurisdictions,
    vendors,
    vendorsAssessed,
    vendorAssessments,
    assessments,
    assessmentsApproved,
    transfers,
    dsarRequests,
    dsarIntakeForms,
    incidents,
    aiSystems,
  };
}
