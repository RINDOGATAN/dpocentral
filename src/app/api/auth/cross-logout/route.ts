// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cross-logout: expire every session cookie this host can reach.
 *
 * POST is what this app's own sign-out control calls. GET is the hop a
 * sibling product sends the browser to during the suite walk, which clears
 * this host's cookies and returns to the address it was given.
 *
 * The names, and why each one is expired twice (host-only and on the parent
 * domain), are in `src/lib/suite-logout.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { SIGNED_OUT_PATH, safeReturnTo, suiteLogoutHops } from "@/lib/suite-logout";
import { expireSessionCookies } from "@/lib/suite-logout-server";

export async function POST(request: NextRequest) {
  return expireSessionCookies(request, NextResponse.json({ ok: true }));
}

/**
 * The address to return to is checked against the hosts we would walk
 * ourselves, so this cannot be made into an open redirect. An address we do
 * not accept lands on our own sign-in page rather than failing, because a
 * sign-out must never end in an error.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hops = suiteLogoutHops(url.hostname, process.env);
  const allowedHosts = hops.map((hop) => new URL(hop).hostname);
  const next =
    safeReturnTo(url.searchParams.get("next"), url.origin, allowedHosts) ??
    new URL(SIGNED_OUT_PATH, url.origin).toString();
  return expireSessionCookies(request, NextResponse.redirect(next, 303));
}
