// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The server half of sign-out: putting the cookie expiries on a response.
 *
 * Separate from `src/lib/suite-logout.ts` because that module is imported by
 * the browser and must stay free of `next/server`. The rules themselves live
 * there; this only carries them onto a response.
 *
 * The headers are appended rather than set through `response.cookies`, which
 * keys by name and would keep only the last write of a name — exactly the one
 * cookie too few that left the user signed in.
 */

import type { NextRequest, NextResponse } from "next/server";
import { sessionCookieExpiries } from "@/lib/suite-logout";

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
