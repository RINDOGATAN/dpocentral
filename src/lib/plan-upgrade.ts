// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The automatic upgrade from the hosted pilot to the paid EU cloud plan
 * (owner's decision, 11 Oct 2026): checkout starts from inside the app and
 * carries the organisation; the confirmed payment lifts the limits at once,
 * with the same records.
 *
 * The pieces, all behind AUTO_UPGRADE_ENABLED (off unless exactly "true"):
 *   - GET /api/plan/checkout sends an owner or admin to the plan's Stripe
 *     payment link for the visitor's currency (src/lib/plan-currency.ts)
 *     and the billing interval chosen: yearly from PLAN_CLOUD_EUR_LINK or
 *     PLAN_CLOUD_USD_LINK, monthly from NEXT_PUBLIC_PLAN_CLOUD_EUR_MONTHLY_LINK
 *     or NEXT_PUBLIC_PLAN_CLOUD_USD_MONTHLY_LINK (public, as the landing's
 *     pricing block shows the same links; no link is written in the code),
 *     with a signed organisation reference
 *     (client_reference_id) and their e-mail (prefilled_email);
 *   - the storefront's Stripe webhook, which receives the account's payment
 *     events, relays each plan payment or plan end to
 *     POST /api/plan/stripe-sync, signed with PLAN_SYNC_SECRET;
 *   - src/server/services/pilot/plan-sync.ts maps the payment to an
 *     organisation and sets the plan, with an audit-trail entry.
 *
 * No Stripe object is created by any of this. PLAN_SYNC_SECRET never leaves
 * the server.
 *
 * The plan is recorded as EU_CLOUD whichever currency was paid: EU_CLOUD is
 * the internal name of the one paid plan, and the same plan lifts the pilot
 * limits whether it was bought with the EUR link or the USD link.
 */

import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/safe-equal";
import { isHostedDeployment } from "@/lib/hosted";
import { planCurrencyFromHeaders, type PlanCurrency } from "@/lib/plan-currency";

type Env = Record<string, string | undefined>;

/** This app's code in the organisation reference. AI Sentinel uses "ais". */
export const APP_CODE = "dpc";

/** How old a relayed notice may be, in seconds. */
export const SYNC_TOLERANCE_SECONDS = 300;

export function autoUpgradeEnabled(env: Env = process.env): boolean {
  return env.AUTO_UPGRADE_ENABLED === "true";
}

export function planSyncSecret(env: Env = process.env): string | null {
  const s = (env.PLAN_SYNC_SECRET ?? "").trim();
  return s.length > 0 ? s : null;
}

/** How often the plan is paid: yearly (the default) or monthly. */
export type PlanInterval = "year" | "month";

/** Reads the checkout's `interval` parameter: absent means yearly; anything unknown is null. */
export function parsePlanInterval(value: string | null | undefined): PlanInterval | null {
  if (value === null || value === undefined || value === "" || value === "year") return "year";
  return value === "month" ? "month" : null;
}

function rawLink(currency: PlanCurrency, interval: PlanInterval, env: Env): string | undefined {
  if (interval === "month") {
    return currency === "EUR"
      ? env.NEXT_PUBLIC_PLAN_CLOUD_EUR_MONTHLY_LINK
      : env.NEXT_PUBLIC_PLAN_CLOUD_USD_MONTHLY_LINK;
  }
  return currency === "EUR" ? env.PLAN_CLOUD_EUR_LINK : env.PLAN_CLOUD_USD_LINK;
}

/**
 * The payment link for a currency and interval; null when unset. Yearly:
 * PLAN_CLOUD_EUR_LINK / PLAN_CLOUD_USD_LINK. Monthly:
 * NEXT_PUBLIC_PLAN_CLOUD_EUR_MONTHLY_LINK / NEXT_PUBLIC_PLAN_CLOUD_USD_MONTHLY_LINK.
 */
export function paymentLinkFor(
  currency: PlanCurrency,
  env: Env = process.env,
  interval: PlanInterval = "year"
): string | null {
  const link = (rawLink(currency, interval, env) ?? "").trim();
  return /^https:\/\/\S+$/.test(link) ? link : null;
}

/**
 * The in-app plan offer for a request: the currency the customer will be
 * charged and the payment links "Move to the paid plan" would use, yearly
 * and, when its link is set, monthly (null when
 * it cannot be offered: not the hosted service, switched off, no secret, or
 * no link set for that currency). The signed-in layout hands `currency` to
 * every in-app price hint (ChargeCurrencyProvider), and the checkout route
 * follows `link`, so the hint and the button come from this one decision
 * and cannot disagree.
 */
export function inAppPlanOffer(
  headers: { get(name: string): string | null },
  env: Env = process.env
): { currency: PlanCurrency; link: string | null; monthlyLink: string | null } {
  const currency = planCurrencyFromHeaders(headers);
  const offered = isHostedDeployment(env) && autoUpgradeEnabled(env) && planSyncSecret(env) !== null;
  return {
    currency,
    link: offered ? paymentLinkFor(currency, env, "year") : null,
    // Monthly is offered only beside the yearly link, never alone.
    monthlyLink: offered && paymentLinkFor(currency, env, "year") ? paymentLinkFor(currency, env, "month") : null,
  };
}

/** The payment link the in-app upgrade would use for this request and interval, or null (see inAppPlanOffer). */
export function upgradeLinkFor(
  headers: { get(name: string): string | null },
  env: Env = process.env,
  interval: PlanInterval = "year"
): string | null {
  const offer = inAppPlanOffer(headers, env);
  return interval === "month" ? offer.monthlyLink : offer.link;
}

function referenceSignature(secret: string, app: string, orgId: string): string {
  return createHmac("sha256", secret)
    .update(`plan-eu-ref:v1:${app}:${orgId}`)
    .digest("hex")
    .slice(0, 32);
}

/** The signed organisation reference sent to Stripe as client_reference_id. */
export function signOrgReference(orgId: string, secret: string, app: string = APP_CODE): string {
  if (!/^[A-Za-z0-9]+$/.test(orgId)) throw new Error("Organisation id has unexpected characters.");
  return `pe1-${app}-${orgId}-${referenceSignature(secret, app, orgId)}`;
}

export type ParsedReference =
  | { kind: "none" }
  | { kind: "other-app"; app: string }
  | { kind: "invalid" }
  | { kind: "valid"; orgId: string };

/**
 * Reads a client_reference_id. A reference for another app of the suite is
 * reported as such (this app then uses the e-mail rule); a reference for this
 * app is valid only with the right signature.
 */
export function parseOrgReference(
  ref: string | null | undefined,
  secret: string,
  app: string = APP_CODE
): ParsedReference {
  if (!ref) return { kind: "none" };
  if (ref.length > 200 || !/^[A-Za-z0-9_-]+$/.test(ref)) return { kind: "invalid" };
  const m = /^pe1-([a-z]+)-([A-Za-z0-9]+)-([0-9a-f]{32})$/.exec(ref);
  if (!m) return { kind: "invalid" };
  const [, refApp, orgId, sig] = m;
  if (refApp !== app) return { kind: "other-app", app: refApp };
  return safeEqual(sig, referenceSignature(secret, app, orgId))
    ? { kind: "valid", orgId }
    : { kind: "invalid" };
}

/** The URL the checkout route redirects to: the payment link with the reference and the e-mail. */
export function checkoutUrl(link: string, orgId: string, email: string, secret: string): string {
  const ref = signOrgReference(orgId, secret);
  const sep = link.includes("?") ? "&" : "?";
  return `${link}${sep}client_reference_id=${ref}&prefilled_email=${encodeURIComponent(email)}`;
}

/** The value of the x-plan-sync-signature header for a body (used by tests and the relay). */
export function signSyncBody(body: string, secret: string, t: number = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

/** Checks the x-plan-sync-signature header against the raw body. */
export function verifySyncSignature(
  header: string | null,
  body: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
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
  if (Math.abs(nowSeconds - t) > SYNC_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return safeEqual(v1, expected);
}

/** A plan notice relayed by the storefront's Stripe webhook. */
export interface PlanSyncNotice {
  version: 1;
  eventId: string;
  eventType: string;
  kind: "paid" | "ended";
  subscriptionId: string;
  customerEmail: string | null;
  clientReferenceId: string | null;
  periodEnd: string | null;
  livemode: boolean;
}

const str = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 500;
const strOrNull = (v: unknown) => v === null || v === undefined || str(v);

/** Validates a relayed notice; null when malformed. */
export function parseSyncNotice(raw: unknown): PlanSyncNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!str(o.eventId) || !str(o.eventType) || !str(o.subscriptionId)) return null;
  if (o.kind !== "paid" && o.kind !== "ended") return null;
  if (!strOrNull(o.customerEmail) || !strOrNull(o.clientReferenceId) || !strOrNull(o.periodEnd)) {
    return null;
  }
  if (o.periodEnd && Number.isNaN(new Date(o.periodEnd as string).getTime())) return null;
  if (typeof o.livemode !== "boolean") return null;
  return {
    version: 1,
    eventId: o.eventId as string,
    eventType: o.eventType as string,
    kind: o.kind,
    subscriptionId: o.subscriptionId as string,
    customerEmail: (o.customerEmail as string | null | undefined) ?? null,
    clientReferenceId: (o.clientReferenceId as string | null | undefined) ?? null,
    periodEnd: (o.periodEnd as string | null | undefined) ?? null,
    livemode: o.livemode,
  };
}
