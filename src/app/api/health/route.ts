// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Health endpoint — /api/health
 *
 * Used by the sovereign bundle's Docker healthcheck, suite.sh readiness
 * probes, the hosting provider's checks, the storefront's digest and any
 * external monitor. Unauthenticated by design: it exposes only liveness,
 * the reason word, the app version and commit — never user data.
 *
 * 200 {status:"ok", db:"up", version, commit}
 *     — the database answered within 2 s and its last applied migration is
 *       this build's last migration
 * 503 {status:"degraded", reason:"database"|"migrations", db, version, commit}
 *     — no detail beyond the reason word (src/lib/health-probe.ts)
 *
 * Protection: rate-limited per client address in src/middleware.ts
 * ("health" bucket), and the database probe is cached per process for
 * HEALTH_CACHE_MS milliseconds (src/lib/health-probe.ts).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health-probe";
import { version } from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const answer = await getHealth(version);
  return NextResponse.json(answer.body, {
    status: answer.status,
    headers: {
      "Cache-Control": "no-store",
      "X-Health-Cache": answer.fromCache ? "hit" : "miss",
    },
  });
}
