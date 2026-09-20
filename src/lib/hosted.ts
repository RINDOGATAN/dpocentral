// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted-service detection.
 *
 * The same source serves the hosted service and the self-hosted kit; the
 * difference is environment only. The hosted service is a free, capped pilot
 * (see src/server/services/pilot/caps.ts). A deployment counts as hosted when
 * it runs as the provider's production deployment (VERCEL_ENV=production) or
 * when it sets the hosted cross-app cookie domain (AUTH_COOKIE_DOMAIN ending
 * in todo.law). The kit sets neither, so it keeps its behaviour: no caps, and
 * premium modules by offline licence.
 *
 * Read at call time (not at module load) so the value follows the runtime
 * environment and tests can switch it.
 */
export function isHostedDeployment(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.VERCEL_ENV === "production") return true;
  const cookieDomain = (env.AUTH_COOKIE_DOMAIN ?? "").trim().toLowerCase();
  return cookieDomain === "todo.law" || cookieDomain.endsWith(".todo.law");
}

/** Where a pilot user learns to run their own instance. */
export const RUN_YOUR_OWN_URL = "https://www.todo.law/run";

/** Where a firm that has used up a trial allowance asks for a deployment. */
export const CONTACT_URL = "https://www.todo.law/contact";

/** In-app anchor of the pilot card, which lists every export. */
export const PILOT_EXPORT_PATH = "/privacy/settings#pilot-export";

/** The documentation section that states what the hosted pilot allows. */
export const PILOT_DOCS_PATH = "/docs#hosted-pilot";
