// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Test-only failure probes (the diagnostics.failureProbe procedure and the
 * /probe/error page). They exist only with E2E_FAILURE_PROBE=true, which the
 * smoke walk and the unit tests set and no real deployment does; otherwise
 * both answer "not found".
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export function failureProbeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.E2E_FAILURE_PROBE === "true";
}

/** Text the probes throw; tests assert none of it reaches a person. */
export const PROBE_FAILURE_TEXT =
  "Deliberate probe failure: connect ECONNRESET 10.0.0.7:6543 at Object.probe (internal/probe.ts:1:1)";
