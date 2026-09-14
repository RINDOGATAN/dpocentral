// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Cached database probe behind GET /api/health.
 *
 * The probe result is kept in this process for HEALTH_CACHE_MS milliseconds
 * (default 10 000) so a burst of monitors costs one `SELECT 1`, not one per
 * call. Both answers are cached — "ok" and "degraded" — so an outage does
 * not turn the monitors into a hammer on the database. HEALTH_CACHE_MS=0
 * probes on every call. The cache is per process: on the hosted service
 * every function instance keeps its own (see docs/capacity.md).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import prisma from "@/lib/prisma";

export const DEFAULT_HEALTH_CACHE_MS = 10_000;

export interface HealthAnswer {
  body: { status: "ok" | "degraded"; db: "up" | "down"; version: string };
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

/** Test hook: forget the cached probe. */
export function _resetHealthCacheForTests(): void {
  cached = null;
}

async function probe(version: string): Promise<HealthAnswer> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { body: { status: "ok", db: "up", version }, status: 200, fromCache: false };
  } catch {
    return { body: { status: "degraded", db: "down", version }, status: 503, fromCache: false };
  }
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
