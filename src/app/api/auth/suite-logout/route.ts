// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The sign-out walk: signing out here signs the user out of the suite.
 *
 * A host can only expire its own cookies, so a sibling product's host-only
 * session cookie survives anything this host sends. The browser therefore
 * walks: this route sends it to the first sibling's cross-logout endpoint
 * with the address to come back to, that hop clears its own cookies and
 * returns, and the step after the last hop lands on the sign-in page.
 *
 * Every response of the walk, including the first, expires this host's
 * session cookies. A sibling that is down, slow or hostile can therefore
 * delay the landing but can never leave the user signed in here; a deadline
 * travelling in the address ends the walk when a hop takes too long.
 *
 * The rules and the sibling list are in `src/lib/suite-logout.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { parseDeadline, parseStep, suiteLogoutHops, suiteLogoutStep } from "@/lib/suite-logout";
import { expireSessionCookies } from "@/lib/suite-logout-server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const now = Date.now();
  const next = suiteLogoutStep({
    origin: url.origin,
    hops: suiteLogoutHops(url.hostname, process.env),
    step: parseStep(url.searchParams.get("step")),
    deadline: parseDeadline(url.searchParams.get("deadline"), now),
    now,
  });
  return expireSessionCookies(request, NextResponse.redirect(next.url, 303));
}
