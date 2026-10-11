// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { reminderMailerFromEnv } from "@/server/services/dsar/deadlineReminders";
import { runInactiveDsarCleanup, type InactiveDb } from "@/server/services/dsar/inactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: open rights requests with no activity for 30 days (hosted only)
//
// Sends the 7-day notice to the organisation's owners and administrators,
// then deletes the request once the date has come with no activity since
// (src/server/services/dsar/inactive.ts). Scheduled in vercel.json at
// "15 3 * * *" (daily 03:15 UTC). On the self-hosted kit it does nothing.
//
// Same guard as the other crons: fails CLOSED without CRON_SECRET,
// constant-time comparison, rate-limited in src/middleware.ts ("cron").
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("Inactive DSAR cron called but CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "Cron disabled: CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const summary = await runInactiveDsarCleanup(prisma as unknown as InactiveDb, reminderMailerFromEnv(), now);
    logger.info("Inactive DSAR cron completed", summary as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, timestamp: now.toISOString(), summary });
  } catch (err) {
    logger.error("Inactive DSAR cron fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
