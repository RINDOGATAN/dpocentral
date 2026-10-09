// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Addresses that exist only with the rights-request module: the public request
 * form (/dsar/<slug>), the public status page (/dsar/status/<token>) and the
 * module's PDF report. src/middleware.ts answers them 404 when the module is
 * not part of this plan (NEXT_PUBLIC_DSAR_ENABLED=false, src/config/features.ts).
 *
 * The dashboard pages under /privacy/dsar are not here: they show a short
 * note instead (src/app/(dashboard)/privacy/dsar/layout.tsx).
 */
export function isDsarModulePath(pathname: string): boolean {
  return (
    pathname === "/dsar" ||
    pathname.startsWith("/dsar/") ||
    pathname === "/api/export/dsar-performance"
  );
}
