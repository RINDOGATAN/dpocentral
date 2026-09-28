// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The dashboard layout a person has chosen: "guided" (a left menu that walks
 * the privacy program path, the layout for everyone) or "classic" (the top-bar
 * menus, kept for a while and to be retired). A per-browser choice held in a
 * cookie: no schema change, and a person who never touches it sees Guided.
 *
 * - `dpc_skin=classic` keeps Classic; anything else, or no cookie, is Guided.
 * - `dpc_menu=collapsed` shrinks the Guided left menu to icons.
 * - `?skin=guided` or `?skin=classic` on any /privacy URL sets the cookie
 *   (for demos); the middleware answers with a redirect to the same address
 *   without the parameter, so the page renders once, already in the new skin.
 *
 * Pure string helpers, safe on the server, the edge and the client.
 */

export const SKIN_COOKIE = "dpc_skin";
export const MENU_COOKIE = "dpc_menu";
export const SKIN_QUERY = "skin";

export type Skin = "classic" | "guided";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Anything but the exact value `classic` is Guided. */
export function parseSkin(value: string | null | undefined): Skin {
  return value === "classic" ? "classic" : "guided";
}

/** The skin asked for in a `?skin=` parameter, or null when there is none or it is unknown. */
export function skinFromQuery(value: string | null | undefined): Skin | null {
  return value === "guided" || value === "classic" ? value : null;
}

/** True when the Guided left menu should show icons only. */
export function parseMenuCollapsed(value: string | null | undefined): boolean {
  return value === "collapsed";
}

/** The pages where `?skin=` is honoured: the signed-in dashboard. */
export function isDashboardPath(pathname: string): boolean {
  return pathname === "/privacy" || pathname.startsWith("/privacy/");
}

/** A `document.cookie` assignment for a choice, host-only, one year, SameSite=Lax. */
export function cookieAssignment(name: string, value: string): string {
  return `${name}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Options for `response.cookies.set` that match `cookieAssignment`. */
export const SKIN_COOKIE_OPTIONS = {
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
  sameSite: "lax" as const,
};
