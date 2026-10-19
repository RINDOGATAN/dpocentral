// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Review due": an approved assessment whose processing activity has changed
 * since the approval in a way that matters (GDPR Art. 35(11): review at least
 * when there is a change of the risk). At approval the activity's relevant
 * facts are kept with the approved version (`activity` in its snapshot);
 * comparing them with the activity as it is now gives the reasons.
 *
 * An assessment approved before that baseline was kept has none to compare
 * against: it is due when the activity, its systems or its transfers have
 * been changed after the approval date.
 *
 * Read-only: nothing here writes. The assessment page shows the reasons, and
 * `reviewDueAssessments` lists every approved assessment of an organisation
 * that is due, for the overview's items needing action.
 */

import type { Db } from "@/lib/prisma";

/** Categories GDPR Art. 9 and 10 treat as special (special category or criminal data). */
export const SPECIAL_CATEGORIES = new Set([
  "HEALTH",
  "BIOMETRIC",
  "GENETIC",
  "POLITICAL",
  "RELIGIOUS",
  "SEXUAL_ORIENTATION",
  "CRIMINAL",
]);

export interface ActivityFingerprint {
  purpose: string;
  legalBasis: string;
  /** Special categories: from the activity's categories and its data elements. */
  special: string[];
  recipients: string[];
  systems: string[];
  transfers: string[];
  automatedDecisionMaking: boolean;
}

export type ReviewReason =
  | "SPECIAL_CATEGORY"
  | "RECIPIENT"
  | "SYSTEM"
  | "TRANSFER"
  | "PURPOSE"
  | "LEGAL_BASIS"
  | "AUTOMATED_DECISION"
  | "ACTIVITY_CHANGED";

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

export interface FingerprintSource {
  purpose: string;
  legalBasis: string;
  categories: string[];
  recipients: string[];
  automatedDecisionMaking: boolean;
  assets: Array<{ dataAssetId: string; linkedElements: Array<{ dataElement: { name: string; isSpecialCategory: boolean } }> }>;
  transfers: Array<{ id: string; destinationCountry: string }>;
}

export function activityFingerprint(a: FingerprintSource): ActivityFingerprint {
  return {
    purpose: a.purpose.trim(),
    legalBasis: a.legalBasis,
    special: sorted([
      ...a.categories.filter((c) => SPECIAL_CATEGORIES.has(c)),
      ...a.assets.flatMap((x) =>
        x.linkedElements.filter((l) => l.dataElement.isSpecialCategory).map((l) => `element:${l.dataElement.name}`)
      ),
    ]),
    recipients: sorted(a.recipients.map((r) => r.trim()).filter(Boolean)),
    systems: sorted(a.assets.map((x) => x.dataAssetId)),
    transfers: sorted(a.transfers.map((t) => `${t.id}:${t.destinationCountry}`)),
    automatedDecisionMaking: a.automatedDecisionMaking,
  };
}

const added = (before: string[], now: string[]) => now.some((x) => !before.includes(x));

/** Why the activity, as it is now, calls for a review of what was approved. */
export function reviewReasons(baseline: ActivityFingerprint, current: ActivityFingerprint): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (added(baseline.special, current.special)) reasons.push("SPECIAL_CATEGORY");
  if (added(baseline.recipients, current.recipients)) reasons.push("RECIPIENT");
  if (added(baseline.systems, current.systems)) reasons.push("SYSTEM");
  if (added(baseline.transfers, current.transfers)) reasons.push("TRANSFER");
  if (baseline.purpose !== current.purpose) reasons.push("PURPOSE");
  if (baseline.legalBasis !== current.legalBasis) reasons.push("LEGAL_BASIS");
  if (!baseline.automatedDecisionMaking && current.automatedDecisionMaking) reasons.push("AUTOMATED_DECISION");
  return reasons;
}

export const FINGERPRINT_INCLUDE = {
  assets: {
    select: {
      dataAssetId: true,
      linkedElements: { select: { dataElement: { select: { name: true, isSpecialCategory: true } } } },
    },
  },
  transfers: { select: { id: true, destinationCountry: true, createdAt: true, updatedAt: true } },
} as const;

/** The fingerprint of an activity as it is now, or null when it no longer exists. */
export async function loadActivityFingerprint(prisma: Db, activityId: string): Promise<ActivityFingerprint | null> {
  const activity = await prisma.processingActivity.findFirst({
    where: { id: activityId },
    include: FINGERPRINT_INCLUDE,
  });
  return activity ? activityFingerprint(activity) : null;
}

function isFingerprint(v: unknown): v is ActivityFingerprint {
  return !!v && typeof v === "object" && Array.isArray((v as ActivityFingerprint).special);
}

export interface ReviewDue {
  assessmentId: string;
  name: string;
  approvedAt: Date | null;
  reasons: ReviewReason[];
}

/**
 * Every approved assessment of the organisation whose activity has changed in
 * a way that matters since the approval, or only `assessmentId` when given.
 */
export async function reviewDueAssessments(
  prisma: Db,
  organizationId: string,
  assessmentId?: string
): Promise<ReviewDue[]> {
  const approved = await prisma.assessment.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      processingActivityId: { not: null },
      ...(assessmentId ? { id: assessmentId } : {}),
    },
    select: {
      id: true,
      name: true,
      completedAt: true,
      updatedAt: true,
      approvedVersion: true,
      versions: { select: { version: true, snapshot: true }, orderBy: { version: "desc" }, take: 10 },
      processingActivity: { include: FINGERPRINT_INCLUDE },
    },
  });

  const due: ReviewDue[] = [];
  for (const a of approved) {
    const activity = a.processingActivity;
    if (!activity) continue;
    const approvedAt = a.completedAt ?? a.updatedAt;
    const snapshot = a.versions.find((v) => v.version === a.approvedVersion)?.snapshot as
      | { activity?: unknown }
      | undefined;
    let reasons: ReviewReason[];
    if (isFingerprint(snapshot?.activity)) {
      reasons = reviewReasons(snapshot.activity, activityFingerprint(activity));
    } else {
      // No baseline kept: any change to the activity or its transfers after
      // the approval date calls for a review.
      const changedAfter = (d: Date) => d.getTime() > approvedAt.getTime();
      reasons =
        changedAfter(activity.updatedAt) ||
        activity.transfers.some((t) => changedAfter(t.createdAt) || changedAfter(t.updatedAt))
          ? ["ACTIVITY_CHANGED"]
          : [];
    }
    if (reasons.length > 0) due.push({ assessmentId: a.id, name: a.name, approvedAt: a.completedAt, reasons });
  }
  return due;
}
