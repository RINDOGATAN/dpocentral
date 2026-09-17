// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The language cookie, shared by every todo.law app.
 *
 * One cookie: `locale`, `en` or `es`, `Path=/`, one year, `SameSite=Lax`.
 * On a hosted host (todo.law or a subdomain) it always carries
 * `Domain=.todo.law`; anywhere else (the kit, localhost) it is host-only.
 *
 * This module is the only code that writes `locale`, and the only place that
 * decides how it is read: the LAST `locale` value in a Cookie header or in
 * `document.cookie` wins, on the server and in the browser alike. Nothing
 * writes the cookie unless the visitor chose a language; without it the app
 * renders English.
 *
 * `NEXT_LOCALE` is the name older releases used. It is still read when no
 * `locale` value is present, so a self-hoster's earlier choice survives the
 * upgrade, and every write expires it. Nothing writes it any more.
 *
 * Pure functions plus two browser helpers; safe to import from client and
 * server code. The server reader that needs `next/headers` lives in
 * `server-locale.ts`.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { isValidLocale, type Locale } from "./config";

export const LOCALE_COOKIE = "locale";
export const LEGACY_LOCALE_COOKIE = "NEXT_LOCALE";
export const HOSTED_COOKIE_DOMAIN = ".todo.law";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** todo.law itself or any of its subdomains. */
export function isHostedHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return host === "todo.law" || host.endsWith(".todo.law");
}

/** Every value of `name` in a Cookie header (or `document.cookie`), in order. */
export function cookieValues(cookieHeader: string | null | undefined, name: string): string[] {
  if (!cookieHeader) return [];
  const values: string[] = [];
  for (const pair of cookieHeader.split(/;\s*/)) {
    const at = pair.indexOf("=");
    if (at === -1 || pair.slice(0, at).trim() !== name) continue;
    const raw = pair.slice(at + 1).trim();
    try {
      values.push(decodeURIComponent(raw));
    } catch {
      values.push(raw);
    }
  }
  return values;
}

/**
 * The visitor's language from a Cookie header: the LAST `locale` value, or,
 * when there is none, the last legacy `NEXT_LOCALE` value. Null when absent
 * or not a supported language.
 */
export function localeFromCookieHeader(cookieHeader: string | null | undefined): Locale | null {
  let values = cookieValues(cookieHeader, LOCALE_COOKIE);
  if (!values.length) values = cookieValues(cookieHeader, LEGACY_LOCALE_COOKIE);
  const candidate = values[values.length - 1];
  return candidate && isValidLocale(candidate) ? candidate : null;
}

/** Same rule for a name-based getter (tRPC context, `cookies().get`). */
export function localeFromCookieGetter(
  get: (name: string) => string | undefined
): Locale | undefined {
  const candidate = get(LOCALE_COOKIE) ?? get(LEGACY_LOCALE_COOKIE);
  return candidate && isValidLocale(candidate) ? candidate : undefined;
}

/** Expires a host-only cookie (no Domain attribute). */
function expireHostOnly(name: string): string {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * The cookie strings that record `locale` for `hostname`, in the order they
 * must be applied. On a hosted host: expire the host-only duplicate, then
 * write the domain-wide cookie. Elsewhere: the host-only cookie. The legacy
 * `NEXT_LOCALE` cookie is expired in both cases.
 */
export function localeCookieWrites(locale: Locale, hostname: string | null | undefined): string[] {
  const writes = [expireHostOnly(LEGACY_LOCALE_COOKIE)];
  const value = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
  if (isHostedHost(hostname)) {
    writes.push(expireHostOnly(LOCALE_COOKIE));
    writes.push(`${value}; Domain=${HOSTED_COOKIE_DOMAIN}`);
  } else {
    writes.push(value);
  }
  return writes;
}

/**
 * Clean-up for visitors who already carry two `locale` cookies (a host-only
 * one written by an older release and the domain-wide one). On a hosted host
 * with more than one value: expire the host-only one and re-write the
 * domain-wide one with the value read under the last-value rule, so the next
 * request carries exactly one. Otherwise: nothing.
 */
export function localeCookieCleanup(
  cookieHeader: string | null | undefined,
  hostname: string | null | undefined
): string[] {
  if (!isHostedHost(hostname)) return [];
  if (cookieValues(cookieHeader, LOCALE_COOKIE).length < 2) return [];
  const locale = localeFromCookieHeader(cookieHeader);
  if (!locale) return [expireHostOnly(LOCALE_COOKIE)];
  return [
    expireHostOnly(LOCALE_COOKIE),
    `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax; Domain=${HOSTED_COOKIE_DOMAIN}`,
  ];
}

// ----- Browser helpers -----

/** The visitor's language in the browser, under the same last-value rule. */
export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  return localeFromCookieHeader(document.cookie);
}

/** The only browser code that writes `locale`. Call it when the visitor chooses. */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  for (const cookie of localeCookieWrites(locale, window.location.hostname)) {
    document.cookie = cookie;
  }
}

/** On page load: collapse duplicate `locale` cookies into the domain-wide one. */
export function cleanUpLocaleCookies(): void {
  if (typeof document === "undefined") return;
  for (const cookie of localeCookieCleanup(document.cookie, window.location.hostname)) {
    document.cookie = cookie;
  }
}
