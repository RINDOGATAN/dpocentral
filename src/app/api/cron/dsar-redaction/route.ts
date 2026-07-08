// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized invocations.
  // Fails CLOSED: if CRON_SECRET is not configured, the endpoint refuses to
  // run rather than becoming an unauthenticated trigger. Set CRON_SECRET in
  // the environment and send it as `Authorization: Bearer <secret>`.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("DSAR redaction cron called but CRON_SECRET is not set — refusing to run");
    return NextResponse.json(
      { error: "Cron disabled: CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
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
    await prisma.dSARRequest.update({
      where: { id: req.id },
      data: {
        requesterName: "REDACTED",
        requesterEmail: "redacted@redacted",
        requesterPhone: null,
        requesterAddress: null,
        description: null,
        requestedData: null,
        responseNotes: null,
        redactedAt: now,
      },
    });

    await prisma.dSARCommunication.updateMany({
      where: { dsarRequestId: req.id },
      data: { content: "REDACTED", subject: null },
    });

    await prisma.dSARTask.updateMany({
      where: { dsarRequestId: req.id },
      data: { notes: null, description: null },
    });

    await prisma.dSARAuditLog.create({
      data: {
        dsarRequestId: req.id,
        action: "PII_AUTO_REDACTED",
        performedBy: "SYSTEM",
        details: { retentionDays, completedBefore: cutoff.toISOString() },
      },
    });

    summary.dsarRedacted++;
  }
}
