// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Auto-Assessment Creation Service (Feature 5)
 *
 * Creates draft assessments automatically when high-risk vendors are imported
 * or when processing activities warrant it. Reused by Features 3, 5, and 7.
 */

import type { Prisma } from "@prisma/client";
import { AssessmentStatus, AssessmentType } from "@prisma/client";
import {
  checkAssessmentEntitlement,
  isDpiaPilotTier,
  isPremiumAssessmentType,
} from "../services/licensing/entitlement";
import { countDpiaCreated, PILOT_DPIA_LIMIT } from "./pilot/caps";
import { recordName, legacyRecordName } from "@/lib/record-name";

interface AutoCreateParams {
  tx: Prisma.TransactionClient;
  organizationId: string;
  userId: string;
  processingActivityId?: string;
  vendorId?: string;
  vendorName?: string;
  assessmentType: AssessmentType;
  reason: string;
  /** Language of the draft's name and description; English when absent. */
  locale?: "en" | "es";
}

/** The draft's name before the vendor, in the given language. */
function autoAssessmentTypeName(type: AssessmentType, locale: "en" | "es"): string {
  if (locale === "es") {
    if (type === "LIA") return "Evaluación del interés legítimo";
    if (type === "DPIA") return "Evaluación de Impacto relativa a la Protección de Datos (EIPD)";
    return `Evaluación ${type}`;
  }
  if (type === "LIA") return "Legitimate Interests Assessment";
  if (type === "DPIA") return "Data Protection Impact Assessment";
  return `${type} Assessment`;
}

/** Why a required DPIA was not created (AutoCreateResult.skippedReason). */
export const DPIA_NOT_CREATED = {
  quota: "DPIA_REQUIRED_QUOTA_USED",
  licence: "DPIA_REQUIRED_NO_LICENCE",
} as const;

interface AutoCreateResult {
  created: boolean;
  assessmentId?: string;
  assessmentName?: string;
  skippedReason?: string;
}

/**
 * Create a draft assessment linked to a processing activity and/or vendor.
 * Checks entitlements for premium types; skips silently if not entitled.
 */
export async function createAssessmentFromActivity(
  params: AutoCreateParams
): Promise<AutoCreateResult> {
  const {
    tx,
    organizationId,
    userId,
    processingActivityId,
    vendorId,
    vendorName,
    assessmentType,
    reason,
    locale = "en",
  } = params;

  // The DPIA needs no licence on the pilot tier, but it counts against the
  // two free ones there. With none left, or without a licence, no DPIA is
  // created, and nothing else is created in its place: a legitimate-interest
  // assessment is not a substitute for a required DPIA (GDPR Art. 35). The
  // caller is told why, so it can say "DPIA required, not created".
  if (assessmentType === "DPIA" && (await isDpiaPilotTier(organizationId))) {
    const used = await countDpiaCreated(tx, organizationId);
    if (used >= PILOT_DPIA_LIMIT) {
      return { created: false, skippedReason: DPIA_NOT_CREATED.quota };
    }
  } else if (isPremiumAssessmentType(assessmentType)) {
    const entitlement = await checkAssessmentEntitlement(
      organizationId,
      assessmentType
    );
    if (!entitlement.entitled) {
      return {
        created: false,
        skippedReason: assessmentType === "DPIA" ? DPIA_NOT_CREATED.licence : `No ${assessmentType} entitlement`,
      };
    }
  }

  // Find the system template for this assessment type
  const template = await tx.assessmentTemplate.findFirst({
    where: {
      type: assessmentType,
      isActive: true,
      // Never auto-create against a template retired by a newer version.
      supersededAt: null,
      OR: [
        { isSystem: true },
        { organizationId },
      ],
    },
    orderBy: { isSystem: "desc" },
  });

  if (!template) {
    return {
      created: false,
      skippedReason: `No ${assessmentType} template available`,
    };
  }

  // Build assessment name
  const typeName = autoAssessmentTypeName(assessmentType, locale);
  const name = vendorName ? recordName(typeName, vendorName) : typeName;
  // A draft created before 11 Oct 2026 carries the older name; one created in
  // the other language counts as the same draft.
  const otherTypeName = autoAssessmentTypeName(assessmentType, locale === "es" ? "en" : "es");
  const names = vendorName
    ? [name, legacyRecordName(typeName, vendorName), recordName(otherTypeName, vendorName), legacyRecordName(otherTypeName, vendorName)]
    : [name, otherTypeName];

  // Check for duplicate
  const existing = await tx.assessment.findFirst({
    where: {
      organizationId,
      name: { in: names },
      status: { in: [AssessmentStatus.DRAFT, AssessmentStatus.IN_PROGRESS] },
    },
  });

  if (existing) {
    return {
      created: false,
      skippedReason: "Draft assessment already exists",
      assessmentId: existing.id,
    };
  }

  // Create the draft assessment
  const assessment = await tx.assessment.create({
    data: {
      organizationId,
      templateId: template.id,
      name,
      description: reason,
      processingActivityId,
      vendorId,
      status: AssessmentStatus.DRAFT,
      metadata: {
        autoGenerated: true,
        awaitingReview: true,
        reason,
      },
    },
  });

  // Audit log
  await tx.auditLog.create({
    data: {
      organizationId,
      userId,
      entityType: "Assessment",
      entityId: assessment.id,
      action: "AUTO_CREATE",
      changes: {
        type: assessmentType,
        // Read by the pilot tier's DPIA count (services/pilot/caps.ts).
        templateType: assessmentType,
        vendorId,
        processingActivityId,
        reason,
      },
      metadata: { source: "auto-assessment" },
    },
  });

  return {
    created: true,
    assessmentId: assessment.id,
    assessmentName: name,
  };
}
