// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Preflight for every DB-touching npm script (`db:*`, `build`).
 *
 * DPO Central used to SHARE a database with vendor.watch
 * (`ep-broad-band-agodluqf`, decoupled 2026-07-07). Stale `.env.local` files
 * pointing at that host still exist on dev machines; seeding or migrating
 * against it would re-pollute vendor.watch's data. This guard turns that
 * documented footgun ("always confirm DATABASE_URL before any db:*") into a
 * hard stop.
 *
 * Resolution mirrors what Prisma actually uses: process.env.DATABASE_URL,
 * else the DATABASE_URL line of `.env` (Prisma CLI and the generated client
 * auto-load `.env`; they never load `.env.local`). If no URL is found the
 * guard stays silent and lets the downstream tool fail on its own.
 */

import * as fs from "fs";
import * as path from "path";

/** Host fragments of databases this app must NEVER write to. */
const FORBIDDEN_HOST_FRAGMENTS = [
  "ep-broad-band-agodluqf", // old shared vendor.watch Neon endpoint
];

function fromDotEnv(): string | undefined {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"#\s]+)"?/);
      if (m) return m[1];
    }
  } catch {
    // no .env — fine
  }
  return undefined;
}

const url = process.env.DATABASE_URL || fromDotEnv();

if (url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = url; // unparseable — still run the fragment check on the raw string
  }

  const hit = FORBIDDEN_HOST_FRAGMENTS.find((f) => url.includes(f));
  if (hit) {
    console.error(
      `\n✖ DATABASE_URL points at a FORBIDDEN host (${hit}).\n` +
        `  This is the old Neon database SHARED with vendor.watch — writing to it\n` +
        `  re-pollutes vendor.watch's data. DPO Central runs on its own database\n` +
        `  (neon-blue-planet) or a local DPO-only Postgres.\n` +
        `  Fix your environment (a stale .env/.env.local is the usual culprit)\n` +
        `  and re-run. See CLAUDE.md "Database — CRITICAL".\n`
    );
    process.exit(1);
  }

  console.log(`DB guard: ${host} ok`);
}
