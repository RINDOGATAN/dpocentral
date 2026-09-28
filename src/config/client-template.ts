// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Start from another client": what a privacy team may copy from one client's
 * programme into another's, and what never moves.
 *
 * The rule that governs everything here: COPIED, never linked. Every copied
 * row is a new row in the target organisation with no reference back to the
 * source, so one client's later changes never reach another client's file,
 * and the target never learns which client the template came from.
 *
 * Pure leaf module: no Prisma, no React. The copy itself is in
 * src/server/services/client-template/copy.ts.
 *
 * Ported from AI Sentinel's client-template feature, adapted to DPO Central's
 * models: data inventory (assets and their elements), processing activities,
 * vendors, the organisation's own assessment templates, the DSAR intake form
 * settings, and the jurisdictions the organisation operates under.
 */

/** The parts a person can tick, in the order the dialog shows them. */
export const COPY_PARTS = [
  "jurisdictions",
  "dataAssets",
  "processingActivities",
  "vendors",
  "assessmentTemplates",
  "dsarIntake",
] as const;

export type CopyPart = (typeof COPY_PARTS)[number];

/**
 * A part that only makes sense with another. DPO Central's parts stand on
 * their own — a processing activity is relinked to a copied asset by name only
 * when both are chosen, but neither requires the other — so this map is empty.
 * Kept for parity with the shared structure and the dialog's blocking logic.
 */
export const PART_REQUIRES: Partial<Record<CopyPart, CopyPart>> = {};

/**
 * Ticked when the dialog opens: the records and vendors that make up the bulk
 * of a programme. Jurisdictions (they only fill a client that has declared
 * none) and the DSAR intake form (client-specific wording) start unticked.
 */
export const DEFAULT_PARTS: readonly CopyPart[] = [
  "dataAssets",
  "processingActivities",
  "vendors",
  "assessmentTemplates",
];

/** Drop any part whose prerequisite is not also chosen. */
export function effectiveParts(parts: readonly CopyPart[]): CopyPart[] {
  const chosen = new Set(parts);
  return COPY_PARTS.filter((p) => {
    if (!chosen.has(p)) return false;
    const needs = PART_REQUIRES[p];
    return !needs || chosen.has(needs);
  });
}

/**
 * Records that are never copied, whatever is ticked: they are the client's own
 * history, people, requests, evidence, commercial terms or licences. Named by
 * Prisma delegate so a test can prove the copy never writes to any of them.
 */
export const NEVER_COPY = [
  // Rights requests and their whole trail
  "dSARRequest",
  "dSARTask",
  "dSARCommunication",
  "dSARAuditLog",
  // Incidents and their whole trail
  "incident",
  "incidentNotification",
  "incidentTimelineEntry",
  "incidentTask",
  "incidentAffectedAsset",
  "incidentDocument",
  // Assessment instances and their evidence (templates ARE copied; instances are not)
  "assessment",
  "assessmentResponse",
  "assessmentMitigation",
  "assessmentApproval",
  "assessmentVersion",
  // Vendor history and commercial terms (the vendor row itself IS copied)
  "vendorContract",
  "vendorReview",
  "vendorQuestionnaireResponse",
  // Data flows and cross-border transfers are the client's own map
  "dataFlow",
  "dataTransfer",
  // AI systems are read-only in DPO Central and client-specific: never copied
  "aISystem",
  // The audit trail: the target gets one new entry of its own; nothing is copied
  "auditLog",
  // People, licences and billing
  "organizationMember",
  "user",
  "customer",
  "customerOrganization",
  "skillEntitlement",
  "skillActivation",
  "skillPackage",
  // Snapshots, notifications, expert engagements, generations, feedback
  "complianceSnapshot",
  "notification",
  "notificationPreference",
  "expertEngagement",
  "aiGeneration",
  "feedback",
] as const;

/** Only an owner or an admin may use an organisation as a source or a target. */
export const TEMPLATE_ROLES = ["OWNER", "ADMIN"] as const;

export function canUseForTemplate(role: string | null | undefined): boolean {
  return (TEMPLATE_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * Key under `metadata` marking a copy nobody has reviewed yet. Editing the
 * record clears it. While it is there the record reads as a draft brought in
 * from a template, not a reviewed record of this client.
 */
export const TEMPLATE_COPY_KEY = "templateCopy";

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

/** Metadata with the pending mark added. */
export function withTemplateCopyMark(metadata: unknown, copiedAt: Date): Json {
  return {
    ...asObject(metadata),
    [TEMPLATE_COPY_KEY]: { pending: true, copiedAt: copiedAt.toISOString() },
  };
}

export function hasTemplateCopyMark(metadata: unknown): boolean {
  return asObject(asObject(metadata)[TEMPLATE_COPY_KEY]).pending === true;
}

/** Metadata with the pending mark removed, or null when nothing needs to change. */
export function withoutTemplateCopyMark(metadata: unknown): Json | null {
  if (!hasTemplateCopyMark(metadata)) return null;
  const rest = { ...asObject(metadata) };
  delete rest[TEMPLATE_COPY_KEY];
  return rest;
}

/** The Prisma filter for "copied from a template, not yet reviewed". */
export const TEMPLATE_COPY_PENDING_WHERE = {
  metadata: { path: [TEMPLATE_COPY_KEY, "pending"], equals: true },
};

/**
 * The target's audit entry. Dated, and naming nothing about the source: no
 * name, no id, no slug.
 */
export function templateAuditNote(date: Date): string {
  return `Created from a template on ${date.toISOString().slice(0, 10)}`;
}
