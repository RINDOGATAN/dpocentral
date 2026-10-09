// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Who may read the contents of rights requests (DSARs).
 *
 * A request holds a data subject's personal data: name, address, what they
 * asked for, the messages exchanged and the data gathered for the reply. Only
 * the roles that handle requests read them:
 *
 *   OWNER, ADMIN, PRIVACY_OFFICER  every request of the organisation
 *   MEMBER, VIEWER                 only a request on which they are the
 *                                  assignee of at least one task
 *
 * Every member keeps the aggregate figures (counts by status, overdue, average
 * time to close), which carry no personal data.
 *
 * Pure: imported by the server (src/server/services/dsar/access.ts) and by the
 * menus and pages, which hide what the server would refuse.
 */

export const DSAR_HANDLER_ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER"] as const;

export type DsarHandlerRole = (typeof DSAR_HANDLER_ROLES)[number];

/** The role reads every request of the organisation. Unknown or missing role: no. */
export function canHandleDsars(role: string | null | undefined): boolean {
  return !!role && (DSAR_HANDLER_ROLES as readonly string[]).includes(role);
}
