// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The facts the document register reads (src/config/document-register.ts):
 * the path's counts plus the few the documents need. Counts only, every one
 * scoped to the organisation, all issued at once; no record leaves the
 * database. The rules that turn them into "ready / draft / needs an input"
 * live next to each document in the register, not here.
 */

import type { Db } from "@/lib/prisma";
import type { DocumentFacts } from "@/config/document-register";
import { isAssessmentTypeLocked } from "@/lib/premium-gate";
import { isHostedDeployment } from "@/lib/hosted";
import { getEntitledAssessmentTypes, isDpiaPilotTier } from "@/server/services/licensing/entitlement";
import { ensureHostedTemplates } from "@/server/services/pilot/hosted-templates";
import { pilotDpiaQuota } from "@/server/services/pilot/caps";
import { isAIConfigured } from "@/server/services/ai/llm-door";
import { postureLane } from "@/server/services/ai/posture";
import { collectIncompleteRecords } from "@/server/services/views/queries";
import { features } from "@/config/features";
import { loadPathCounts } from "./path-counts";

/** Whether a new DPIA can be started here (decision d5); the same rules as the type grid. */
async function loadDpiaAccess(prisma: Db, organizationId: string): Promise<DocumentFacts["dpiaAccess"]> {
  const hosted = isHostedDeployment();
  await ensureHostedTemplates();
  const entitledTypes = await getEntitledAssessmentTypes(organizationId);
  if (isAssessmentTypeLocked({ type: "DPIA", entitledTypes, hosted })) return "module";
  const quota = await pilotDpiaQuota(prisma, organizationId, await isDpiaPilotTier(organizationId));
  if (quota.capped && quota.remaining === 0) return "quotaUsed";
  return "available";
}

export async function loadDocumentFacts(prisma: Db, organizationId: string): Promise<DocumentFacts> {
  const org = { organizationId };
  const [
    counts,
    incomplete,
    dpiaAssessments,
    dpiaApproved,
    dpiaAccess,
    dpaContracts,
    incidentsMissingImpact,
    incidentNotifications,
    aiSettings,
    dsarCompleted,
  ] = await Promise.all([
    loadPathCounts(prisma, organizationId),
    // The whole organisation's records (the register is organisation-wide).
    collectIncompleteRecords(prisma, organizationId, { all: true }),
    prisma.assessment.count({ where: { ...org, template: { type: "DPIA" } } }),
    prisma.assessment.count({ where: { ...org, status: "APPROVED", template: { type: "DPIA" } } }),
    loadDpiaAccess(prisma, organizationId),
    prisma.vendorContract.count({ where: { type: "DPA", vendor: org } }),
    // Read, not counted in SQL: an incident logged with no detail holds NULL
    // in its list column, which an "is empty" filter does not match.
    prisma.incident
      .findMany({ where: org, select: { affectedRecords: true, dataCategories: true }, take: 1000 })
      .then((rows) => rows.filter((r) => r.affectedRecords == null && !(r.dataCategories?.length)).length),
    prisma.incidentNotification.count({ where: { incident: org } }),
    prisma.organizationAiSettings.findUnique({ where: { organizationId }, select: { posture: true } }),
    prisma.dSARRequest.count({ where: { ...org, status: "COMPLETED" } }),
  ]);

  const posture = aiSettings?.posture ?? "off";
  return {
    ...counts,
    activitiesIncomplete: incomplete.length,
    dpiaAssessments,
    dpiaApproved,
    dpiaAccess,
    dpaContracts,
    incidentsMissingImpact,
    incidentNotifications,
    aiAssistOn: features.aiAssistEnabled && posture !== "off" && isAIConfigured(postureLane(posture)),
    dsarCompleted,
  };
}
