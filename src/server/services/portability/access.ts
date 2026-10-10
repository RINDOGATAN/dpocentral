// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Who may take the whole programme out, or bring one in: the owners and
 * admins of the organisation. The export carries every register (and, when
 * asked, personal data of the people who made rights requests); the import
 * adds records in bulk. Pure.
 */

export const PORTABILITY_ROLES = ["OWNER", "ADMIN"] as const;

export function canExportProgramme(role: string | null | undefined): boolean {
  return !!role && (PORTABILITY_ROLES as readonly string[]).includes(role);
}

export const canImportProgramme = canExportProgramme;
