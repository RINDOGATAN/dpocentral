import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 200;

/**
 * Retry wrapper for Neon serverless transient errors.
 * Neon returns "Control plane request failed" with neon:retryable=true
 * when the compute endpoint is cold or the control plane hiccups.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    return (
      msg.includes("Control plane request failed") ||
      msg.includes("connection timed out") ||
      msg.includes("Connection terminated unexpectedly") ||
      msg.includes("connect ECONNREFUSED") ||
      msg.includes("Too many connections")
    );
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
        const delay = RETRY_BASE_MS * Math.pow(2, attempt); // 200, 400, 800ms
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const basePrisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

export const prisma =
  globalForPrisma.prisma ??
  basePrisma.$extends({
    query: {
      $allOperations({ args, query }) {
        return withRetry(() => query(args));
      },
    },
  });

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma as unknown as PrismaClient;

export default prisma;
