/**
 * GET /api/health — healthy only when the database answers within 2 s and
 * its last applied migration is this build's last migration
 * (src/lib/health-probe.ts). Prisma is module-mocked: no database.
 *
 * Locks: 200 carries status, db, version and commit and nothing else; 503
 * carries one reason word ("database", "migrations") and no detail; a
 * database slower than 2 s is "database"; a behind, ahead or missing
 * migrations table is "migrations"; the build's value matches the last
 * folder in prisma/migrations; one query set serves a burst inside
 * HEALTH_CACHE_MS; "degraded" is cached too; the cache expires;
 * HEALTH_CACHE_MS=0 probes every call; no-store.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

import { GET } from "@/app/api/health/route";
import {
  _resetHealthCacheForTests,
  healthCacheMs,
  DEFAULT_HEALTH_CACHE_MS,
  DB_TIMEOUT_MS,
} from "@/lib/health-probe";
import { lastMigrationInTree } from "@/lib/build-info";

const BUILD_MIGRATION = "20260919000000_pilot_started_at";

function isMigrationsQuery(args: unknown[]): boolean {
  const strings = args[0] as TemplateStringsArray;
  return strings.join("").includes("_prisma_migrations");
}

/** The database: SELECT 1 answers; the migrations table says `applied`. */
function database(applied: string | null | Error, selectOne: Promise<unknown> | null = null) {
  queryRaw.mockImplementation((...args: unknown[]) => {
    if (isMigrationsQuery(args)) {
      if (applied instanceof Error) return Promise.reject(applied);
      return Promise.resolve(applied === null ? [] : [{ migration_name: applied }]);
    }
    return selectOne ?? Promise.resolve([{ "?column?": 1 }]);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
  vi.clearAllMocks();
  _resetHealthCacheForTests();
  vi.stubEnv("BUILD_LAST_MIGRATION", BUILD_MIGRATION);
  vi.stubEnv("BUILD_COMMIT", "abc1234");
  database(BUILD_MIGRATION);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  _resetHealthCacheForTests();
});

describe("GET /api/health", () => {
  it("answers 200 ok with only status, db, version and commit, marked no-store", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Health-Cache")).toBe("miss");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["commit", "db", "status", "version"]);
    expect(body).toMatchObject({ status: "ok", db: "up", commit: "abc1234" });
  });

  it("answers 503 'database' when the database is unreachable", async () => {
    database(BUILD_MIGRATION, Promise.reject(new Error("Can't reach database server at 10.1.2.3")));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: "degraded", reason: "database", db: "down" });
    expect(JSON.stringify(body)).not.toContain("10.1.2.3");
  });

  it("answers 503 'database' when the database takes longer than 2 seconds", async () => {
    database(BUILD_MIGRATION, new Promise(() => {}));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(DB_TIMEOUT_MS + 1);
    const res = await pending;
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ reason: "database" });
  });

  it.each([
    ["behind the build", "20260717000000_embedded_ai_posture_and_generations"],
    ["ahead of the build", "20261231000000_from_a_newer_release"],
    ["empty", null],
  ])("answers 503 'migrations' when the recorded migrations are %s", async (_label, applied) => {
    database(applied);
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ status: "degraded", reason: "migrations", db: "up" });
    expect(JSON.stringify(body)).not.toContain("2026");
  });

  it("answers 503 'migrations' when the migrations table cannot be read", async () => {
    database(new Error('relation "_prisma_migrations" does not exist'));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ reason: "migrations" });
  });

  it("the build's last migration is the last folder in prisma/migrations", () => {
    const dir = path.join(__dirname, "..", "prisma", "migrations");
    const folders = readdirSync(dir).filter((n) => statSync(path.join(dir, n)).isDirectory()).sort();
    expect(lastMigrationInTree(path.join(__dirname, ".."))).toBe(folders[folders.length - 1]);
  });

  it("reads only the migrations table besides SELECT 1", async () => {
    await GET();
    const sql = queryRaw.mock.calls.map((c) => (c[0] as TemplateStringsArray).join("?"));
    expect(sql).toHaveLength(2);
    expect(sql[0]).toMatch(/^SELECT 1$/);
    expect(sql[1]).toMatch(/FROM "_prisma_migrations"/);
  });

  it("serves a burst from the cache with a single probe", async () => {
    for (let i = 0; i < 25; i++) {
      const res = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Health-Cache")).toBe(i === 0 ? "miss" : "hit");
    }
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("probes again once the cache has expired", async () => {
    await GET();
    vi.advanceTimersByTime(DEFAULT_HEALTH_CACHE_MS + 1);
    const res = await GET();
    expect(res.headers.get("X-Health-Cache")).toBe("miss");
    expect(queryRaw).toHaveBeenCalledTimes(4);
  });

  it("caches a degraded answer too, so an outage does not hammer the database", async () => {
    database(BUILD_MIGRATION, Promise.reject(new Error("Can't reach database server")));
    const first = await GET();
    expect(first.status).toBe(503);
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
    expect(queryRaw).toHaveBeenCalledTimes(4);

    vi.stubEnv("HEALTH_CACHE_MS", "soon");
    expect(healthCacheMs()).toBe(DEFAULT_HEALTH_CACHE_MS);
    vi.stubEnv("HEALTH_CACHE_MS", "2500");
    expect(healthCacheMs()).toBe(2500);
  });
});
