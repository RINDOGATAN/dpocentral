/**
 * Middleware for i18n locale detection, rate limiting, and CSP nonces
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";
import { authLimiter, checkoutLimiter, dsarPublicLimiter } from "./lib/rate-limit";

// next-intl middleware for locale routing
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
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
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://va.vercel-scripts.com https://t.sealmetrics.com`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://t.sealmetrics.com",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy-Report-Only", csp);
  response.headers.set("x-nonce", nonce);
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Rate limit auth routes
  if (pathname.startsWith("/api/auth")) {
    const result = authLimiter.check(`auth:${ip}`);
    if (!result.success) {
      return rateLimitResponse(result);
    }
  }

  // Rate limit checkout/billing routes
  if (pathname.startsWith("/api/checkout") || pathname.startsWith("/api/billing")) {
    const result = checkoutLimiter.check(`checkout:${ip}`);
    if (!result.success) {
      return rateLimitResponse(result);
    }
  }

  // Rate limit public DSAR intake (unauthenticated). Matches tRPC paths
  // like /api/trpc/dsar.submitPublic (including batched variants).
  if (pathname.startsWith("/api/trpc") && pathname.includes("dsar.submitPublic")) {
    const result = dsarPublicLimiter.check(`dsar-public:${ip}`);
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

  applyCsp(intlResponse);
  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
