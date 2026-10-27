// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Replaces the requester's details left in older rights-request (DSAR) audit
 * entries with a fixed marker, keeping the entries themselves
 * (src/server/services/dsar/audit-requester-redaction.ts).
 *
 *   # count only, change nothing (always run this first)
 *   npm run db:redact-dsar-audit-requester -- --dry-run --all
 *   npm run db:redact-dsar-audit-requester -- --dry-run --org <id-or-slug> [--org ...]
 *
 *   # redact (only after a backup branch of the database has been created)
 *   npm run db:redact-dsar-audit-requester -- --confirm --all
 *
 * Rules:
 *   - exactly one of --dry-run or --confirm is required; with neither, the
 *     script prints the usage and exits 2;
 *   - the organisations must be named (--org, repeatable) or --all given;
 *     --all also covers entries whose organisation was deleted. An unknown
 *     name stops the run before anything is written;
 *   - one transaction per organisation (maxWait 20 s, timeout 120 s); if the
 *     rows written differ from the rows planned, that organisation is rolled
 *     back and the run stops;
 *   - a second run finds nothing;
 *   - per organisation, the rows found, the NAMES of the fields redacted
 *     (with counts) and the row ids are printed and written to a JSON log,
 *     by default ./redact-dsar-audit-requester-<timestamp>.json (or
 *     --log <path>). Never a value.
 *
 * Run through the npm script so scripts/assert-safe-db.ts checks the database
 * address first. See docs/dsar-audit-requester-redaction.md.
 */

import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { redactDsarAuditRequester } from "../src/server/services/dsar/audit-requester-redaction";

export interface RedactArgs {
  dryRun: boolean;
  confirm: boolean;
  all: boolean;
  organizations: string[];
  logPath: string | null;
}

export function parseRedactArgs(argv: string[]): RedactArgs {
  const args: RedactArgs = { dryRun: false, confirm: false, all: false, organizations: [], logPath: null };
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
export function refusal(args: RedactArgs): string | null {
  if (args.dryRun === args.confirm) {
    return "Pass exactly one of --dry-run (count only) or --confirm (redact).";
  }
  if (args.all === args.organizations.length > 0) {
    return "Name the organisations with --org <id-or-slug>, or pass --all (not both).";
  }
  return null;
}

const USAGE = `Usage:
  npm run db:redact-dsar-audit-requester -- --dry-run (--org <id-or-slug> ... | --all) [--log <path>]
  npm run db:redact-dsar-audit-requester -- --confirm (--org <id-or-slug> ... | --all) [--log <path>]`;

async function main(): Promise<number> {
  let args: RedactArgs;
  try {
    args = parseRedactArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(USAGE);
    return 2;
  }
  const refused = refusal(args);
  if (refused) {
    console.error(refused);
    console.error(USAGE);
    return 2;
  }

  const prisma = new PrismaClient();
  try {
    const result = await redactDsarAuditRequester(prisma, {
      organizations: args.organizations,
      all: args.all,
      dryRun: args.dryRun,
    });
    const logPath =
      args.logPath ?? `redact-dsar-audit-requester-${result.startedAt.replace(/[:.]/g, "-")}.json`;
    fs.writeFileSync(logPath, JSON.stringify(result, null, 2) + "\n");

    console.log(result.dryRun ? "DRY RUN: nothing was written." : "Redacted.");
    for (const o of result.organizations) {
      const rows = o.auditLog.rows + o.requestTrail.rows;
      console.log(
        `${o.organizationId ?? "(deleted organisation)"}: ${rows} rows ` +
          `(audit_logs ${o.auditLog.rows}, dsar_audit_logs ${o.requestTrail.rows}) ` +
          `fields ${JSON.stringify({ ...o.auditLog.fields, ...o.requestTrail.fields })} redacted ${o.redacted}`
      );
    }
    console.log(`Totals: ${result.totals.rows} rows, redacted ${result.totals.redacted}, fields ${JSON.stringify(result.totals.fields)}`);
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
if (process.argv[1] && /redact-dsar-audit-requester\.ts$/.test(process.argv[1])) {
  main().then((code) => process.exit(code));
}
