/**
 * Structured logger that sanitizes error output in production.
 * In development: full error details including stack traces.
 * In production: message only, no stack traces or sensitive context.
 */

const isDev = process.env.NODE_ENV === "development";

function sanitizeError(error: unknown): string {
  if (isDev) {
    if (error instanceof Error) {
      return `${error.message}\n${error.stack}`;
    }
    return String(error);
  }
  // Production: message only
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
}

function formatContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return "";
  return ` ${JSON.stringify(context)}`;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    console.log(`[INFO] ${message}${formatContext(context)}`);
  },

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(`[WARN] ${message}${formatContext(context)}`);
  },

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    if (error) {
      console.error(`[ERROR] ${message}: ${sanitizeError(error)}${formatContext(context)}`);
    } else {
      console.error(`[ERROR] ${message}${formatContext(context)}`);
    }
  },
};
