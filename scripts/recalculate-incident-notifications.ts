// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Recalculates the notification flag and deadline (GDPR Art. 33) on the
 * incidents already stored, with the rule the incident router applies
 * (src/server/services/incidents/notification-assessment.ts). The rule exists
 * in TypeScript only, so this is a script rather than an SQL migration.
 * Operator use only. DRY RUN BY DEFAULT: it prints the counts before and
 * after and every incident that would change (ids only), and writes nothing
 * unless --execute is given.
 *
 *   npm run db:recalculate-incident-notifications                 # dry run
 *   npm run db:recalculate-incident-notifications -- --execute    # writes
 *
 * Options:
 *   --org <id>   only this organisation's incidents (default: all)
 *   --execute    write the changes: flag and deadline, one timeline entry
 *                and one audit entry per incident changed, and the PENDING
 *                authority notifications for an open incident that becomes
 *                notifiable with none recorded
 *   --json       print the report as JSON
 *
 * Idempotent: a second run reports nothing to change.
 * Exit codes: 0 done (or nothing to change), 1 refused input, 2 unexpected error.
 */

import { PrismaClient } from "@prisma/client";
import {
  recalculateIncidentNotifications,
  type RecalculationDb,
  type RecalculationReport,
} from "../src/server/services/incidents/recalculate-notifications";

export interface RecalculateArgs {
  execute: boolean;
  organizationId?: string;
  json: boolean;
}

export function parseArgs(argv: string[]): RecalculateArgs {
  const out: RecalculateArgs = { execute: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--execute") out.execute = true;
    else if (a === "--dry-run") continue; // the default; accepted for symmetry
    else if (a === "--json") out.json = true;
    else if (a === "--org") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error("--org needs a value.");
      out.organizationId = v;
      i++;
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

export function summary(r: RecalculationReport): string {
  const lines = [
    `Incidents scanned: ${r.scanned}`,
    `Flagged as requiring notification: ${r.requiredBefore} before, ${r.requiredAfter} after`,
    `Incidents to change: ${r.changes.length}`,
  ];
  for (const c of r.changes) {
    lines.push(
      `  ${c.id} (org ${c.organizationId}): required ${c.notificationRequired.from} -> ${c.notificationRequired.to}; ` +
        `deadline ${c.notificationDeadline.from ?? "-"} -> ${c.notificationDeadline.to ?? "-"}` +
        (c.pendingNotifications ? (r.execute ? "; PENDING authority notifications created" : "; PENDING authority notifications to create") : ""),
    );
  }
  if (r.changes.length === 0) lines.push("Nothing to change.");
  else if (!r.execute) lines.push("Dry run: nothing written. Add --execute to write.");
  else lines.push("Written.");
  return lines.join("\n");
}

async function main(): Promise<number> {
  let args: RecalculateArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  const prisma = new PrismaClient();
  try {
    const report = await recalculateIncidentNotifications(prisma as unknown as RecalculationDb, {
      execute: args.execute,
      organizationId: args.organizationId,
      transaction: (fn) => prisma.$transaction((tx) => fn(tx as unknown as RecalculationDb)),
    });
    console.log(args.json ? JSON.stringify(report, null, 2) : summary(report));
    return 0;
  } catch (err) {
    console.error(err);
    return 2;
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed, not when a test imports the parser.
if (process.argv[1] && /recalculate-incident-notifications\.ts$/.test(process.argv[1])) {
  main().then((code) => process.exit(code));
}
