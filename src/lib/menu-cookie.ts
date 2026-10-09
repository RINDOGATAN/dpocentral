// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The dashboard has one layout, Guided: a left menu that walks the privacy
 * program path. The Classic layout (top-bar menus) was retired on 9 October
 * 2026 (owner's decision d11).
 *
 * - `dpc_menu=collapsed` shrinks the left menu to icons (a per-browser choice).
 * - The old `dpc_skin` cookie is left where a browser holds it and is never
 *   read again.
 * - The old `?skin=` parameter is dropped from dashboard addresses by the
 *   middleware, so a bookmark or a demo link never ends on a wrong page
 *   (`retiredClassicRedirect`). Classic had no pages of its own in DPO
 *   Central: every Classic menu entry is a page Guided also opens.
 *
 * Pure string helpers, safe on the server, the edge and the client.
 */

export const MENU_COOKIE = "dpc_menu";

/** The parameter that used to choose the layout (`?skin=guided|classic`). */
export const RETIRED_SKIN_QUERY = "skin";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** True when the left menu should show icons only. */
export function parseMenuCollapsed(value: string | null | undefined): boolean {
  return value === "collapsed";
}

/** The signed-in dashboard. */
export function isDashboardPath(pathname: string): boolean {
  return pathname === "/privacy" || pathname.startsWith("/privacy/");
}

/**
 * Where a retired Classic address goes now, as a path and query, or null when
 * the address is current. Drops the old `?skin=` parameter from dashboard
 * addresses; everything else in the query is kept.
 */
export function retiredClassicRedirect(pathname: string, search: string): string | null {
  if (!isDashboardPath(pathname)) return null;
  const params = new URLSearchParams(search);
  if (!params.has(RETIRED_SKIN_QUERY)) return null;
  params.delete(RETIRED_SKIN_QUERY);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

/** A `document.cookie` assignment for a choice, host-only, one year, SameSite=Lax. */
export function cookieAssignment(name: string, value: string): string {
  return `${name}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
