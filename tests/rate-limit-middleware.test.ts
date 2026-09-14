/**
 * Per-route rate limiting through the real middleware (src/middleware.ts).
 * Hermetic: next-intl's middleware factory is mocked, nothing else is.
 *
 * One case per limited route: the default ceiling is honoured, the next
 * request is refused with 429 + Retry-After, and the buckets are separate
 * (exhausting magic links does not block sign-in; exhausting sign-in does
 * not block session polling). Plus the disable switch and the client key.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "@/middleware";
import { _resetRateLimitsForTests } from "@/lib/rate-limit";

function req(path: string, method = "GET", ip = "203.0.113.7") {
  return new NextRequest(`http://localhost:3001${path}`, {
    method,
    headers: { "x-forwarded-for": ip },
  });
}

async function hit(path: string, method = "GET", ip?: string) {
  const res = await middleware(req(path, method, ip));
  return res as NextResponse;
}

/** Make `n` requests, asserting each one passes. */
async function passes(path: string, method: string, n: number, ip?: string) {
  for (let i = 0; i < n; i++) {
    const res = await hit(path, method, ip);
    expect(res.status, `request ${i + 1} of ${n} should pass`).not.toBe(429);
  }
}

/** Make `allowed` passing requests, then return the response to one more. */
async function exhaust(path: string, method: string, allowed: number, ip?: string) {
  await passes(path, method, allowed, ip);
  return hit(path, method, ip);
}

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

describe("middleware rate limits, per route", () => {
  it("sign-in: 10 per minute, then 429 with Retry-After", async () => {
    const refused = await exhaust("/api/auth/callback/dev-credentials", "POST", 10);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(refused.headers.get("X-RateLimit-Limit")).toBe("10");
    await expect(refused.json()).resolves.toEqual({
      error: "Too many requests. Please try again later.",
    });
  });

  it("magic links: 5 per 15 minutes, counted separately from sign-in", async () => {
    const refused = await exhaust("/api/auth/signin/email", "POST", 5);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("X-RateLimit-Limit")).toBe("5");

    // Sign-in is a different bucket: still open.
    const signIn = await hit("/api/auth/callback/dev-credentials", "POST");
    expect(signIn.status).not.toBe(429);

    // And it stays refused until the window moves.
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect((await hit("/api/auth/signin/email", "POST")).status).not.toBe(429);
  });

  it("other auth traffic (session polling): 30 per minute, unaffected by exhausted sign-in", async () => {
    await exhaust("/api/auth/callback/google", "GET", 10);
    const refused = await exhaust("/api/auth/session", "GET", 30);
    expect(refused.status).toBe(429);
  });

  it("health: 60 per minute", async () => {
    const refused = await exhaust("/api/health", "GET", 60);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("X-RateLimit-Limit")).toBe("60");
  });

  it("import (static-key routes): 60 per minute, shared with the template sync", async () => {
    await passes("/api/import/portfolio-vendors", "POST", 59);
    // 60th allowed, 61st refused — the admin sync route draws from the same bucket.
    expect((await hit("/api/admin/sync-templates", "POST")).status).not.toBe(429);
    expect((await hit("/api/import/check-account", "POST")).status).toBe(429);
  });

  it("cron: 10 per minute", async () => {
    const refused = await exhaust("/api/cron/dsar-redaction", "GET", 10);
    expect(refused.status).toBe(429);
  });

  it("checkout and billing: 10 per minute", async () => {
    await passes("/api/checkout", "POST", 9);
    expect((await hit("/api/billing/portal", "POST")).status).not.toBe(429);
    expect((await hit("/api/checkout", "POST")).status).toBe(429);
  });

  it("public DSAR intake: 5 per 10 minutes", async () => {
    const refused = await exhaust("/api/trpc/dsar.submitPublic", "POST", 5);
    expect(refused.status).toBe(429);
    // Authenticated tRPC is not limited here.
    expect((await hit("/api/trpc/dsar.list", "GET")).status).not.toBe(429);
  });

  it("keys the bucket by the first x-forwarded-for address", async () => {
    await exhaust("/api/health", "GET", 60, "198.51.100.1, 10.0.0.1");
    expect((await hit("/api/health", "GET", "198.51.100.1")).status).toBe(429);
    expect((await hit("/api/health", "GET", "198.51.100.2")).status).not.toBe(429);
  });

  it("RATE_LIMIT_DISABLED=true lets everything through (proxied installs)", async () => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "true");
    for (let i = 0; i < 12; i++) {
      expect((await hit("/api/auth/signin/email", "POST")).status).not.toBe(429);
    }
  });

  it("RATE_LIMIT_<NAME> overrides a single ceiling", async () => {
    vi.stubEnv("RATE_LIMIT_HEALTH", "2/60");
    const refused = await exhaust("/api/health", "GET", 2);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("X-RateLimit-Limit")).toBe("2");
    // Other buckets keep their defaults.
    expect((await hit("/api/cron/dsar-redaction", "GET")).status).not.toBe(429);
  });
});
