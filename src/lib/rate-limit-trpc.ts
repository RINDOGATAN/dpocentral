// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public DSAR limit, enforced where a tRPC request always arrives.
 *
 * The middleware matcher (src/middleware.ts) skips every path that contains a
 * dot, and every tRPC path does ("/api/trpc/dsar.submitPublic"), so the
 * middleware never sees the plain form of a tRPC call. The tRPC route handler
 * therefore applies the same bucket itself, on the DECODED procedure name
 * (the one tRPC will resolve), before the request reaches the router.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { classifyRequest } from "./rate-limit-routes";
import { dsarPublicLimiter } from "./rate-limit";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** A 429 response when the caller is over the public DSAR limit, else null. */
export function limitPublicTrpc(req: Request): Response | null {
  const { pathname } = new URL(req.url);
  if (classifyRequest(pathname, req.method) !== "dsarPublic") return null;

  const result = dsarPublicLimiter.check(`dsarPublic:${clientIp(req)}`);
  if (result.success) return null;

  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
