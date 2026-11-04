// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rule behind src/lib/use-record-org-switch.ts, kept apart from the hook
 * so it can be tested without a browser: a record page switches the selected
 * organisation only to another organisation that the server located for the
 * record. A record of the selected organisation that still answers "not
 * found" was refused for another reason, and no switch would help.
 */

export type LocatedOrganization = { id: string; name: string; slug: string };

export function shouldSwitchTo(
  located: LocatedOrganization | null | undefined,
  currentOrgId: string | undefined
): boolean {
  return !!located && !!currentOrgId && located.id !== currentOrgId;
}
