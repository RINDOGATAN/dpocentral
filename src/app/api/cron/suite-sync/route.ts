// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";
import { isAiSentinelConfigured } from "@/server/services/ai-sentinel/client";
import { dpoCentralPublicUrl, syncWithAiSentinel } from "@/server/services/suite/link-ais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: the two-way sync between linked DPO Central and AI Sentinel
// organisations (src/server/services/suite/link-ais.ts). Scheduled in
// vercel.json at "17 * * * *" (hourly). New AI systems and AI vendors on
// either side arrive on the other as drafts; nothing is deleted.
//
// Same guard as the other crons: fails CLOSED without CRON_SECRET,
// constant-time comparison. Answers 500 when an organisation failed.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.warn("Suite sync cron called but CRON_SECRET is not set; refusing to run");
    return NextResponse.json({ error: "Cron disabled: CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAiSentinelConfigured()) {
    return NextResponse.json({ success: true, skipped: "AI Sentinel is not connected" });
  }

  const linked = await prisma.organization.findMany({
    where: { settings: { path: ["aiSentinelLink", "active"], equals: true } },
    select: { id: true },
  });
  let synced = 0;
  let errors = 0;
  for (const org of linked) {
    try {
      await syncWithAiSentinel(prisma, org.id, dpoCentralPublicUrl());
      synced++;
    } catch (err) {
      errors++;
      logger.error("Suite sync failed for an organisation", err instanceof Error ? err : undefined, { organizationId: org.id });
    }
  }
  return NextResponse.json(
    { success: errors === 0, linked: linked.length, synced, errors },
    { status: errors === 0 ? 200 : 500 },
  );
}
