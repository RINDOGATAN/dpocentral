// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Signing out: the session cookies, and which of them a sign-out must expire.
 *
 * A cookie is identified by name, domain and path. A session cookie written
 * WITHOUT a domain attribute is host-only; expiring the same name WITH a
 * domain does not remove it, and the reverse is equally true. The hosted
 * deployment has both kinds in circulation: the current cookie carries
 * `Domain=.todo.law` (`AUTH_COOKIE_DOMAIN`), and releases from before that
 * variable existed left a host-only cookie of the SAME name on the app's own
 * host. Expiring one name once therefore left the other cookie in place, and
 * the next request signed the user straight back in.
 *
 * So every name is expired twice: once host-only, once on the parent domain.
 * This is the language-cookie rule of `src/i18n/locale-cookie.ts` applied to
 * the session: one name, two cookies, both have to go.
 *
 * A host can only clear its OWN cookies, so clearing from this app cannot
 * reach a sibling's host-only cookie. The walk below closes that: the browser
 * is sent through each sibling's cross-logout endpoint in turn, each hop
 * carrying the address to return to, and the last one returns to this app's
 * sign-in page. The local cookies are expired on the FIRST response of the
 * walk, before any hop, so a sibling that is down or slow can never leave the
 * user signed in here.
 *
 * Pure functions only: no `process.env` read at module level and no Next
 * imports, so this is safe to import from client and server code alike, and
 * every rule is testable without a browser.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isHostedHost, HOSTED_COOKIE_DOMAIN } from "@/i18n/locale-cookie";

export const CROSS_LOGOUT_PATH = "/api/auth/cross-logout";
export const SUITE_LOGOUT_PATH = "/api/auth/suite-logout";

/** Where the walk ends: the sign-in page, saying the session is gone. */
export const SIGNED_OUT_PATH = "/sign-in?signedOut=1";

/** How long the whole walk may take before it gives up and lands the user. */
export const SUITE_LOGOUT_BUDGET_MS = 10_000;

type Env = Record<string, string | undefined>;

/**
 * Every session cookie name in circulation across the todo.law apps. One
 * browser can hold several of these at once (an app changed its cookie prefix,
 * or a sibling wrote its own on the shared localhost of the self-hosted kit),
 * so sign-out clears the whole list rather than guessing which one is live.
 *
 * CSRF cookies are deliberately absent: they carry no session, and the
 * `__Host-` ones cannot be expired with a domain at all.
 */
export const SESSION_COOKIE_NAMES = [
  // Dealroom + DPO Central (NextAuth v4, hosted default names)
  "__Secure-next-auth.session-token",
  "__Secure-next-auth.callback-url",
  "next-auth.session-token",
  "next-auth.callback-url",
  // DPO Central self-host posture (unique prefix — avoids the localhost
  // cross-app cookie collision on the suite)
  "__Secure-dpocentral.session-token",
  "__Secure-dpocentral.callback-url",
  "dpocentral.session-token",
  "dpocentral.callback-url",
  // Dealroom self-host posture (unique prefix)
  "__Secure-dealroom.session-token",
  "__Secure-dealroom.callback-url",
  "dealroom.session-token",
  "dealroom.callback-url",
  // AI Sentinel (NextAuth v4, unique prefix)
  "__Secure-aisentinel.session-token",
  "__Secure-aisentinel.callback-url",
  "aisentinel.session-token",
  "aisentinel.callback-url",
  // Seneca (NextAuth v5)
  "__Secure-authjs.session-token",
  "__Secure-authjs.callback-url",
  "authjs.session-token",
  "authjs.callback-url",
] as const;

/** The sibling products that share the hosted cloud with this one. */
const HOSTED_SIBLING_ORIGINS = [
  "https://dealroom.todo.law",
  "https://aisentinel.todo.law",
];

/**
 * The domain a session cookie of this deployment may also carry, if any.
 * `AUTH_COOKIE_DOMAIN` when the deployment opted into cross-app SSO, else
 * `.todo.law` on a hosted host (which is where releases before that variable
 * wrote their domain-wide cookie). Nothing on a self-host: its cookies are
 * host-only and a foreign domain would be rejected by the browser.
 */
export function parentCookieDomain(
  hostname: string | null | undefined,
  env: Env = {}
): string | undefined {
  const configured = (env.AUTH_COOKIE_DOMAIN ?? "").trim();
  if (configured) return configured.startsWith(".") ? configured : `.${configured}`;
  return isHostedHost(hostname) ? HOSTED_COOKIE_DOMAIN : undefined;
}

/**
 * `Set-Cookie` strings that expire every session cookie name: the host-only
 * cookie always, and the domain-wide one of the same name wherever a parent
 * domain applies. The attributes match what wrote them (`Path=/`, `HttpOnly`,
 * `SameSite=Lax`), because a deletion only matches on name, domain and path,
 * and `Secure` is kept on every `__Secure-`/`__Host-` name — a browser
 * discards a set of those names without it, deletion included.
 */
export function sessionCookieExpiries(
  hostname: string | null | undefined,
  options: { secure?: boolean; env?: Env } = {}
): string[] {
  const secure = options.secure ?? isHostedHost(hostname);
  const domain = parentCookieDomain(hostname, options.env ?? {});
  const writes: string[] = [];
  for (const name of SESSION_COOKIE_NAMES) {
    const prefixed = name.startsWith("__Secure-") || name.startsWith("__Host-");
    const base = `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
      secure || prefixed ? "; Secure" : ""
    }`;
    writes.push(base);
    if (domain) writes.push(`${base}; Domain=${domain}`);
  }
  return writes;
}

/**
 * The sibling cross-logout endpoints this deployment walks through, in order.
 * `SUITE_LOGOUT_URLS` (comma separated origins) overrides the list; on the
 * hosted cloud the default is the other two suite products. This app's own
 * host is never a hop.
 */
export function suiteLogoutHops(hostname: string | null | undefined, env: Env = {}): string[] {
  const configured = (env.SUITE_LOGOUT_URLS ?? "").trim();
  const origins = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : isHostedHost(hostname)
      ? HOSTED_SIBLING_ORIGINS
      : // Off the hosted cloud there is nothing to walk: the self-hosted kit
        // runs every app on one host, so expiring the names above already
        // reached the siblings' cookies.
        [];

  const hops: string[] = [];
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (hostname && url.hostname.toLowerCase() === hostname.toLowerCase()) continue;
    const endpoint = url.pathname === "/" ? CROSS_LOGOUT_PATH : url.pathname;
    const hop = `${url.origin}${endpoint}`;
    if (!hops.includes(hop)) hops.push(hop);
  }
  return hops;
}

/**
 * A return address we are willing to send the browser to: this app's own
 * origin, a host we walk through, or a sibling on the hosted cloud when we
 * are on it ourselves. Anything else, and anything unparseable, is refused so
 * the sign-out control can never be made into an open redirect.
 */
export function safeReturnTo(
  candidate: string | null | undefined,
  origin: string,
  allowedHosts: string[] = []
): string | null {
  if (!candidate) return null;
  let here: URL;
  try {
    here = new URL(origin);
  } catch {
    return null;
  }
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return new URL(candidate, here).toString();
  }
  let target: URL;
  try {
    target = new URL(candidate);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return null;
  const host = target.hostname.toLowerCase();
  if (host === here.hostname.toLowerCase()) return target.toString();
  if (allowedHosts.some((allowed) => allowed.toLowerCase() === host)) return target.toString();
  if (isHostedHost(here.hostname) && isHostedHost(host)) return target.toString();
  return null;
}

export type SuiteLogoutStep = {
  /** Where to send the browser next. */
  url: string;
  /** True when the walk is over and this is the landing page. */
  done: boolean;
};

/**
 * One step of the walk. Step 0 goes to the first sibling, each hop returns to
 * step n+1, and the step after the last hop — or any step taken after the
 * deadline, which is how a slow sibling is survived — lands on the sign-in
 * page. The deadline travels in the address, so a hop that answers late still
 * ends the walk instead of starting it again.
 */
export function suiteLogoutStep(input: {
  origin: string;
  hops: string[];
  step: number;
  deadline: number;
  now: number;
  returnTo?: string | null;
}): SuiteLogoutStep {
  const { origin, hops, step, deadline, now } = input;
  const landing = input.returnTo ?? new URL(SIGNED_OUT_PATH, origin).toString();
  if (!Number.isInteger(step) || step < 0 || step >= hops.length) {
    return { url: landing, done: true };
  }
  if (now >= deadline) return { url: landing, done: true };

  const back = new URL(SUITE_LOGOUT_PATH, origin);
  back.searchParams.set("step", String(step + 1));
  back.searchParams.set("deadline", String(deadline));
  const hop = new URL(hops[step]);
  hop.searchParams.set("next", back.toString());
  return { url: hop.toString(), done: false };
}

/** `step` from a query string: a whole number, or 0 for anything else. */
export function parseStep(value: string | null | undefined): number {
  const step = Number(value);
  return Number.isInteger(step) && step >= 0 ? step : 0;
}

/** `deadline` from a query string, never further out than a fresh budget. */
export function parseDeadline(
  value: string | null | undefined,
  now: number,
  budgetMs: number = SUITE_LOGOUT_BUDGET_MS
): number {
  const fresh = now + budgetMs;
  const deadline = Number(value);
  if (!Number.isFinite(deadline) || deadline <= 0) return fresh;
  return Math.min(deadline, fresh);
}
