/**
 * Error-message sanitizer used by the tRPC error formatter and UI boundaries.
 *
 * Neon's serverless compute sometimes returns verbose Postgres-protocol
 * error bodies ("Control plane request failed", raw connection-reset
 * messages, etc.) during cold-start. Those strings are useless to an
 * end user and look alarming. We detect known-ugly patterns and replace
 * them with a clean "try again" message; everything else passes through.
 */

const TRANSIENT_DB_PATTERNS = [
  "Control plane request failed",
  "connection timed out",
  "Connection terminated unexpectedly",
  "connect ECONNREFUSED",
  "Can't reach database server",
  "the database system is starting up",
  "Too many connections",
  "neon:retryable",
];

const RAW_ORM_PATTERNS = [
  "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError",
  "PrismaClientInitializationError",
  "Invalid `prisma.",
];

const TRANSIENT_MESSAGE =
  "We're reconnecting to the service. Please try again in a moment.";

export function isTransientDbMessage(msg: string): boolean {
  return TRANSIENT_DB_PATTERNS.some((p) => msg.includes(p));
}

function isRawOrmDump(msg: string): boolean {
  return RAW_ORM_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Returns a message safe to show users.
 * - Transient DB errors → friendly retry copy.
 * - Raw ORM/driver dumps → fallback.
 * - Clean, human-authored messages (TRPCError text, validation errors) → passthrough.
 */
export function formatUserError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  if (!msg) return fallback;
  if (isTransientDbMessage(msg)) return TRANSIENT_MESSAGE;
  if (isRawOrmDump(msg)) return fallback;
  return msg;
}

export { TRANSIENT_MESSAGE };
