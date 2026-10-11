// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Abuse protection for the public rights-request form (/dsar/<orgSlug>,
 * dsar.submitPublic). The form takes requests from anyone, so it guards
 * against scripts and floods without asking the requester for anything more:
 *
 *  1. A hidden field (the honeypot). People never see or fill it; form-filling
 *     scripts do. A submission with it filled is refused.
 *  2. A signed form token, issued when the form is loaded (getPublicForm). It
 *     names the organisation and the time it was issued. A submission is
 *     refused when the token is missing, forged, for another organisation,
 *     older than a day, or used sooner than MIN_FILL_MS after the form loaded
 *     (no person fills the form that fast).
 *  3. Shared daily limits, counted in the database so every server instance
 *     sees the same total (src/lib/shared-rate-limit.ts): per client address
 *     and per organisation.
 *  4. A daily limit on acknowledgement e-mails per recipient address, across
 *     all organisations, so the form cannot be used to flood someone's inbox.
 *     Over it, the request is still received (the legal clock starts on
 *     receipt), only the e-mail is not sent; the form then tells the
 *     requester to keep the reference shown on screen.
 *
 * Every refusal is counted per reason and day (and per organisation where it
 * is known) and logged with the reason only: no address, no name, no text.
 *
 * Limits (env overrides, positive whole numbers):
 *   DSAR_PUBLIC_LIMIT_PER_IP_DAY        default 10
 *   DSAR_PUBLIC_LIMIT_PER_ORG_DAY       default 50
 *   DSAR_ACK_LIMIT_PER_RECIPIENT_DAY    default 3
 * The per-address limit is skipped when the client address is unknown (an
 * install reached with no reverse proxy), and when RATE_LIMIT_DISABLED=true
 * (installs whose proxy already limits), as the in-memory limiter is.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { createHmac } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { logger } from "@/lib/logger";
import { isRateLimitDisabled } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/safe-equal";
import {
  DAY_MS,
  envLimit,
  hashIdentifier,
  hitOrNull,
  serverSecret,
  type CounterDb,
} from "@/lib/shared-rate-limit";

/** No person fills the form in less than this, from load to submit. */
export const MIN_FILL_MS = 3_000;
/** A form token older than this is refused (the requester reloads the page). */
export const FORM_TOKEN_MAX_AGE_MS = DAY_MS;
/** Clock skew tolerated between instances for a token issued "in the future". */
const CLOCK_SKEW_MS = 60_000;

export const DEFAULT_LIMITS = {
  perIpPerDay: 10,
  perOrgPerDay: 50,
  acknowledgementsPerRecipientPerDay: 3,
} as const;

export function publicIntakeLimits() {
  return {
    perIpPerDay: envLimit("DSAR_PUBLIC_LIMIT_PER_IP_DAY", DEFAULT_LIMITS.perIpPerDay),
    perOrgPerDay: envLimit("DSAR_PUBLIC_LIMIT_PER_ORG_DAY", DEFAULT_LIMITS.perOrgPerDay),
    acknowledgementsPerRecipientPerDay: envLimit(
      "DSAR_ACK_LIMIT_PER_RECIPIENT_DAY",
      DEFAULT_LIMITS.acknowledgementsPerRecipientPerDay
    ),
  };
}

export type RejectionReason =
  | "honeypot"
  | "token_invalid"
  | "token_expired"
  | "too_fast"
  | "ip_limit"
  | "org_limit";

/** Refusal messages, in English; the tRPC error formatter localises them (serverErrors.exact). */
export const INTAKE_MESSAGES = {
  notAccepted: "We could not accept this request. Please reload the page and submit it again.",
  tooFast: "Please take a moment to check your request, then submit it again.",
  tooMany: "Too many requests have been sent from here today. Please try again tomorrow, or contact the organization directly.",
  orgBusy: "This form is receiving an unusual number of requests today. Please try again tomorrow, or contact the organization directly.",
} as const;

// ── Form token ───────────────────────────────────────────────────────────

function sign(orgSlug: string, issuedAt: number): string {
  return createHmac("sha256", serverSecret())
    .update(`dsar-form|${orgSlug}|${issuedAt}`)
    .digest("base64url");
}

/** The token getPublicForm hands to the form: "<issuedAt>.<signature>". */
export function issueFormToken(orgSlug: string, now: Date = new Date()): string {
  const issuedAt = now.getTime();
  return `${issuedAt}.${sign(orgSlug, issuedAt)}`;
}

export type TokenCheck = { ok: true } | { ok: false; reason: "token_invalid" | "token_expired" | "too_fast" };

export function checkFormToken(
  token: string | undefined,
  orgSlug: string,
  now: Date = new Date()
): TokenCheck {
  if (!token) return { ok: false, reason: "token_invalid" };
  const match = /^(\d{1,15})\.([A-Za-z0-9_-]{20,100})$/.exec(token);
  if (!match) return { ok: false, reason: "token_invalid" };
  const issuedAt = Number(match[1]);
  if (!safeEqual(match[2]!, sign(orgSlug, issuedAt))) return { ok: false, reason: "token_invalid" };
  const age = now.getTime() - issuedAt;
  if (age < -CLOCK_SKEW_MS) return { ok: false, reason: "token_invalid" };
  if (age > FORM_TOKEN_MAX_AGE_MS) return { ok: false, reason: "token_expired" };
  if (age < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  return { ok: true };
}

// ── Refusals: counted and logged, never with personal data ──────────────

const day = (now: Date) => now.toISOString().slice(0, 10);

/** Counts and logs a refused submission (reason and organisation id only). */
export async function recordRejection(
  db: CounterDb,
  reason: RejectionReason,
  organizationId: string | null,
  now: Date = new Date()
): Promise<void> {
  await hitOrNull(db, `dsar-rejected:${reason}`, DAY_MS, now);
  if (organizationId) {
    await hitOrNull(db, `dsar-rejected:${reason}:org:${organizationId}`, DAY_MS, now);
  }
  logger.warn("Public rights-request submission refused", {
    reason,
    organizationId,
    day: day(now),
  });
}

async function refuse(
  db: CounterDb,
  reason: RejectionReason,
  organizationId: string | null,
  now: Date
): Promise<never> {
  await recordRejection(db, reason, organizationId, now);
  switch (reason) {
    case "too_fast":
      throw new TRPCError({ code: "BAD_REQUEST", message: INTAKE_MESSAGES.tooFast });
    case "ip_limit":
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: INTAKE_MESSAGES.tooMany });
    case "org_limit":
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: INTAKE_MESSAGES.orgBusy });
    default:
      throw new TRPCError({ code: "BAD_REQUEST", message: INTAKE_MESSAGES.notAccepted });
  }
}

/**
 * Checks 1 and 2: the honeypot and the form token. Run before the
 * organisation is read, so a script costs one counter write and nothing else.
 */
export async function assertHumanSubmission(
  db: CounterDb,
  input: { orgSlug: string; website?: string; formToken?: string },
  now: Date = new Date()
): Promise<void> {
  if (input.website && input.website.trim() !== "") {
    await refuse(db, "honeypot", null, now);
  }
  const token = checkFormToken(input.formToken, input.orgSlug, now);
  if (!token.ok) await refuse(db, token.reason, null, now);
}

/**
 * Check 3: the shared daily limits per client address and per organisation.
 * Each call counts one attempt in both buckets.
 */
export async function assertWithinDailyLimits(
  db: CounterDb,
  organizationId: string,
  clientIp: string | null | undefined,
  now: Date = new Date()
): Promise<void> {
  const limits = publicIntakeLimits();
  if (clientIp && clientIp !== "unknown" && !isRateLimitDisabled()) {
    const ipCount = await hitOrNull(db, `dsar-ip:${hashIdentifier("ip", clientIp)}`, DAY_MS, now);
    if (ipCount !== null && ipCount > limits.perIpPerDay) {
      await refuse(db, "ip_limit", organizationId, now);
    }
  }
  const orgCount = await hitOrNull(db, `dsar-org:${organizationId}`, DAY_MS, now);
  if (orgCount !== null && orgCount > limits.perOrgPerDay) {
    await refuse(db, "org_limit", organizationId, now);
  }
}

/**
 * Check 4: may an acknowledgement go to this address today? Counts the
 * attempt. False over the limit; the suppression is counted and logged
 * without the address.
 */
export async function mayAcknowledge(
  db: CounterDb,
  recipient: string,
  organizationId: string,
  now: Date = new Date()
): Promise<boolean> {
  const limit = publicIntakeLimits().acknowledgementsPerRecipientPerDay;
  const count = await hitOrNull(db, `dsar-ack:${hashIdentifier("email", recipient)}`, DAY_MS, now);
  if (count === null || count <= limit) return true;
  await hitOrNull(db, "dsar-ack-suppressed", DAY_MS, now);
  logger.warn("Rights-request acknowledgement not sent: recipient's daily limit reached", {
    organizationId,
    day: day(now),
  });
  return false;
}
