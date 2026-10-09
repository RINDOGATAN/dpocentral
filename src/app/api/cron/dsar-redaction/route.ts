// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { redactDsarRequest } from "@/server/services/dsar/redact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: DSAR PII auto-redaction
//
// Redacts personal data from completed DSARs after their retention period.
// Default 90 days post-completion; configurable per-org via DSARIntakeForm.
//
// Scheduled in vercel.json at "0 3 * * *" (daily 03:00 UTC). The full
// notifications cron (email/in-app/slack) was removed; only DSAR redaction
// runs from here now.
//
// It sends nothing, so it keeps running when the rights-request module is off
// (NEXT_PUBLIC_DSAR_ENABLED=false): records an organisation already holds are
// still cleared of personal data once their retention period ends.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized invocations.
  // Fails CLOSED: if CRON_SECRET is not configured, the endpoint refuses to
  // run rather than becoming an unauthenticated trigger. Set CRON_SECRET in
  // the environment and send it as `Authorization: Bearer <secret>`.
  // The comparison is constant-time (src/lib/safe-equal.ts) and the route
  // is rate-limited per client address in src/middleware.ts ("cron" bucket).
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("DSAR redaction cron called but CRON_SECRET is not set — refusing to run");
    return NextResponse.json(
      { error: "Cron disabled: CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const summary = { dsarRedacted: 0, errors: 0 };

  try {
    const organizations = await prisma.organization.findMany({
      select: { id: true },
    });

    for (const org of organizations) {
      try {
        await autoRedactCompletedDsars(org.id, now, summary);
      } catch (err) {
        logger.error("DSAR redaction cron failed for org", err, { orgId: org.id });
        summary.errors++;
      }
    }
  } catch (err) {
    logger.error("DSAR redaction cron fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  logger.info("DSAR redaction cron completed", summary as unknown as Record<string, unknown>);

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    summary,
  });
}

async function autoRedactCompletedDsars(
  organizationId: string,
  now: Date,
  summary: { dsarRedacted: number },
) {
  // Get org retention setting (from intake form, default 90 days)
  const intakeForm = await prisma.dSARIntakeForm.findFirst({
    where: { organizationId },
    select: { retentionDays: true },
  });
  const retentionDays = intakeForm?.retentionDays ?? 90;

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  // Find completed DSARs past retention that haven't been redacted
  const expiredRequests = await prisma.dSARRequest.findMany({
    where: {
      organizationId,
      status: { in: ["COMPLETED", "CANCELLED", "REJECTED"] },
      completedAt: { lt: cutoff },
      redactedAt: null,
    },
    select: { id: true },
  });

  for (const req of expiredRequests) {
    // Same routine as the manual "Redact" action: every field that can hold
    // personal data (src/server/services/dsar/redact.ts).
    await redactDsarRequest(prisma, req.id, {
      organizationId,
      now,
      audit: {
        action: "PII_AUTO_REDACTED",
        performedBy: "SYSTEM",
        details: { retentionDays, completedBefore: cutoff.toISOString() },
      },
    });

    summary.dsarRedacted++;
  }
}
