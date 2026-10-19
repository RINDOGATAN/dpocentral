// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Whether an incident is flagged for notification to the supervisory
 * authority, and by when (GDPR Art. 33: without undue delay and, where
 * feasible, within 72 hours of becoming aware). Pure, so `create` and
 * `update` in the incident router apply the same rule and the same clock:
 * the flag and the deadline follow the facts they depend on (severity, data
 * categories, records affected, discovery time, jurisdiction) every time
 * those facts change, not only when the incident is first logged.
 *
 * The rule itself is unchanged: HIGH or CRITICAL severity, any special
 * category of data, or 500 records or more.
 */

import { addHours } from "date-fns";

export const SPECIAL_CATEGORIES = [
  "HEALTH",
  "BIOMETRIC",
  "GENETIC",
  "POLITICAL",
  "RELIGIOUS",
  "SEXUAL_ORIENTATION",
  "CRIMINAL",
] as const;

/** The incident fields the flag and the deadline depend on. */
export const NOTIFICATION_FACT_FIELDS = [
  "severity",
  "dataCategories",
  "affectedRecords",
  "discoveredAt",
  "jurisdictionId",
] as const;

export type NotificationFacts = {
  severity: string;
  dataCategories: readonly string[];
  affectedRecords?: number | null;
};

export function notificationRequiredFor(facts: NotificationFacts): boolean {
  const hasSpecialCategory = facts.dataCategories.some((c) =>
    (SPECIAL_CATEGORIES as readonly string[]).includes(c),
  );
  return (
    facts.severity === "HIGH" ||
    facts.severity === "CRITICAL" ||
    hasSpecialCategory ||
    (facts.affectedRecords !== undefined && facts.affectedRecords !== null && facts.affectedRecords >= 500)
  );
}

export function notificationDeadlineFor(discoveredAt: Date, breachNotificationHours: number): Date {
  return addHours(discoveredAt, breachNotificationHours);
}

/** True when an update touches any field the flag or the deadline depends on. */
export function touchesNotificationFacts(data: Record<string, unknown>): boolean {
  return NOTIFICATION_FACT_FIELDS.some((k) => data[k] !== undefined);
}

export type IncidentNotificationState = NotificationFacts & {
  discoveredAt: Date;
  jurisdictionId: string | null;
  notificationRequired: boolean;
  notificationDeadline: Date | null;
};

/**
 * The incident's facts after an update: the stored row with every field the
 * update sends laid over it (undefined = not sent; null = cleared).
 */
export function mergeNotificationFacts(
  stored: IncidentNotificationState,
  update: Partial<Record<(typeof NOTIFICATION_FACT_FIELDS)[number], unknown>>,
): Omit<IncidentNotificationState, "notificationRequired" | "notificationDeadline"> {
  return {
    severity: (update.severity as string | undefined) ?? stored.severity,
    dataCategories: (update.dataCategories as string[] | undefined) ?? stored.dataCategories,
    affectedRecords:
      update.affectedRecords === undefined ? stored.affectedRecords : (update.affectedRecords as number | null),
    discoveredAt: (update.discoveredAt as Date | undefined) ?? stored.discoveredAt,
    jurisdictionId:
      update.jurisdictionId === undefined ? stored.jurisdictionId : (update.jurisdictionId as string | null),
  };
}

/**
 * The flag and the incident-level deadline for the merged facts. The deadline
 * is set, as at creation, only when notification is required and the
 * incident names a jurisdiction (its breach-notification hours); otherwise it
 * is cleared and the 72-hour window from discovery applies
 * (src/lib/breach-window.ts).
 */
export function recomputeNotification(
  facts: Omit<IncidentNotificationState, "notificationRequired" | "notificationDeadline">,
  jurisdictionHours: number | null,
): { notificationRequired: boolean; notificationDeadline: Date | null } {
  const notificationRequired = notificationRequiredFor(facts);
  const notificationDeadline =
    notificationRequired && facts.jurisdictionId && jurisdictionHours !== null
      ? notificationDeadlineFor(facts.discoveredAt, jurisdictionHours)
      : null;
  return { notificationRequired, notificationDeadline };
}

/** System timeline titles for a change of the flag (stored in English, see src/lib/incident-timeline.ts). */
export const TIMELINE_NOW_REQUIRED = "Notification to the authority now marked as required";
export const TIMELINE_NO_LONGER_REQUIRED = "Notification to the authority no longer marked as required";
export const TIMELINE_DEADLINE_RECALCULATED = "Notification deadline recalculated";
