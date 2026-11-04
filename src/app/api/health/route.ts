// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Health endpoint — /api/health
 *
 * Used by the Docker image's healthcheck, readiness
 * probes, the hosting provider's checks, the uptime workflow and any external
 * monitor. All of them read the status code (and the uptime workflow
 * `"status":"ok"`), so without a key the body is the status word only:
 *
 * 200 {status:"ok"}
 *     — the database answered within 2 s and its last applied migration is
 *       this build's last migration
 * 503 {status:"degraded"}
 *
 * With the key (header `x-health-key` equal to HEALTH_DETAIL_KEY, compared in
 * constant time; never when the variable is unset), the body adds the detail
 * for an operator: reason ("database"|"migrations"), db, version and commit
 * (src/lib/health-probe.ts). Never user data.
 *
 * Protection: rate-limited per client address in src/middleware.ts
 * ("health" bucket), and the database probe is cached per process for
 * HEALTH_CACHE_MS milliseconds (src/lib/health-probe.ts).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextResponse } from "next/server";
import { getHealth, hasHealthKey } from "@/lib/health-probe";
import { version } from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const answer = await getHealth(version);
  const body = hasHealthKey(request) ? answer.body : { status: answer.body.status };
  return NextResponse.json(body, {
    status: answer.status,
    headers: {
      "Cache-Control": "no-store",
      "X-Health-Cache": answer.fromCache ? "hit" : "miss",
    },
  });
}
