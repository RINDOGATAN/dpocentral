/**
 * Middleware for i18n locale detection
 *
 * This middleware uses next-intl to handle locale detection and routing.
 * When i18n is disabled (default), it allows requests through without modification.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";

// next-intl middleware for locale routing
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // Only add prefix for non-default locales
});

export default function middleware(request: NextRequest) {
  // Set currency cookie based on geo-IP (US → USD, else EUR)
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

  // Check if i18n is enabled via environment variable
  const i18nEnabled = process.env.NEXT_PUBLIC_I18N_ENABLED === "true";

  // Skip middleware for API routes, static files, and specific paths
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/dsar") || // Public DSAR portal
    pathname.includes(".") // Static files
  ) {
    return currencyResponse || NextResponse.next();
  }

  // If i18n is disabled, just pass through
  if (!i18nEnabled) {
    return currencyResponse || NextResponse.next();
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

  return intlResponse;
}

export const config = {
  // Match all routes except API routes and static files
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
