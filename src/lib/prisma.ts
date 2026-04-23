import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends({
    query: {
      $allOperations({ args, query }) {
        return withRetry(() => query(args));
      },
    },
  });
}

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 300;
const RETRY_CAP_MS = 2000;

/**
 * Retry wrapper for Neon serverless transient errors.
 * Neon returns "Control plane request failed" with neon:retryable=true
 * when the compute endpoint is cold or the control plane hiccups.
 * Budget covers ~6s — enough for a cold compute wake-up on small tiers.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (
      msg.includes("Control plane request failed") ||
      msg.includes("connection timed out") ||
      msg.includes("Connection terminated unexpectedly") ||
      msg.includes("connect ECONNREFUSED") ||
      msg.includes("Too many connections") ||
      msg.includes("Can't reach database server") ||
      msg.includes("the database system is starting up")
    ) {
      return true;
    }
    const maybeMeta = (error as { meta?: { neon?: { retryable?: boolean } } }).meta;
    if (maybeMeta?.neon?.retryable === true) return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        const base = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_CAP_MS);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, base + jitter));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
