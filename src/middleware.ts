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
    return NextResponse.next();
  }

  // If i18n is disabled, just pass through
  if (!i18nEnabled) {
    return NextResponse.next();
  }

  // Use next-intl middleware for locale handling
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except API routes and static files
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
