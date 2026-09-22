// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cached probe behind GET /api/health.
 *
 * Healthy means both:
 *  - the database answers `SELECT 1` within DB_TIMEOUT_MS (2 s);
 *  - the last migration recorded in the database (finished, not rolled
 *    back) is the last migration of this build (BUILD_LAST_MIGRATION,
 *    inlined at build time from prisma/migrations, see build-info.ts).
 * Otherwise 503 with one reason word, "database" or "migrations", and no
 * detail. Only the migrations table is read, never user data.
 *
 * The result is kept in this process for HEALTH_CACHE_MS milliseconds
 * (default 10 000) so a burst of monitors costs one probe, not one per call.
 * Both answers are cached, so an outage does not turn the monitors into a
 * hammer on the database. HEALTH_CACHE_MS=0 probes on every call. The cache
 * is per process: on the hosted service every function instance keeps its
 * own (see docs/capacity.md).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import prisma from "@/lib/prisma";

export const DEFAULT_HEALTH_CACHE_MS = 10_000;
export const DB_TIMEOUT_MS = 2_000;

export type HealthReason = "database" | "migrations";

export interface HealthBody {
  status: "ok" | "degraded";
  reason?: HealthReason;
  db: "up" | "down";
  version: string;
  commit: string;
}

export interface HealthAnswer {
  body: HealthBody;
  status: 200 | 503;
  /** True when the answer came from the cache rather than a fresh probe. */
  fromCache: boolean;
}

let cached: { answer: HealthAnswer; until: number } | null = null;

export function healthCacheMs(): number {
  const raw = process.env.HEALTH_CACHE_MS?.trim();
  if (raw === undefined || raw === "") return DEFAULT_HEALTH_CACHE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_HEALTH_CACHE_MS;
}

/** The last migration of this build, inlined by next.config.ts. */
export function buildLastMigration(): string {
  return process.env.BUILD_LAST_MIGRATION ?? "";
}

/** The commit of this build, inlined by next.config.ts. */
export function buildCommitOfThisBuild(): string {
  return process.env.BUILD_COMMIT || "unknown";
}

/** Test hook: forget the cached probe. */
export function _resetHealthCacheForTests(): void {
  cached = null;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function probe(version: string): Promise<HealthAnswer> {
  const commit = buildCommitOfThisBuild();
  const degraded = (reason: HealthReason, db: "up" | "down"): HealthAnswer => ({
    body: { status: "degraded", reason, db, version, commit },
    status: 503,
    fromCache: false,
  });

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
  } catch {
    return degraded("database", "down");
  }

  const expected = buildLastMigration();
  // A build always knows its last migration; the check is skipped only for
  // a server started outside `next build` (nothing to compare against).
  if (expected) {
    try {
      const rows = await withTimeout(
        prisma.$queryRaw<{ migration_name: string }[]>`
          SELECT migration_name FROM "_prisma_migrations"
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
          ORDER BY migration_name DESC LIMIT 1`,
        DB_TIMEOUT_MS
      );
      if (rows[0]?.migration_name !== expected) return degraded("migrations", "up");
    } catch {
      return degraded("migrations", "up");
    }
  }

  return { body: { status: "ok", db: "up", version, commit }, status: 200, fromCache: false };
}

export async function getHealth(version: string): Promise<HealthAnswer> {
  const now = Date.now();
  const ttl = healthCacheMs();

  if (ttl > 0 && cached && cached.until > now) {
    return { ...cached.answer, fromCache: true };
  }

  const answer = await probe(version);
  cached = ttl > 0 ? { answer, until: now + ttl } : null;
  return answer;
}
