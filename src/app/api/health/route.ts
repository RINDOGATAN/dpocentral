/**
 * Health endpoint — /api/health
 *
 * Used by the sovereign bundle's Docker healthcheck, suite.sh readiness
 * probes, and any external monitor. Unauthenticated by design: it exposes
 * only liveness, DB reachability, and the app version — no tenant data.
 *
 * 200 {status:"ok"}       — app up, database reachable
 * 503 {status:"degraded"} — app up, database unreachable
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { version } from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", version });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down", version },
      { status: 503 }
    );
  }
}
