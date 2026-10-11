// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import {
  pilotReminderMailerFromEnv,
  runPilotReminders,
} from "@/server/services/pilot/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: pilot-ending reminders
//
// Sends the 5-day and last-day e-mails to the owners and administrators of
// each organisation on the hosted pilot (src/server/services/pilot/reminders.ts).
// Scheduled in vercel.json at "15 7 * * *" (daily 07:15 UTC). Off unless
// PILOT_REMINDERS_ENABLED=true; the run then succeeds and reports that it
// skipped.
//
// Same guard as the other crons: fails CLOSED without CRON_SECRET,
// constant-time comparison, rate-limited in src/middleware.ts ("cron").
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("Pilot reminders cron called but CRON_SECRET is not set; refusing to run");
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
    const summary = await runPilotReminders(prisma, pilotReminderMailerFromEnv(), now);
    logger.info("Pilot reminders cron completed", summary as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, timestamp: now.toISOString(), summary });
  } catch (err) {
    logger.error("Pilot reminders cron fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
