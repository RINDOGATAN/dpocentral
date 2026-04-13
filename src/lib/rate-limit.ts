/**
 * In-memory sliding-window rate limiter.
 *
 * For production at scale, replace with Upstash Redis (@upstash/ratelimit).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

export function rateLimit(config: RateLimitConfig) {
  return {
    check(key: string): RateLimitResult {
      cleanup(config.windowMs);

      const now = Date.now();
      const cutoff = now - config.windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

      if (entry.timestamps.length >= config.limit) {
        const oldestInWindow = entry.timestamps[0]!;
        return {
          success: false,
          remaining: 0,
          limit: config.limit,
          reset: oldestInWindow + config.windowMs,
        };
      }

      entry.timestamps.push(now);
      return {
        success: true,
        remaining: config.limit - entry.timestamps.length,
        limit: config.limit,
        reset: now + config.windowMs,
      };
    },
  };
}

// Pre-configured limiters
export const authLimiter = rateLimit({ limit: 30, windowMs: 60 * 1000 });
export const checkoutLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 });
// Public DSAR intake: 5 submissions per 10 minutes per IP
export const dsarPublicLimiter = rateLimit({ limit: 5, windowMs: 10 * 60 * 1000 });
// PDF export endpoints: 10 per minute per user (renderToBuffer is expensive)
export const exportLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 });
