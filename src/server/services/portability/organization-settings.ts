// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation settings the full JSON export
 * (GET /api/export/organization-data) carries. Everything else in the settings
 * JSON stays out: pending invitations (admin-only data about people not yet
 * members), integration secrets such as a webhook URL, and any key added
 * later until it is listed here.
 */
export const EXPORTED_SETTINGS_KEYS = ["programName", "quickstart", "applicability", "boardReport", "posture", "templateCopy"] as const;

export function exportedSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  const source = settings as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of EXPORTED_SETTINGS_KEYS) if (key in source) out[key] = source[key];
  return out;
}
