/**
 * GET /api/health — the database probe is cached per process
 * (src/lib/health-probe.ts). Prisma is module-mocked: no database.
 *
 * Locks: one query serves a burst inside HEALTH_CACHE_MS; "degraded" is
 * cached too; the cache expires; HEALTH_CACHE_MS=0 probes every call; the
 * response never carries tenant data and is marked no-store.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

import { GET } from "@/app/api/health/route";
import { _resetHealthCacheForTests, healthCacheMs, DEFAULT_HEALTH_CACHE_MS } from "@/lib/health-probe";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
  vi.clearAllMocks();
  _resetHealthCacheForTests();
  queryRaw.mockResolvedValue([{ "?column?": 1 }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  _resetHealthCacheForTests();
});

describe("GET /api/health", () => {
  it("answers 200 ok with only status, db and version, marked no-store", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Health-Cache")).toBe("miss");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["db", "status", "version"]);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("up");
  });

  it("serves a burst from the cache with a single database query", async () => {
    for (let i = 0; i < 25; i++) {
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Health-Cache")).toBe(i === 0 ? "miss" : "hit");
    }
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("probes again once the cache has expired", async () => {
    await GET();
    vi.advanceTimersByTime(DEFAULT_HEALTH_CACHE_MS + 1);
    const res = await GET();
    expect(res.headers.get("X-Health-Cache")).toBe("miss");
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("caches a degraded answer too, so an outage does not hammer the database", async () => {
    queryRaw.mockRejectedValue(new Error("Can't reach database server"));
    const first = await GET();
    expect(first.status).toBe(503);
    await expect(first.json()).resolves.toMatchObject({ status: "degraded", db: "down" });
    const second = await GET();
    expect(second.status).toBe(503);
    expect(second.headers.get("X-Health-Cache")).toBe("hit");
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("HEALTH_CACHE_MS=0 probes on every call; a malformed value keeps the default", async () => {
    vi.stubEnv("HEALTH_CACHE_MS", "0");
    expect(healthCacheMs()).toBe(0);
    await GET();
    await GET();
    expect(queryRaw).toHaveBeenCalledTimes(2);

    vi.stubEnv("HEALTH_CACHE_MS", "soon");
    expect(healthCacheMs()).toBe(DEFAULT_HEALTH_CACHE_MS);
    vi.stubEnv("HEALTH_CACHE_MS", "2500");
    expect(healthCacheMs()).toBe(2500);
  });
});
