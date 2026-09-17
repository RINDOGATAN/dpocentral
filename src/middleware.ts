// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Middleware for i18n locale detection, rate limiting, and CSP nonces
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, type Locale } from "./i18n/config";
import { localeCookieCleanup, localeCookieWrites } from "./i18n/locale-cookie";
import {
  authLimiter,
  checkoutLimiter,
  cronLimiter,
  dsarPublicLimiter,
  healthLimiter,
  importLimiter,
  magicLinkLimiter,
  signInLimiter,
  type RateLimiter,
} from "./lib/rate-limit";
import { classifyRequest, type LimitedRoute } from "./lib/rate-limit-routes";

// One bucket per route class; a request is counted in exactly one of them.
// Ceilings and the RATE_LIMIT_* overrides live in src/lib/rate-limit.ts.
const limiters: Record<LimitedRoute, RateLimiter> = {
  magicLink: magicLinkLimiter,
  signIn: signInLimiter,
  auth: authLimiter,
  checkout: checkoutLimiter,
  dsarPublic: dsarPublicLimiter,
  health: healthLimiter,
  import: importLimiter,
  cron: cronLimiter,
};

// next-intl middleware for locale routing
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  // The language cookie is `locale`, written only by src/i18n/locale-cookie.ts
  // when the visitor chooses. next-intl must not write its own.
  localeCookie: false,
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitResponse(result: { limit: number; reset: number }) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let binary = "";
  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function applyCsp(response: NextResponse) {
  const nonce = generateNonce();

  // ENFORCED policy. Deliberately conservative on script-src ('unsafe-inline'
  // instead of nonces) because Next.js only attaches nonces to its inline
  // bootstrap scripts when the CSP travels on the *request* headers and every
  // route renders dynamically — enforcing the nonce policy today would blank
  // the app. What this still buys, enforced: no scripts from any third-party
  // origin except Stripe (kills the analytics-beacon class of regression),
  // no plugins, no <base> hijack, no form exfiltration, no framing.
  const isDev = process.env.NODE_ENV === "development";
  const enforced = [
    "default-src 'self'",
    // Next dev mode needs eval for react-refresh; production does not get it.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", enforced);

  // MIGRATION TARGET, still report-only: the strict nonce + strict-dynamic
  // policy. Violations show up in DevTools without breaking anything; when
  // nonce propagation to Next's inline scripts is wired (request-header CSP
  // + dynamic rendering), promote this to the enforced header above.
  const strict = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy-Report-Only", strict);
  response.headers.set("x-nonce", nonce);
}

/**
 * Language cookie on the way out. `chosen` is a language the visitor picked
 * through the request (the DSAR `?lang=` link): record it. Otherwise, collapse
 * duplicate `locale` cookies an older release left behind. Never a default.
 */
function applyLocaleCookies(response: NextResponse, request: NextRequest, chosen?: Locale) {
  const hostname = request.nextUrl.hostname;
  const cookies = chosen
    ? localeCookieWrites(chosen, hostname)
    : localeCookieCleanup(request.headers.get("cookie"), hostname);
  for (const cookie of cookies) {
    response.headers.append("Set-Cookie", cookie);
  }
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Rate limit the public and static-key API surface, one bucket per route
  // class (sign-in, magic link, other auth, checkout, public DSAR, health,
  // import, cron). Per-process counters — see src/lib/rate-limit.ts.
  const routeClass = classifyRequest(pathname, request.method);
  if (routeClass) {
    const result = limiters[routeClass].check(`${routeClass}:${ip}`);
    if (!result.success) {
      return rateLimitResponse(result);
    }
  }

  // Set currency cookie based on geo-IP (US -> USD, else EUR)
  const hasCurrency = request.cookies.has("currency");
  let currencyResponse: NextResponse | null = null;
  if (!hasCurrency) {
    const country = request.headers.get("x-vercel-ip-country") || "";
    const currency = country === "US" ? "USD" : "EUR";
    currencyResponse = NextResponse.next();
    currencyResponse.cookies.set("currency", currency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  // Skip i18n for API routes, static files, and specific paths
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/dsar") ||
    pathname.includes(".")
  ) {
    const response = currencyResponse || NextResponse.next();
    // Allow shareable locale-forced links into the public DSAR portal:
    // `/dsar/<slug>?lang=es` sets the `locale` cookie so SSR picks
    // the right language on first render (no JS-side flash).
    let chosen: Locale | undefined;
    if (pathname.startsWith("/dsar")) {
      const langParam = request.nextUrl.searchParams.get("lang");
      if (langParam && (locales as readonly string[]).includes(langParam)) {
        chosen = langParam as Locale;
      }
    }
    applyLocaleCookies(response, request, chosen);
    applyCsp(response);
    return response;
  }

  // Check if i18n locale routing is enabled
  // The intl middleware handles /es/* rewrites — only enable when NEXT_PUBLIC_I18N_ENABLED=true
  // Note: the language switcher (features.i18nEnabled) controls UI visibility separately;
  // it works without this by swapping messages via cookies, not URL prefixes.
  const i18nRoutingEnabled = process.env.NEXT_PUBLIC_I18N_ENABLED === "true";

  if (!i18nRoutingEnabled) {
    const response = currencyResponse || NextResponse.next();
    applyLocaleCookies(response, request);
    applyCsp(response);
    return response;
  }

  const intlResponse = intlMiddleware(request);

  if (currencyResponse) {
    const cookieValue = currencyResponse.cookies.get("currency")?.value;
    if (cookieValue) {
      intlResponse.cookies.set("currency", cookieValue, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    }
  }

  applyLocaleCookies(intlResponse, request);
  applyCsp(intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
