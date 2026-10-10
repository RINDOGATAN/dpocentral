// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { purgeClosedSafeguardsRequests } from "@/server/services/safeguards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: delete safeguards requests closed more than six months ago
//
// A request for a managed server or own hardware (the welcome card's options
// b and c) is kept until it is closed and then for six months (owner's
// decision O3, 9 October 2026, revised to six months to match the privacy
// notice). Open requests are never touched. Scheduled in
// vercel.json at "30 3 * * *" (daily 03:30 UTC).
//
// Same guard as the other crons: fails CLOSED without CRON_SECRET,
// constant-time comparison, rate-limited in src/middleware.ts ("cron").
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("Safeguards requests purge called but CRON_SECRET is not set; refusing to run");
    return NextResponse.json(
      { error: "Cron disabled: CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const summary = await purgeClosedSafeguardsRequests(prisma, now);
    logger.info("Safeguards requests purge completed", summary as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, timestamp: now.toISOString(), summary });
  } catch (err) {
    logger.error("Safeguards requests purge fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
