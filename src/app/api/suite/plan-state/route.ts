// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/suite/plan-state
 *
 * AI Sentinel asks for the plan and pilot state of a person (the contract in
 * src/lib/suite-plan-state.ts). Signed with the shared PLAN_SYNC_SECRET in
 * the x-suite-signature header, five minutes' tolerance.
 *
 *   404  not the hosted service, or switched off (SUITE_PLAN_STATE=off, no secret);
 *   401  missing, wrong or stale signature (nothing is read);
 *   400  malformed request;
 *   200  the state (found false when the person bills no organisation here).
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isHostedDeployment } from "@/lib/hosted";
import {
  SUITE_SIGNATURE_HEADER,
  parseSuiteRequest,
  suitePlanStateEnabled,
  suiteSecret,
  verifySuiteSignature,
} from "@/lib/suite-plan-state";
import { localPlanStateForEmail, type LocalStateDb } from "@/server/services/suite/plan-state";

export async function POST(request: Request) {
  const secret = suiteSecret();
  if (!isHostedDeployment() || !suitePlanStateEnabled() || !secret) {
    return Response.json({ error: "Not available" }, { status: 404 });
  }
  const body = await request.text();
  if (!verifySuiteSignature(request.headers.get(SUITE_SIGNATURE_HEADER), body, secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return Response.json({ error: "Malformed request" }, { status: 400 });
  }
  const req = parseSuiteRequest(raw);
  if (!req) return Response.json({ error: "Malformed request" }, { status: 400 });
  try {
    const state = await localPlanStateForEmail(prisma as unknown as LocalStateDb, req.email);
    return Response.json(state);
  } catch (err) {
    logger.error("Suite plan state failed", err);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
