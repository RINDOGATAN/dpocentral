// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * In-memory sliding-window rate limiter.
 *
 * LIMITATION — the counters are PER PROCESS. The store lives in the memory
 * of the process that answered the request:
 *   - on the sovereign bundle (one Node process) that is one global limit;
 *   - on the hosted service (Vercel) every function instance keeps its own
 *     counters, so the effective ceiling is `limit × instances`, and a
 *     counter resets whenever an instance is recycled.
 * The limits are therefore a brake on abuse, not an exact quota. A shared
 * store (Redis or a database table) is the replacement when a single global
 * limit is required — see docs/capacity.md.
 *
 * The client is identified by the first `x-forwarded-for` address (or
 * `x-real-ip`). That header is trustworthy only behind a reverse proxy that
 * sets it (Vercel, the sovereign TLS profile's Caddy). An install reached
 * directly, with no proxy, sees no such header: every client then shares
 * one bucket ("unknown"), and a client can forge the header. Such installs
 * should either front the app with a proxy or disable the limiter and rely
 * on the proxy's own.
 *
 * Configuration (env, read on first use of each limiter):
 *   RATE_LIMIT_DISABLED=true            switch every limiter off (installs
 *                                       whose reverse proxy already limits)
 *   RATE_LIMIT_<NAME>="<count>/<seconds>" override one limiter's ceiling,
 *                                       e.g. RATE_LIMIT_SIGNIN="20/60".
 *                                       Malformed values fall back to the
 *                                       built-in default.
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

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

/** True when RATE_LIMIT_DISABLED is set to "true" (read per call, so tests and runtime toggles see it). */
export function isRateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED?.trim().toLowerCase() === "true";
}

/**
 * Parse a "<count>/<seconds>" override. Returns null for anything that is
 * not two positive integers, so a typo can never yield a zero window or a
 * zero limit (which would lock everyone out).
 */
export function parseRateLimitOverride(value: string | undefined): RateLimitConfig | null {
  if (!value) return null;
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(value);
  if (!match) return null;
  const limit = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isInteger(limit) || !Number.isInteger(seconds) || limit < 1 || seconds < 1) {
    return null;
  }
  return { limit, windowMs: seconds * 1000 };
}

/** The env variable that overrides a named limiter: RATE_LIMIT_<NAME>. */
export function rateLimitEnvName(name: string): string {
  return `RATE_LIMIT_${name.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`;
}

export interface RateLimiter {
  /** The limiter's name (used for the env override and the bucket key prefix). */
  readonly name: string | undefined;
  /** The effective configuration (default, or the env override). */
  config(): RateLimitConfig;
  check(key: string): RateLimitResult;
}

/**
 * Build a limiter. When `name` is given, `RATE_LIMIT_<NAME>` overrides the
 * defaults; the override is resolved on first use and cached for the life
 * of the process (`_resetRateLimitsForTests` clears it).
 */
export function rateLimit(defaults: RateLimitConfig, name?: string): RateLimiter {
  let resolved: RateLimitConfig | null = null;

  function config(): RateLimitConfig {
    if (resolved) return resolved;
    const override = name ? parseRateLimitOverride(process.env[rateLimitEnvName(name)]) : null;
    resolved = override ?? defaults;
    return resolved;
  }

  const limiter: RateLimiter = {
    name,
    config,
    check(key: string): RateLimitResult {
      const cfg = config();
      const now = Date.now();

      if (isRateLimitDisabled()) {
        return { success: true, remaining: cfg.limit, limit: cfg.limit, reset: now + cfg.windowMs };
      }

      cleanup(cfg.windowMs);
      const cutoff = now - cfg.windowMs;

      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

      if (entry.timestamps.length >= cfg.limit) {
        const oldestInWindow = entry.timestamps[0]!;
        return {
          success: false,
          remaining: 0,
          limit: cfg.limit,
          reset: oldestInWindow + cfg.windowMs,
        };
      }

      entry.timestamps.push(now);
      return {
        success: true,
        remaining: cfg.limit - entry.timestamps.length,
        limit: cfg.limit,
        reset: now + cfg.windowMs,
      };
    },
  };

  registry.push(() => {
    resolved = null;
  });
  return limiter;
}

const registry: Array<() => void> = [];

/** Test hook: forget every counter and every cached env override. */
export function _resetRateLimitsForTests(): void {
  store.clear();
  lastCleanup = Date.now();
  for (const reset of registry) reset();
}

// ---------------------------------------------------------------------------
// Pre-configured limiters. Each one is keyed by client address in the
// middleware (src/middleware.ts, via src/lib/rate-limit-routes.ts) unless
// noted. Override any of them with RATE_LIMIT_<NAME>="<count>/<seconds>".
// ---------------------------------------------------------------------------

/** Sign-in attempts: credential and OAuth callbacks, magic-link consumption, dev login. 10 per minute. */
export const signInLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 }, "SIGNIN");
/** Magic-link e-mail requests (POST /api/auth/signin/email). 5 per 15 minutes — each one sends an e-mail. */
export const magicLinkLimiter = rateLimit({ limit: 5, windowMs: 15 * 60 * 1000 }, "MAGIC_LINK");
/** Every other /api/auth request (session, csrf, providers, signout). 30 per minute. */
export const authLimiter = rateLimit({ limit: 30, windowMs: 60 * 1000 }, "AUTH");
/** Checkout and billing portal. 10 per minute. */
export const checkoutLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 }, "CHECKOUT");
/** Public DSAR intake and withdrawal (unauthenticated). 5 per 10 minutes. */
export const dsarPublicLimiter = rateLimit({ limit: 5, windowMs: 10 * 60 * 1000 }, "DSAR_PUBLIC");
/** PDF export endpoints, keyed by user e-mail (renderToBuffer is expensive). 10 per minute. */
export const exportLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 }, "EXPORT");
/** Public health probe. 60 per minute; the route also caches its database probe. */
export const healthLimiter = rateLimit({ limit: 60, windowMs: 60 * 1000 }, "HEALTH");
/** Static-key routes: /api/import/* and /api/admin/sync-templates. 60 per minute. */
export const importLimiter = rateLimit({ limit: 60, windowMs: 60 * 1000 }, "IMPORT");
/** Cron triggers (/api/cron/*). 10 per minute. */
export const cronLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 }, "CRON");
