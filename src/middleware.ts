/**
 * Middleware for i18n locale detection, rate limiting, and CSP
 *
 * Rate limiting and CSP nonces require @dpocentral/security.
 * Without it, requests pass through without rate limits and CSP uses a static fallback.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";
import type { SecurityModule } from "./lib/security/types";

// next-intl middleware for locale routing
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // Only add prefix for non-default locales
});

// Attempt to load security module (optional dependency)
let security: SecurityModule | null = null;
try {
  // @ts-ignore — optional dependency, may not be installed
  const mod = await import(/* webpackIgnore: true */ "@dpocentral/security");
  security = mod as SecurityModule;
} catch {
  // Security package not installed — rate limiting and CSP nonces disabled
}

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

function applyCspToResponse(response: NextResponse) {
  if (security?.generateNonce && security?.applyCspHeaders) {
    const nonce = security.generateNonce();
    security.applyCspHeaders(response, nonce);
  }
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Rate limit auth/sign-in routes (when security package is installed)
  if (security && pathname.startsWith("/api/auth")) {
    const result = security.authLimiter.check(`auth:${ip}`);
    if (!result.success) {
      return rateLimitResponse(result);
    }
  }

  // Rate limit checkout/billing routes
  if (security && (pathname.startsWith("/api/checkout") || pathname.startsWith("/api/billing"))) {
    const result = security.checkoutLimiter.check(`checkout:${ip}`);
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
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
  }

  // Skip i18n for API routes, static files, and specific paths
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/dsar") || // Public DSAR portal
    pathname.includes(".") // Static files
  ) {
    const response = currencyResponse || NextResponse.next();
    applyCspToResponse(response);
    return response;
  }

  // Check if i18n is enabled via environment variable
  const i18nEnabled = process.env.NEXT_PUBLIC_I18N_ENABLED === "true";

  // If i18n is disabled, just pass through
  if (!i18nEnabled) {
    const response = currencyResponse || NextResponse.next();
    applyCspToResponse(response);
    return response;
  }

  // Use next-intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // Copy currency cookie to intl response if needed
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

  applyCspToResponse(intlResponse);
  return intlResponse;
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next|.*\\..*).*)"],
};
