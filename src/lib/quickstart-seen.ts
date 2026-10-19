// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The browser cookie that remembers the quick start was shown, so the
 * dashboard's first-visit redirect (an empty organisation goes to the quick
 * start) fires once instead of on every visit. One cookie per organisation:
 * a consultant's second client must still be taken to its own quick start.
 */

const PREFIX = "dpo_quickstart_seen_";

/** Cookie names allow letters, digits and a few signs; organisation ids are cuids. */
function cookieName(organizationId: string): string {
  return PREFIX + organizationId.replace(/[^A-Za-z0-9_-]/g, "");
}

export function quickstartSeenCookie(organizationId: string): string {
  return `${cookieName(organizationId)}=1; path=/; max-age=31536000; samesite=lax`;
}

export function hasSeenQuickstart(cookie: string, organizationId: string): boolean {
  return cookie.split("; ").includes(`${cookieName(organizationId)}=1`);
}
