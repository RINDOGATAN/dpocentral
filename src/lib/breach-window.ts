// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The 72-hour clock on a breach, read from what the incident already holds.
 *
 * An incident is created with `notificationRequired` set by a rule (severity,
 * special categories, records affected) and false otherwise. False is also the
 * default for an incident logged with no detail, so it does not mean that
 * anyone decided not to notify. Until a notification is recorded, a person has
 * to decide, inside the window counted from discovery. These helpers say when
 * that window ends and whether an incident is still waiting for the decision.
 *
 * Pure: shared by "Needs action" (server/services/views/queries.ts) and the
 * incident page header, so the two read the same clock.
 */

export const BREACH_WINDOW_HOURS = 72;

const HOUR_MS = 60 * 60 * 1000;

const CLOSED_STATUSES = ["CLOSED", "FALSE_POSITIVE"];

/**
 * When the window ends: the incident's own notification deadline when one was
 * set (from its jurisdiction), otherwise 72 hours after discovery.
 */
export function breachWindowEnd(incident: {
  discoveredAt: Date | string;
  notificationDeadline?: Date | string | null;
}): Date {
  if (incident.notificationDeadline) return new Date(incident.notificationDeadline);
  return new Date(new Date(incident.discoveredAt).getTime() + BREACH_WINDOW_HOURS * HOUR_MS);
}

/** The earliest discovery time still inside a 72-hour window at `now`. */
export function breachWindowOpenSince(now: Date): Date {
  return new Date(now.getTime() - BREACH_WINDOW_HOURS * HOUR_MS);
}

/**
 * Whether the incident still waits for a decision on notifying: open, not
 * already marked as requiring notification (that case is "Breaches to
 * notify"), no notification recorded, and inside its window.
 */
export function awaitsNotificationDecision(
  incident: {
    status: string;
    notificationRequired: boolean;
    discoveredAt: Date | string;
    notificationDeadline?: Date | string | null;
    notifications?: readonly unknown[] | null;
  },
  now: Date,
): boolean {
  if (CLOSED_STATUSES.includes(incident.status)) return false;
  if (incident.notificationRequired) return false;
  if (incident.notifications && incident.notifications.length > 0) return false;
  return breachWindowEnd(incident).getTime() > now.getTime();
}

/**
 * The answer to "notify the authority?" as the breach register and the
 * incident page show it. `notificationRequired` is false by default, so a
 * false flag on its own is not an answer: a new incident that the rule does
 * not flag reads "not yet assessed" until a notification record is made on it
 * (sent, drafted or marked NOT_REQUIRED by a person). Derived from what the
 * incident already holds, so existing incidents read the same way.
 *
 *   REQUIRED      the flag is set (the rule, or the facts as updated);
 *   NOT_REQUIRED  not flagged, and a notification record exists;
 *   NOT_ASSESSED  not flagged, and no notification recorded.
 */
export type AuthorityNotificationAssessment = "REQUIRED" | "NOT_REQUIRED" | "NOT_ASSESSED";

export function authorityNotificationAssessment(incident: {
  notificationRequired: boolean;
  notifications?: readonly unknown[] | null;
}): AuthorityNotificationAssessment {
  if (incident.notificationRequired) return "REQUIRED";
  if (incident.notifications && incident.notifications.length > 0) return "NOT_REQUIRED";
  return "NOT_ASSESSED";
}
