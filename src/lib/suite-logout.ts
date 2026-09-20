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
 * Pure functions only: no `process.env` read at module level and no Next
 * imports, so this is safe to import from client and server code alike, and
 * every rule is testable without a browser.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isHostedHost, HOSTED_COOKIE_DOMAIN } from "@/i18n/locale-cookie";

export const CROSS_LOGOUT_PATH = "/api/auth/cross-logout";

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
