// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * `prisma migrate deploy` for the hosted build, with retries for the two
 * transient failures a serverless Postgres produces at build time:
 *
 * - P1001 (database server unreachable): the compute is suspended and has not
 *   woken up yet, or the network blipped.
 * - P1002 / "timed out acquiring advisory lock": another `migrate deploy`
 *   (an overlapping build) holds Prisma's migration lock.
 *
 * Steps:
 * 1. Skip on a non-production Vercel build (VERCEL_ENV set and not
 *    "production"). Everywhere else (production builds, a local
 *    `npm run build`) it migrates, as the build script always did. The
 *    self-hosted Docker image and CI never call `npm run build`; they are
 *    not affected.
 * 2. Wake the database with `SELECT 1` (`prisma db execute`), retrying.
 * 3. Run `prisma migrate deploy`, retrying only on the transient errors
 *    above, with backoff, within a total budget (default 7 minutes,
 *    MIGRATE_RETRY_BUDGET_SECONDS overrides it). Any other error exits
 *    non-zero at once, and so does running out of budget.
 *
 * The schema has a single `url` (no `directUrl`), so Prisma connects with
 * DATABASE_URL as it did before. Output from Prisma is passed through with any
 * connection string masked; the URL itself is never printed.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_BUDGET_SECONDS = 7 * 60;
const BACKOFF_SECONDS = [10, 20, 30, 45, 60];

/**
 * Whether this build should migrate at all (see step 1).
 * @param {Record<string, string | undefined>} [env]
 */
export function shouldMigrate(env = process.env) {
  const vercelEnv = env.VERCEL_ENV;
  return !vercelEnv || vercelEnv === "production";
}

/** Whether Prisma's output shows a failure worth retrying. */
export function isTransientFailure(output) {
  return (
    /\bP1001\b/.test(output) ||
    /\bP1002\b/.test(output) ||
    /timed out acquiring advisory lock/i.test(output) ||
    /can't reach database server/i.test(output)
  );
}

/** The wait before attempt `n + 1` (n from 0), in seconds. */
export function backoffSeconds(n) {
  return BACKOFF_SECONDS[Math.min(n, BACKOFF_SECONDS.length - 1)];
}

/** Masks connection strings and password parameters in a line of output. */
export function redact(text) {
  return text
    .replace(/\b(postgres(?:ql)?|prisma(?:\+postgres)?):\/\/[^\s"'`]+/gi, "$1://***")
    .replace(/(password=)[^&\s"'`]+/gi, "$1***");
}

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

function prismaBin() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const local = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  return existsSync(local) ? local : "prisma";
}

/** Runs the Prisma CLI, streaming redacted output; resolves with the exit code and the combined output. */
function runPrisma(args, input) {
  return new Promise((resolve) => {
    const child = spawn(prismaBin(), args, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let output = "";
    const relay = (stream) => (chunk) => {
      const text = chunk.toString();
      output += text;
      stream.write(redact(text));
    };
    child.stdout.on("data", relay(process.stdout));
    child.stderr.on("data", relay(process.stderr));
    child.on("error", (err) => resolve({ code: 1, output: `${output}\n${err.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

const log = (msg) => console.log(`[migrate-deploy] ${msg}`);

async function main() {
  if (!shouldMigrate()) {
    log(`VERCEL_ENV=${process.env.VERCEL_ENV}: not a production build, migrations skipped.`);
    return 0;
  }

  const budget = Number(process.env.MIGRATE_RETRY_BUDGET_SECONDS) > 0
    ? Number(process.env.MIGRATE_RETRY_BUDGET_SECONDS)
    : DEFAULT_BUDGET_SECONDS;
  const deadline = Date.now() + budget * 1000;
  const remaining = () => Math.max(0, Math.round((deadline - Date.now()) / 1000));

  // Wake the database. A failure here is not fatal by itself: migrate deploy
  // below retries the same unreachable error within the same budget.
  for (let attempt = 0; ; attempt++) {
    log(`waking the database (attempt ${attempt + 1})`);
    const wake = await runPrisma(["db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], "SELECT 1;");
    if (wake.code === 0) {
      log("database is awake.");
      break;
    }
    if (!isTransientFailure(wake.output)) {
      log("wake query failed with a non-transient error; going on to migrate deploy, which reports it.");
      break;
    }
    const wait = backoffSeconds(attempt);
    if (wait >= remaining() || attempt >= 3) {
      log("database not reachable yet; going on to migrate deploy with retries.");
      break;
    }
    log(`database not reachable yet, retrying in ${wait}s (${remaining()}s left).`);
    await sleep(wait);
  }

  for (let attempt = 0; ; attempt++) {
    log(`prisma migrate deploy (attempt ${attempt + 1})`);
    const run = await runPrisma(["migrate", "deploy"]);
    if (run.code === 0) {
      log("migrations applied.");
      return 0;
    }
    if (!isTransientFailure(run.output)) {
      log(`migrate deploy failed (exit ${run.code}) with an error that is not retried.`);
      return run.code || 1;
    }
    const wait = backoffSeconds(attempt);
    if (wait >= remaining()) {
      log(`migrate deploy still failing with a transient error after ${budget}s; giving up.`);
      return run.code || 1;
    }
    log(`transient failure (unreachable database or migration lock held), retrying in ${wait}s (${remaining()}s left).`);
    await sleep(wait);
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[migrate-deploy] unexpected error: ${redact(String(err?.message ?? err))}`);
      process.exit(1);
    },
  );
}
