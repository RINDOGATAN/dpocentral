// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Shared, fixed-window counters kept in the database (table
 * rate_limit_counters), so every server instance counts against the same
 * total. The in-memory limiter (src/lib/rate-limit.ts) is per process: on the
 * hosted service each function instance keeps its own counters, so it is a
 * brake, not a quota. These counters are the quota.
 *
 * One SQL statement per hit (INSERT ... ON CONFLICT DO UPDATE ... RETURNING),
 * so two concurrent hits on the same bucket can never both read the old count.
 *
 * Personal data never reaches a key as typed: an IP address or an e-mail
 * address is turned into a keyed hash first (hashIdentifier), with the
 * server's secret, so the table cannot be reversed into addresses.
 *
 * Rows expire with their window; the daily DSAR redaction cron deletes the
 * expired ones (deleteExpiredCounters).
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { createHmac, randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The database calls these counters need; satisfied by the Prisma client. */
export type CounterDb = {
  $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
};

export type CounterCleanupDb = {
  rateLimitCounter: {
    deleteMany: (args: { where: { expiresAt: { lt: Date } } }) => Promise<{ count: number }>;
  };
};

// A per-process secret when the deployment has none. Every real deployment
// sets NEXTAUTH_SECRET (sign-in needs it), so this only serves local tests.
let fallbackSecret: string | null = null;

/** The server secret used to key hashes and sign the public form token. */
export function serverSecret(): string {
  const configured = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (configured) return configured;
  fallbackSecret ??= randomBytes(32).toString("hex");
  return fallbackSecret;
}

/**
 * A keyed hash of an address (IP or e-mail), for use in a counter key. The
 * value is trimmed and lower-cased first, so "Ana@Example.com " and
 * "ana@example.com" count as one address.
 */
export function hashIdentifier(kind: string, value: string): string {
  return createHmac("sha256", serverSecret())
    .update(`${kind}:${value.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

/** Start of the fixed window that contains `now`. */
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Adds one to the bucket `key` in the window that contains `now` and returns
 * the new count. Throws when the database refuses; callers decide whether to
 * fail open (see hitOrNull).
 */
export async function hitCounter(
  db: CounterDb,
  key: string,
  windowMs: number,
  now: Date = new Date()
): Promise<number> {
  const start = windowStart(now, windowMs);
  const expiresAt = new Date(start.getTime() + windowMs);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "rate_limit_counters" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${start}, 1, ${expiresAt})
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "rate_limit_counters"."count" + 1
    RETURNING "count"`;
  return Number(rows[0]?.count ?? 1);
}

/**
 * hitCounter, failing open: when the counter cannot be written (the database
 * is briefly unavailable) the hit is logged and null is returned, and the
 * caller lets the action through. A rights request is a legal obligation of
 * the organisation; a counter failure must not turn one away. The in-memory
 * limiter still applies in front of it.
 */
export async function hitOrNull(
  db: CounterDb,
  key: string,
  windowMs: number,
  now: Date = new Date()
): Promise<number | null> {
  try {
    return await hitCounter(db, key, windowMs, now);
  } catch (error) {
    logger.error("Shared rate-limit counter unavailable", error, { bucket: key.split(":")[0] });
    return null;
  }
}

/** Deletes counters whose window has ended. Returns how many were deleted. */
export async function deleteExpiredCounters(
  db: CounterCleanupDb,
  now: Date = new Date()
): Promise<number> {
  const { count } = await db.rateLimitCounter.deleteMany({ where: { expiresAt: { lt: now } } });
  return count;
}

/**
 * A positive whole number from the environment, else the default. A typo or a
 * zero never yields a limit that locks everyone out.
 */
export function envLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return value >= 1 ? value : fallback;
}
