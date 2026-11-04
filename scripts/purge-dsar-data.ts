// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Deletes every rights-request (DSAR) record of the named organisations:
 * requests, their tasks, messages, reminders and audit trail, the public
 * intake forms, the general audit entries about requests and the in-app
 * notifications about them (src/server/services/dsar/purge.ts).
 *
 *   # count only, change nothing (always run this first)
 *   npm run db:purge-dsar-data -- --dry-run --org <id-or-slug> [--org ...]
 *   npm run db:purge-dsar-data -- --dry-run --all
 *
 *   # delete (only after the module is off and the owners have exported)
 *   NEXT_PUBLIC_DSAR_ENABLED=false npm run db:purge-dsar-data -- --confirm --org <id-or-slug>
 *
 * Rules:
 *   - exactly one of --dry-run or --confirm is required; with neither, the
 *     script prints this help and exits 2;
 *   - the organisations must be named (--org, repeatable) or --all given;
 *     an unknown name stops the run before anything is read or deleted;
 *   - --confirm refuses to run unless NEXT_PUBLIC_DSAR_ENABLED=false is set
 *     in the environment of the run, as a deliberate statement that the
 *     module has been switched off where these records live;
 *   - one transaction per organisation; if anything is left after the
 *     deletion, that organisation is rolled back and the run stops;
 *   - the counts (found and deleted, per organisation and in total) are
 *     printed and written to a JSON log, by default
 *     ./purge-dsar-data-<timestamp>.json (or --log <path>). The log holds
 *     counts, organisation ids and slugs only, never a request's content.
 *
 * Run through the npm script so scripts/assert-safe-db.ts checks the database
 * address first.
 */

import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { purgeDsarData } from "../src/server/services/dsar/purge";

export interface PurgeArgs {
  dryRun: boolean;
  confirm: boolean;
  all: boolean;
  organizations: string[];
  logPath: string | null;
}

export function parsePurgeArgs(argv: string[]): PurgeArgs {
  const args: PurgeArgs = { dryRun: false, confirm: false, all: false, organizations: [], logPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm") args.confirm = true;
    else if (a === "--all") args.all = true;
    else if (a === "--org") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error("--org needs an organisation id or slug.");
      args.organizations.push(v);
    } else if (a === "--log") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error("--log needs a file path.");
      args.logPath = v;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

/** Why the run must not start, or null when it may. */
export function refusal(args: PurgeArgs, env: Record<string, string | undefined>): string | null {
  if (args.dryRun === args.confirm) {
    return "Pass exactly one of --dry-run (count only) or --confirm (delete).";
  }
  if (args.all === args.organizations.length > 0) {
    return "Name the organisations with --org <id-or-slug>, or pass --all (not both).";
  }
  if (args.confirm && env.NEXT_PUBLIC_DSAR_ENABLED !== "false") {
    return "--confirm needs NEXT_PUBLIC_DSAR_ENABLED=false in this run's environment: switch the module off first.";
  }
  return null;
}

const USAGE = `Usage:
  npm run db:purge-dsar-data -- --dry-run (--org <id-or-slug> ... | --all) [--log <path>]
  NEXT_PUBLIC_DSAR_ENABLED=false npm run db:purge-dsar-data -- --confirm (--org <id-or-slug> ... | --all) [--log <path>]`;

async function main(): Promise<number> {
  let args: PurgeArgs;
  try {
    args = parsePurgeArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(USAGE);
    return 2;
  }
  const refused = refusal(args, process.env);
  if (refused) {
    console.error(refused);
    console.error(USAGE);
    return 2;
  }

  const prisma = new PrismaClient();
  try {
    const result = await purgeDsarData(prisma, {
      organizations: args.organizations,
      all: args.all,
      dryRun: args.dryRun,
    });
    const logPath =
      args.logPath ?? `purge-dsar-data-${result.startedAt.replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(logPath, JSON.stringify(result, null, 2) + "\n");

    console.log(result.dryRun ? "DRY RUN: nothing was deleted." : "Deleted.");
    for (const o of result.organizations) {
      console.log(
        `${o.slug} (${o.organizationId}) found ${JSON.stringify(o.found)} deleted ${JSON.stringify(o.deleted)}`
      );
    }
    console.log(`Totals found ${JSON.stringify(result.totals.found)}`);
    console.log(`Totals deleted ${JSON.stringify(result.totals.deleted)}`);
    console.log(`Log written to ${logPath}`);
    return 0;
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed, not when imported by the tests.
if (process.argv[1] && /purge-dsar-data\.ts$/.test(process.argv[1])) {
  main().then((code) => process.exit(code));
}
