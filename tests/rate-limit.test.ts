/**
 * The in-memory limiter (src/lib/rate-limit.ts) and the request classifier
 * (src/lib/rate-limit-routes.ts). Hermetic: no database, no network.
 *
 * Locks: the sliding window (N allowed, the N+1th refused, the oldest hit
 * ages out), the RATE_LIMIT_<NAME> override format and its fallback on a
 * malformed value, the RATE_LIMIT_DISABLED switch for proxied installs,
 * and the one-bucket-per-request routing table.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rateLimit,
  parseRateLimitOverride,
  rateLimitEnvName,
  isRateLimitDisabled,
  _resetRateLimitsForTests,
} from "@/lib/rate-limit";
import { classifyRequest } from "@/lib/rate-limit-routes";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
  _resetRateLimitsForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  _resetRateLimitsForTests();
});

describe("rateLimit sliding window", () => {
  it("allows `limit` hits in the window and refuses the next one with a reset time", () => {
    const limiter = rateLimit({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("k").success).toBe(true);
    expect(limiter.check("k").success).toBe(true);
    const third = limiter.check("k");
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    const refused = limiter.check("k");
    expect(refused.success).toBe(false);
    expect(refused.limit).toBe(3);
    expect(refused.reset).toBe(Date.now() + 60_000);
  });

  it("lets the oldest hit age out of the window", () => {
    const limiter = rateLimit({ limit: 2, windowMs: 10_000 });
    limiter.check("k");
    vi.advanceTimersByTime(6_000);
    limiter.check("k");
    expect(limiter.check("k").success).toBe(false);
    vi.advanceTimersByTime(4_001); // first hit is now outside the window
    expect(limiter.check("k").success).toBe(true);
  });

  it("keeps separate keys separate", () => {
    const limiter = rateLimit({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a").success).toBe(true);
    expect(limiter.check("a").success).toBe(false);
    expect(limiter.check("b").success).toBe(true);
  });
});

describe("env configuration", () => {
  it("parses <count>/<seconds> and rejects anything else", () => {
    expect(parseRateLimitOverride("20/60")).toEqual({ limit: 20, windowMs: 60_000 });
    expect(parseRateLimitOverride(" 5 / 900 ")).toEqual({ limit: 5, windowMs: 900_000 });
    expect(parseRateLimitOverride("0/60")).toBeNull();
    expect(parseRateLimitOverride("10/0")).toBeNull();
    expect(parseRateLimitOverride("10")).toBeNull();
    expect(parseRateLimitOverride("ten/60")).toBeNull();
    expect(parseRateLimitOverride("")).toBeNull();
    expect(parseRateLimitOverride(undefined)).toBeNull();
  });

  it("derives the env name from the limiter name", () => {
    expect(rateLimitEnvName("SIGNIN")).toBe("RATE_LIMIT_SIGNIN");
    expect(rateLimitEnvName("magic-link")).toBe("RATE_LIMIT_MAGIC_LINK");
  });

  it("applies RATE_LIMIT_<NAME> and falls back to the default when malformed", () => {
    vi.stubEnv("RATE_LIMIT_TESTBUCKET", "2/30");
    const overridden = rateLimit({ limit: 10, windowMs: 60_000 }, "TESTBUCKET");
    expect(overridden.config()).toEqual({ limit: 2, windowMs: 30_000 });
    overridden.check("k");
    overridden.check("k");
    expect(overridden.check("k").success).toBe(false);

    vi.stubEnv("RATE_LIMIT_BROKEN", "lots");
    const broken = rateLimit({ limit: 10, windowMs: 60_000 }, "BROKEN");
    expect(broken.config()).toEqual({ limit: 10, windowMs: 60_000 });
  });

  it("RATE_LIMIT_DISABLED=true switches every limiter off", () => {
    const limiter = rateLimit({ limit: 1, windowMs: 60_000 }, "DISABLEME");
    expect(limiter.check("k").success).toBe(true);
    expect(limiter.check("k").success).toBe(false);

    vi.stubEnv("RATE_LIMIT_DISABLED", "true");
    expect(isRateLimitDisabled()).toBe(true);
    expect(limiter.check("k").success).toBe(true);
    expect(limiter.check("k").success).toBe(true);

    vi.stubEnv("RATE_LIMIT_DISABLED", "false");
    expect(isRateLimitDisabled()).toBe(false);
  });
});

describe("classifyRequest", () => {
  it.each([
    ["POST", "/api/auth/signin/email", "magicLink"],
    ["GET", "/api/auth/signin/email", "auth"], // the sign-in page render, not a send
    ["POST", "/api/auth/callback/dev-credentials", "signIn"],
    ["GET", "/api/auth/callback/google", "signIn"],
    ["GET", "/api/auth/callback/email", "signIn"], // magic-link consumption
    ["POST", "/api/auth/signin/google", "signIn"],
    ["GET", "/api/auth/dev-login", "signIn"],
    ["GET", "/api/auth/session", "auth"],
    ["GET", "/api/auth/csrf", "auth"],
    ["GET", "/api/auth/providers", "auth"],
    ["POST", "/api/auth/signout", "auth"],
    ["POST", "/api/checkout", "checkout"],
    ["POST", "/api/billing/portal", "checkout"],
    ["POST", "/api/trpc/dsar.submitPublic", "dsarPublic"],
    ["POST", "/api/trpc/dsar.withdrawPublic", "dsarPublic"],
    ["GET", "/api/trpc/dsar.list", null],
    ["GET", "/api/health", "health"],
    ["POST", "/api/import/check-account", "import"],
    ["POST", "/api/import/portfolio-vendors", "import"],
    ["POST", "/api/admin/sync-templates", "import"],
    ["GET", "/api/cron/dsar-redaction", "cron"],
    ["POST", "/api/webhooks/stripe", null],
    ["GET", "/api/export/ropa", null],
    ["GET", "/privacy", null],
  ])("%s %s → %s", (method, path, expected) => {
    expect(classifyRequest(path, method)).toBe(expected);
  });
});
