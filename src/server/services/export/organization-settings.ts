// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation settings that may leave in the full organisation export
 * (GET /api/export/organization-data). An allow-list, so a key added later
 * stays behind until someone decides it belongs in the file. Left out on
 * purpose: the pending invitations (addresses of people who have not joined,
 * readable in the app by admins only), the Slack webhook URL (a credential),
 * the signup region and any plan or billing state. Pure.
 */

export const EXPORTABLE_SETTINGS_KEYS = ["applicability", "quickstart", "boardReport", "templateCopy"] as const;

export function exportableOrganizationSettings(settings: unknown): Record<string, unknown> | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const source = settings as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of EXPORTABLE_SETTINGS_KEYS) {
    if (key in source) out[key] = source[key];
  }
  return out;
}
