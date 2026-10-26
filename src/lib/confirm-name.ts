// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The typed confirmation before deleting an organisation: its exact name,
 * ignoring outer spaces. Shared by the dialogs and the server
 * (src/server/routers/privacy/organizationDeletion.ts).
 */
export function confirmsName(typed: string, name: string): boolean {
  return typed.trim() === name.trim() && name.trim().length > 0;
}
