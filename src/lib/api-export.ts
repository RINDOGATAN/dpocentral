// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { exportLimiter } from "./rate-limit";
import { logger } from "./logger";
import { cookieValues, LEGACY_LOCALE_COOKIE, LOCALE_COOKIE } from "@/i18n/locale-cookie";

/**
 * Helpers shared by the PDF/CSV export routes under src/app/api/export/**.
 */

function getClientKey(request: Request, userEmail: string | undefined): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return userEmail ? `export:${userEmail}` : `export:${ip}`;
}

/**
 * Returns a 429 Response if the caller is over their export rate limit,
 * otherwise null. Call before doing expensive work.
 */
/** The reader's language for the "too many exports" page: the locale cookie, else the browser's. */
function exportLocale(request: Request): "en" | "es" {
  const cookie = request.headers.get("cookie");
  const fromCookie = [...cookieValues(cookie, LOCALE_COOKIE), ...cookieValues(cookie, LEGACY_LOCALE_COOKIE)].pop();
  if (fromCookie === "es" || fromCookie === "en") return fromCookie;
  return /^\s*es\b/i.test(request.headers.get("accept-language") ?? "") ? "es" : "en";
}

const TOO_MANY = {
  en: {
    title: "Please wait a moment",
    body: "You have downloaded many exports in a short time. Wait a minute, then try this one again.",
  },
  es: {
    title: "Espera un momento",
    body: "Has descargado muchas exportaciones en poco tiempo. Espera un minuto y vuelve a intentarlo.",
  },
} as const;

/**
 * Returns a 429 Response if the caller is over their export rate limit,
 * otherwise null. Call before doing expensive work. Exports open in a new
 * tab, so the answer is a short page in the reader's language, not JSON.
 */
export function checkExportRateLimit(
  request: Request,
  userEmail: string | undefined
): Response | null {
  const result = exportLimiter.check(getClientKey(request, userEmail));
  if (!result.success) {
    const locale = exportLocale(request);
    const text = TOO_MANY[locale];
    const html =
      `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${text.title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">` +
      `<h1 style="font-size:1.25rem">${text.title}</h1><p>${text.body}</p></body></html>`;
    return new Response(html, {
      status: 429,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  return null;
}

/**
 * Wraps renderToBuffer (or any export work) so an unhandled exception
 * doesn't return a blank response. Logs the error and returns 500 JSON.
 */
export function pdfErrorResponse(err: unknown, route: string): Response {
  logger.error(`PDF export failed in ${route}`, err);
  const message = err instanceof Error ? err.message : "PDF generation failed";
  return Response.json(
    { error: "Failed to generate report", detail: message },
    { status: 500 }
  );
}
