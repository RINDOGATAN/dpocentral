// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/plan/dsar-volume-sync
 *
 * A payment or an end of the rights-request volume upgrade, relayed by the
 * storefront's Stripe webhook (which has verified Stripe's own signature).
 * Same contract as POST /api/plan/stripe-sync (signature header, secret,
 * tolerance and body), on its own address so a plan notice and an upgrade
 * notice can never be taken for each other. See
 * src/server/services/dsar/volume-sync.ts.
 *
 *   503  the automatic upgrade is switched off (AUTO_UPGRADE_ENABLED) or has
 *        no secret: the storefront then answers Stripe with an error and
 *        Stripe retries, so a payment is not lost while switching on;
 *   401  missing, wrong or stale signature (nothing is read or written);
 *   400  malformed notice;
 *   200  done; a payment that matches no organisation is reported in the
 *        results with its reason and logged;
 *   500  database failure (Stripe retries; the change is idempotent).
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  autoUpgradeEnabled,
  parseSyncNotice,
  planSyncSecret,
  verifySyncSignature,
} from "@/lib/plan-upgrade";
import { applyDsarVolumeNotice, type VolumeSyncDb } from "@/server/services/dsar/volume-sync";

export async function POST(request: Request) {
  const secret = planSyncSecret();
  if (!autoUpgradeEnabled() || !secret) {
    return Response.json({ error: "Automatic upgrade is switched off" }, { status: 503 });
  }

  const body = await request.text();
  if (!verifySyncSignature(request.headers.get("x-plan-sync-signature"), body, secret)) {
    logger.warn("Rights-request volume sync refused: bad signature");
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
    const results = await applyDsarVolumeNotice(prisma as unknown as VolumeSyncDb, notice, secret);
    return Response.json({ ok: true, results });
  } catch (err) {
    logger.error("Rights-request volume sync failed", err, { eventId: notice.eventId });
    return Response.json({ error: "Rights-request volume sync failed" }, { status: 500 });
  }
}
