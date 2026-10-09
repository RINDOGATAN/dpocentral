// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { isDsarModuleEnabled } from "@/config/features";
import {
  reminderMailerFromEnv,
  runDsarDeadlineReminders,
} from "@/server/services/dsar/deadlineReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: rights-request deadline reminders
//
// Sends the 7, 3 and 1-day reminders and the overdue notice
// (src/server/services/dsar/deadlineReminders.ts). Scheduled in vercel.json
// at "0 7 * * *" (daily 07:00 UTC). A self-hosted instance can call it from
// its own scheduler with the same header; without RESEND_API_KEY it sends
// and records nothing.
//
// Same guard as the redaction cron: fails CLOSED without CRON_SECRET,
// constant-time comparison, rate-limited in src/middleware.ts ("cron").
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("DSAR reminders cron called but CRON_SECRET is not set; refusing to run");
    return NextResponse.json(
      { error: "Cron disabled: CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Without the rights-request module (src/config/features.ts) no reminder is
  // sent and nothing is read: the run succeeds and reports that it skipped.
  if (!isDsarModuleEnabled()) {
    logger.info("DSAR reminders cron skipped: the rights-request module is off");
    return NextResponse.json({ success: true, timestamp: now.toISOString(), skipped: "dsar-module-off" });
  }

  try {
    const summary = await runDsarDeadlineReminders(prisma, reminderMailerFromEnv(), now);
    logger.info("DSAR reminders cron completed", summary as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, timestamp: now.toISOString(), summary });
  } catch (err) {
    logger.error("DSAR reminders cron fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
