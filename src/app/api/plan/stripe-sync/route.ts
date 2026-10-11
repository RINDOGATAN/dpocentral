// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/plan/stripe-sync
 *
 * A plan payment or a plan end, relayed by the storefront's Stripe webhook
 * (which has verified Stripe's own signature). Signed with PLAN_SYNC_SECRET in
 * the x-plan-sync-signature header (t=<seconds>,v1=<hex HMAC of "t.body">),
 * five minutes' tolerance. See src/lib/plan-upgrade.ts and
 * src/server/services/pilot/plan-sync.ts.
 *
 *   503  the automatic upgrade is switched off (AUTO_UPGRADE_ENABLED) or has
 *        no secret: the storefront then answers Stripe with an error and
 *        Stripe retries, so a payment is not lost while switching on;
 *   401  missing, wrong or stale signature (nothing is read or written);
 *   400  malformed notice;
 *   200  done; a payment that matches no organisation is reported in the
 *        results with its reason and logged (no retry would change it);
 *   500  database failure (the storefront answers Stripe with an error and
 *        Stripe retries; the change is idempotent).
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  autoUpgradeEnabled,
  parseSyncNotice,
  planSyncSecret,
  verifySyncSignature,
} from "@/lib/plan-upgrade";
import { applyPlanNotice, type PlanSyncDb } from "@/server/services/pilot/plan-sync";

export async function POST(request: Request) {
  const secret = planSyncSecret();
  if (!autoUpgradeEnabled() || !secret) {
    return Response.json({ error: "Automatic upgrade is switched off" }, { status: 503 });
  }

  const body = await request.text();
  if (!verifySyncSignature(request.headers.get("x-plan-sync-signature"), body, secret)) {
    logger.warn("Plan sync refused: bad signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return Response.json({ error: "Malformed notice" }, { status: 400 });
  }
  const notice = parseSyncNotice(raw);
  if (!notice) return Response.json({ error: "Malformed notice" }, { status: 400 });

  try {
    const results = await applyPlanNotice(prisma as unknown as PlanSyncDb, notice, secret);
    return Response.json({ ok: true, results });
  } catch (err) {
    logger.error("Plan sync failed", err, { eventId: notice.eventId });
    return Response.json({ error: "Plan sync failed" }, { status: 500 });
  }
}
