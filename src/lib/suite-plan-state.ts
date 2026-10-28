// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One account, one pilot, one plan across the hosted suite (owner's decision,
 * 26 Oct 2026): DPO Central and AI Sentinel keep separate databases, so each
 * asks the other, server to server, for the plan and pilot state of the same
 * verified person.
 *
 * The contract (version 1), identical in both apps:
 *   POST <peer>/api/suite/plan-state
 *   header x-suite-signature: t=<unix seconds>,v1=<hex HMAC-SHA256(PLAN_SYNC_SECRET,
 *          "suite-plan-state.v1.<t>.<rawBody>")>
 *   body   {"version":1,"email":"<the signed-in person's e-mail>"}
 *   answer {"version":1,"found":bool,"paid":bool,"planRenewsAt":ISO|null,
 *           "subscriptionId":string|null,"pilotStartedAt":ISO|null}
 *
 * The secret is the one both apps already share with the storefront for the
 * plan relay (PLAN_SYNC_SECRET). The "suite-plan-state.v1." prefix keeps a
 * signature for this endpoint from ever verifying as a plan notice, and the
 * reverse. Five minutes' tolerance, as for the relay.
 *
 * "found" means the person is the billing owner of at least one organisation
 * on the peer. The answer carries the plan kind, its renewal date and
 * payment subscription (so a plan ended at the payment provider also ends on
 * the side that copied it), and the pilot's start: nothing else about the
 * person or their organisations.
 *
 * Pure leaf module: no Prisma, no Next.
 */

import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/safe-equal";

export const SUITE_SIGNATURE_HEADER = "x-suite-signature";
export const SUITE_TOLERANCE_SECONDS = 300;
const PURPOSE = "suite-plan-state.v1";

type Env = Record<string, string | undefined>;

export interface SuitePlanStateRequest {
  version: 1;
  email: string;
}

export interface SuitePlanState {
  version: 1;
  found: boolean;
  paid: boolean;
  planRenewsAt: string | null;
  subscriptionId: string | null;
  pilotStartedAt: string | null;
}

export const NOT_FOUND: SuitePlanState = {
  version: 1,
  found: false,
  paid: false,
  planRenewsAt: null,
  subscriptionId: null,
  pilotStartedAt: null,
};

export function suiteSecret(env: Env = process.env): string | null {
  const s = (env.PLAN_SYNC_SECRET ?? "").trim();
  return s.length > 0 ? s : null;
}

/**
 * On unless SUITE_PLAN_STATE is "off", and only with the shared secret. The
 * hosted check is the caller's (the kit never asks).
 */
export function suitePlanStateEnabled(env: Env = process.env): boolean {
  return env.SUITE_PLAN_STATE !== "off" && suiteSecret(env) !== null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return e.includes("@") && e.length <= 320 ? e : null;
}

/**
 * `purpose` is the endpoint's own prefix (default "suite-plan-state.v1"), so
 * a signature made for one suite endpoint never verifies at another.
 */
export function signSuiteRequest(secret: string, t: number, rawBody: string, purpose: string = PURPOSE): string {
  const v1 = createHmac("sha256", secret).update(`${purpose}.${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export function verifySuiteSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  purpose: string = PURPOSE
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i < 0 ? [p.trim(), ""] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(nowSeconds - t) > SUITE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${purpose}.${t}.${rawBody}`).digest("hex");
  return safeEqual(v1, expected);
}

export function parseSuiteRequest(raw: unknown): SuitePlanStateRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  const email = normalizeEmail(typeof r.email === "string" ? r.email : null);
  return email ? { version: 1, email } : null;
}

const isoOrNull = (v: unknown): string | null =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

/** A peer's answer, checked field by field; null when it is not a version 1 answer. */
export function parseSuiteState(raw: unknown): SuitePlanState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1 || typeof r.found !== "boolean" || typeof r.paid !== "boolean") return null;
  return {
    version: 1,
    found: r.found,
    paid: r.found && r.paid,
    planRenewsAt: r.found ? isoOrNull(r.planRenewsAt) : null,
    subscriptionId:
      r.found && typeof r.subscriptionId === "string" && r.subscriptionId.length <= 255 ? r.subscriptionId : null,
    pilotStartedAt: r.found ? isoOrNull(r.pilotStartedAt) : null,
  };
}
