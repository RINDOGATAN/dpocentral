// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Maps an incoming API request to the limiter that governs it. Pure and
 * edge-safe (no Node imports) because src/middleware.ts runs it on every
 * request. One request is counted in exactly ONE bucket.
 *
 * Buckets (see src/lib/rate-limit.ts for the ceilings and env overrides):
 *   magicLink   POST /api/auth/signin/email — sends an e-mail per call
 *   signIn      every other sign-in step: /api/auth/callback/* (credentials,
 *               OAuth return, magic-link consumption), POST /api/auth/signin/*,
 *               and the development-only /api/auth/dev-login
 *   auth        the rest of /api/auth (session, csrf, providers, signout)
 *   checkout    /api/checkout and /api/billing
 *   dsarPublic  the unauthenticated DSAR tRPC procedures
 *   health      /api/health
 *   import      static-key routes: /api/import/* and /api/admin/sync-templates
 *   cron        /api/cron/*
 * Not limited: /api/webhooks/stripe (signature-verified; Stripe retries on
 * 429 would only delay settlement), /api/export/* (limited inside the route,
 * per user, see src/lib/api-export.ts), and the authenticated tRPC surface.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export type LimitedRoute =
  | "magicLink"
  | "signIn"
  | "auth"
  | "checkout"
  | "dsarPublic"
  | "health"
  | "import"
  | "cron";

export function classifyRequest(pathname: string, method: string): LimitedRoute | null {
  const upper = method.toUpperCase();

  if (pathname.startsWith("/api/auth")) {
    if (pathname === "/api/auth/signin/email" && upper === "POST") return "magicLink";
    if (pathname.startsWith("/api/auth/callback/")) return "signIn";
    if (pathname.startsWith("/api/auth/signin/") && upper === "POST") return "signIn";
    if (pathname === "/api/auth/dev-login") return "signIn";
    return "auth";
  }

  if (pathname.startsWith("/api/checkout") || pathname.startsWith("/api/billing")) {
    return "checkout";
  }

  // Public DSAR intake + withdraw. Matches tRPC paths like
  // /api/trpc/dsar.submitPublic and batched /api/trpc/dsar.submitPublic,x.
  if (
    pathname.startsWith("/api/trpc") &&
    (pathname.includes("dsar.submitPublic") || pathname.includes("dsar.withdrawPublic"))
  ) {
    return "dsarPublic";
  }

  if (pathname === "/api/health") return "health";

  if (pathname.startsWith("/api/import/") || pathname === "/api/admin/sync-templates") {
    return "import";
  }

  if (pathname.startsWith("/api/cron/")) return "cron";

  return null;
}
