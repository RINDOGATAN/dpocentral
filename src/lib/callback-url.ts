// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where sign-in returns the person: the page they were on (the `callbackUrl`
 * the dashboard layout adds when a session has ended), but only a same-origin
 * path inside the app. Anything else (another site, a protocol-relative URL,
 * a path outside /privacy) falls back to the dashboard: an open redirect is
 * never offered.
 */

const FALLBACK = "/privacy";

export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw) return FALLBACK;
  let value = raw.trim();
  // Accept an absolute URL only when it names no other host: keep its path.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return FALLBACK;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return FALLBACK;
  // Drop any fragment; keep the query.
  value = value.split("#")[0];
  if (value !== "/privacy" && !value.startsWith("/privacy/") && !value.startsWith("/privacy?")) return FALLBACK;
  return value;
}
