// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Timeline entries the incident router writes by itself ("Incident Reported",
 * "Status changed to CLOSED", "DPA notification sent", ...) are stored in
 * English. These helpers recognise them so the incident page can show them
 * in the viewer's language. Entries typed by a person are not matched and are
 * shown as stored.
 */

export type SystemTimelineTitle =
  | { kind: "reported" }
  | { kind: "statusChanged"; status: string }
  | { kind: "notificationCreated"; recipient: string; jurisdiction: string }
  | { kind: "notificationStatus"; recipient: string; status: string }
  | { kind: "markedInError" }
  | { kind: "unmarkedInError" }
  | { kind: "notificationNowRequired" }
  | { kind: "notificationNoLongerRequired" }
  | { kind: "notificationDeadlineRecalculated" };

const RECIPIENT = "([A-Z][A-Z_]*)";

export function parseSystemTimelineTitle(title: string): SystemTimelineTitle | null {
  if (title === "Incident Reported") return { kind: "reported" };
  if (title === "Marked as recorded in error") return { kind: "markedInError" };
  if (title === "No longer marked as recorded in error") return { kind: "unmarkedInError" };
  // Written by incident.update when the facts behind the Art. 33 flag change
  // (src/server/services/incidents/notification-assessment.ts).
  if (title === "Notification to the authority now marked as required") return { kind: "notificationNowRequired" };
  if (title === "Notification to the authority no longer marked as required")
    return { kind: "notificationNoLongerRequired" };
  if (title === "Notification deadline recalculated") return { kind: "notificationDeadlineRecalculated" };
  let m = /^Status changed to ([A-Z][A-Z_]*)$/.exec(title);
  if (m) return { kind: "statusChanged", status: m[1]! };
  m = new RegExp(`^${RECIPIENT} notification created \\(([\\s\\S]+)\\)$`).exec(title);
  if (m) return { kind: "notificationCreated", recipient: m[1]!, jurisdiction: m[2]! };
  m = new RegExp(`^${RECIPIENT} notification ([a-z_]+)$`).exec(title);
  if (m) return { kind: "notificationStatus", recipient: m[1]!, status: m[2]!.toUpperCase() };
  return null;
}

/** The incident title inside the router's "Incident "{title}" was reported" description. */
export function parseReportedDescription(description: string): string | null {
  const m = /^Incident "([\s\S]*)" was reported$/.exec(description);
  return m ? m[1]! : null;
}
