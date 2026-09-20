// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cross-logout: expire every session cookie this host can reach.
 *
 * The names, and why each one is expired twice (host-only and on the parent
 * domain), are in `src/lib/suite-logout.ts`. The headers are appended rather
 * than set through `response.cookies`, which keys by name and would keep only
 * the last write of a name — exactly the one cookie too few that left the
 * user signed in.
 */

import { NextRequest, NextResponse } from "next/server";
import { sessionCookieExpiries } from "@/lib/suite-logout";

/** Appends the expiry of every session cookie name to a response. */
export function expireSessionCookies(request: NextRequest, response: NextResponse): NextResponse {
  const url = new URL(request.url);
  const expiries = sessionCookieExpiries(url.hostname, {
    secure: url.protocol === "https:",
    env: process.env,
  });
  for (const cookie of expiries) {
    response.headers.append("Set-Cookie", cookie);
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  return expireSessionCookies(request, NextResponse.json({ ok: true }));
}
