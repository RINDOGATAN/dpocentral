// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which engines a deployment may use for AI calls.
 *
 * AI_REQUIRE_ORG_KEY:
 *   "true"   only the organisation's own API inference key is used; the
 *            deployment's engines (LLM_GATEWAY_*, ANTHROPIC_API_KEY) are
 *            ignored for every organisation;
 *   "false"  the deployment's engines answer as before; an organisation key,
 *            when saved, takes precedence for that organisation;
 *   unset    "true" on the shared hosted service (isHostedDeployment():
 *            VERCEL_ENV=production, or a todo.law cookie domain), "false"
 *            everywhere else. A dedicated instance that runs with either of
 *            those markers and should use its own engine sets "false".
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isHostedDeployment } from "@/lib/hosted";

export function orgKeyRequired(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.AI_REQUIRE_ORG_KEY?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return isHostedDeployment(env);
}
