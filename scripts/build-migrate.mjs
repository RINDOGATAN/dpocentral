// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Applies pending migrations during `npm run build` (the hosted lane), with
 * retries for a database that is asleep or briefly unreachable, or for a
 * migration lock held by an overlapping build.
 *
 * 0. Skips on a Vercel build whose VERCEL_ENV is not "production". Production
 *    builds and a local `npm run build` migrate, as the build always did.
 * 1. Wakes the database with `SELECT 1` (via `prisma db execute`), retrying
 *    while it reports an unreachable or sleeping server.
 * 2. Runs `prisma migrate deploy`, retrying only on P1001 (cannot reach the
 *    server), P1002 (server reached but timed out) and the advisory-lock
 *    timeout. Any other failure exits non-zero at once, so a broken migration
 *    still fails the build.
 *
 * Retries back off exponentially (5 s doubling, capped at 60 s) inside a total
 * budget of 7 minutes (BUILD_MIGRATE_BUDGET_MS overrides it).
 *
 * Connection: the schema has a single `url` (DATABASE_URL, no `directUrl`),
 * so both steps use DATABASE_URL, as `migrate deploy` did before. Prisma's
 * output is printed with connection strings and host names redacted.
 *
 * The self-hosted Docker image and CI do not run `npm run build` (they call
 * `prisma generate` and `next build` directly; the self-hosted bundle migrates
 * in its own migrator service), so this script only affects builds that run
 * `npm run build`.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIRST_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
const SCHEMA = "prisma/schema.prisma";

const RETRYABLE = [
  /\bP1001\b/,
  /\bP1002\b/,
  /timed out trying to acquire a postgres advisory lock/i,
  /timed out acquiring advisory lock/i,
];

/**
 * Whether this build should migrate at all (step 0).
 * @param {Record<string, string | undefined>} [env]
 */
export function shouldMigrate(env = process.env) {
  const vercelEnv = env.VERCEL_ENV;
  return !vercelEnv || vercelEnv === "production";
}

/**
 * Whether Prisma's output shows a failure worth retrying.
 * @param {string} output
 */
export function isRetryable(output) {
  return RETRYABLE.some((re) => re.test(output));
}

/**
 * The wait after the given wait: doubling, capped at 60 s.
 * @param {number} delayMs
 */
export function nextDelay(delayMs) {
  return Math.min(delayMs * 2, MAX_DELAY_MS);
}

/**
 * Masks connection strings, password parameters and host names.
 * @param {string} text
 */
export function redact(text) {
  return text
    .replace(/postgres(ql)?:\/\/[^\s"'`]+/gi, "postgresql://[redacted]")
    .replace(/(password=)[^&\s"'`]+/gi, "$1[redacted]")
    .replace(/(server (?:is running )?at )`[^`]*`/gi, "$1`[redacted]`")
    .replace(/(schema "[^"]*" at )"[^"]*"/gi, '$1"[redacted]"');
}

function run(args, input) {
  const res = spawnSync("npx", ["--no-install", "prisma", ...args], {
    input,
    encoding: "utf8",
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const output = `${res.stdout ?? ""}${res.stderr ?? ""}${res.error ? `\n${res.error.message}` : ""}`;
  return { ok: res.status === 0, output };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!shouldMigrate()) {
    console.log(`[build-migrate] VERCEL_ENV=${process.env.VERCEL_ENV}: not a production build, migrations skipped.`);
    return;
  }

  const budgetMs = Number(process.env.BUILD_MIGRATE_BUDGET_MS) || 7 * 60 * 1000;
  const started = Date.now();

  async function withRetries(label, attempt) {
    let delay = FIRST_DELAY_MS;
    for (let n = 1; ; n++) {
      const { ok, output } = attempt();
      if (output.trim()) process.stdout.write(`${redact(output.trimEnd())}\n`);
      if (ok) return;
      const remaining = budgetMs - (Date.now() - started);
      if (!isRetryable(output)) {
        console.error(`[build-migrate] ${label} failed with a non-retryable error.`);
        process.exit(1);
      }
      if (remaining <= delay) {
        console.error(`[build-migrate] ${label} still failing after ${n} attempts; retry budget spent.`);
        process.exit(1);
      }
      console.log(`[build-migrate] ${label}: attempt ${n} hit a retryable error; retrying in ${delay / 1000} s.`);
      await sleep(delay);
      delay = nextDelay(delay);
    }
  }

  console.log("[build-migrate] Waking the database.");
  await withRetries("wake query", () => run(["db", "execute", "--stdin", "--schema", SCHEMA], "SELECT 1;"));

  console.log("[build-migrate] Applying migrations.");
  await withRetries("migrate deploy", () => run(["migrate", "deploy", "--schema", SCHEMA]));

  console.log(`[build-migrate] Done in ${Math.round((Date.now() - started) / 1000)} s.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`[build-migrate] unexpected error: ${redact(String(err?.message ?? err))}`);
    process.exit(1);
  });
}
