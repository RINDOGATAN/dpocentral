import { exportLimiter } from "./rate-limit";
import { logger } from "./logger";

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
export function checkExportRateLimit(
  request: Request,
  userEmail: string | undefined
): Response | null {
  const result = exportLimiter.check(getClientKey(request, userEmail));
  if (!result.success) {
    return Response.json(
      { error: "Too many export requests. Please try again in a minute." },
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
