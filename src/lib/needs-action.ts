// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// "Needs action": everything waiting for a person, gathered into one short list.
// A privacy lead should not have to open five modules to learn there is nothing
// to do, or miss the one thing there is. The categories are the ones the stage-4
// directive named: reviews due, rights requests due, breaches inside the
// 72-hour window, and assessments waiting to be approved; plus breaches logged
// inside their 72-hour window with no decision on notifying yet.
//
// This module is pure: it turns a set of counts into an ordered list of items,
// dropping the empty ones so the list only ever shows real work. The counts are
// gathered, org- and department-scoped, by the server
// (src/server/services/views/queries.ts).

export const NEEDS_ACTION_KINDS = [
  "review-due",
  "dsar-due",
  "breach-window",
  "breach-decision",
  "assessment-approval",
] as const;

export type NeedsActionKind = (typeof NEEDS_ACTION_KINDS)[number];

/// The link each category points at.
const HREF: Record<NeedsActionKind, string> = {
  "review-due": "/privacy/data-inventory",
  "dsar-due": "/privacy/dsar",
  "breach-window": "/privacy/incidents",
  "breach-decision": "/privacy/incidents",
  "assessment-approval": "/privacy/assessments",
};

export interface NeedsActionCounts {
  /// Processing records and systems whose review is due (nextReviewAt in the
  /// past). This is the one department-scoped category, as records and systems
  /// are the only things that carry a department.
  reviewDue: number;
  /// Rights requests (DSARs) still open with their statutory deadline near or
  /// past. Null when the view is scoped to a department (a DSAR has no
  /// department, so an org-wide number under a department name would mislead).
  dsarDue: number | null;
  /// Breaches inside the 72-hour notification window: open incidents that must
  /// be notified and whose deadline has not passed. Null when department-scoped.
  breachWindow: number | null;
  /// Open incidents discovered inside the 72-hour window that are not marked
  /// as requiring notification and have no notification recorded: nobody has
  /// decided yet whether to notify (src/lib/breach-window.ts). Optional, so a
  /// caller that does not gather it shows nothing for it. Null when
  /// department-scoped.
  breachDecision?: number | null;
  /// Assessments sent for approval (PENDING_APPROVAL or PENDING_REVIEW). Null
  /// when department-scoped.
  assessmentApproval: number | null;
}

export interface NeedsActionItem {
  kind: NeedsActionKind;
  count: number;
  href: string;
}

/// The categories with work waiting, in a fixed order, empty ones dropped.
export function buildNeedsAction(counts: NeedsActionCounts): NeedsActionItem[] {
  const items: NeedsActionItem[] = [];
  const push = (kind: NeedsActionKind, count: number | null) => {
    if (count != null && count > 0) items.push({ kind, count, href: HREF[kind] });
  };
  push("review-due", counts.reviewDue);
  push("dsar-due", counts.dsarDue);
  push("breach-window", counts.breachWindow);
  push("breach-decision", counts.breachDecision ?? null);
  push("assessment-approval", counts.assessmentApproval);
  return items;
}

/// Total number of things waiting across every category shown.
export function needsActionTotal(items: NeedsActionItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}
