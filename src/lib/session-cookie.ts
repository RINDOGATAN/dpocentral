// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The name of the session cookie, and the one way route handlers read it.
 *
 * src/lib/auth.ts names the cookie per posture (see the cookie comments
 * there). A route handler that calls next-auth's getToken() without the
 * name looks for NextAuth's default name instead, finds nothing on the
 * self-hosted posture ("dpocentral.session-token") and answers 401 to a
 * signed-in person: every export did exactly that. Route handlers use
 * getSessionToken(); auth.ts takes its session-cookie name from here.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { features } from "@/config/features";

/**
 * The session cookie's name, or undefined where NextAuth's default name
 * applies (no cookie domain and no local sign-in).
 */
export function sessionTokenCookieName(
  env: Record<string, string | undefined> = process.env,
  localAuth: boolean = features.devAuthEnabled
): string | undefined {
  const isProduction = env.NODE_ENV === "production";
  if (env.AUTH_COOKIE_DOMAIN) {
    return `${isProduction ? "__Secure-" : ""}next-auth.session-token`;
  }
  if (localAuth) {
    const secure = isProduction && (env.NEXTAUTH_URL?.startsWith("https://") ?? true);
    return secure ? "__Secure-dpocentral.session-token" : "dpocentral.session-token";
  }
  return undefined;
}

/** The signed-in person's token, read under the cookie name auth.ts uses. */
export function getSessionToken(request: Request) {
  const cookieName = sessionTokenCookieName();
  return getToken({
    req: request as unknown as NextRequest,
    ...(cookieName ? { cookieName } : {}),
  });
}
