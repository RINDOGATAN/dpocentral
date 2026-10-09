// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The parts of "drafts count once confirmed" that the screens need too
 * (the server side is src/server/services/template-items/drafts.ts).
 */

/** Who may confirm a draft: the roles that own the programme's records. */
export const CONFIRM_ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER"] as const;

export function canConfirmDrafts(role: string | null | undefined): boolean {
  return (CONFIRM_ROLES as readonly string[]).includes(role ?? "");
}

/**
 * A record is a draft when a template made it (provenance AUTO_TEMPLATE) and
 * nobody has confirmed it yet (no confirmedAt).
 */
export function isDraftRecord(record: {
  provenance?: string | null;
  confirmedAt?: Date | string | null;
} | null | undefined): boolean {
  return !!record && record.provenance === "AUTO_TEMPLATE" && !record.confirmedAt;
}
