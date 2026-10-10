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
 * The provenances that make a record a draft until a person confirms it: a
 * template made it (AUTO_TEMPLATE), or an import brought it in (IMPORTED,
 * src/server/services/portability).
 */
export const DRAFT_PROVENANCES = ["AUTO_TEMPLATE", "IMPORTED"] as const;

/**
 * A record is a draft when a template made it or an import brought it in, and
 * nobody has confirmed it yet (no confirmedAt).
 */
export function isDraftRecord(record: {
  provenance?: string | null;
  confirmedAt?: Date | string | null;
} | null | undefined): boolean {
  return (
    !!record &&
    (DRAFT_PROVENANCES as readonly string[]).includes(record.provenance ?? "") &&
    !record.confirmedAt
  );
}
