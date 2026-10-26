// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { reminderMailerFromEnv } from "@/server/services/dsar/deadlineReminders";
import { runOrganizationRetention, type RetentionDb } from "@/server/services/organization/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: deletion of organisations whose paid plan ended more than 30
// days ago, and of pilot organisations nobody has used for twelve months,
// after e-mail notices (hosted only; src/server/services/organization/retention.ts).
// Scheduled in vercel.json at "45 3 * * *" (daily 03:45 UTC).
//
// Off unless ORG_RETENTION_ENABLED is "true": it then only reports what it
// would do (organisation ids and counts, no names).
//
// Same guard as the other crons: fails CLOSED without CRON_SECRET,
// constant-time comparison, rate-limited in src/middleware.ts ("cron").
// Answers 500 when an organisation failed, so the failure shows in the logs.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("Organisation retention cron called but CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "Cron disabled: CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const summary = await runOrganizationRetention(prisma as unknown as RetentionDb, reminderMailerFromEnv(), now);
    return NextResponse.json(
      { success: summary.errors === 0, timestamp: now.toISOString(), summary },
      { status: summary.errors === 0 ? 200 : 500 }
    );
  } catch (err) {
    logger.error("Organisation retention cron fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
