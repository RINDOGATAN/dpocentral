// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Sets an organisation's rights-request (DSAR) add-on on the hosted service.
 * Operator use only, modelled on scripts/set-org-plan.ts. DRY RUN BY DEFAULT:
 * it prints the before and after and writes nothing unless --execute is given.
 *
 *   npm run db:set-dsar-module -- --org <id or slug> --status ACTIVE \
 *     --subscription sub_123 --renews 2026-11-12            # dry run
 *   npm run db:set-dsar-module -- --org <id or slug> --status ACTIVE \
 *     --subscription sub_123 --renews 2026-11-12 --execute  # writes
 *
 * Options:
 *   --org           the organisation's id or slug (required)
 *   --status        ACTIVE (module open: 10 public-form requests per calendar
 *                   month, Madrid), CANCELLED or NONE (closed to new
 *                   requests; requests held stay readable) (required)
 *   --subscription  the payment provider's subscription id; "none" clears it;
 *                   default: kept
 *   --renews        next renewal, YYYY-MM-DD (UTC) or an ISO time; "none"
 *                   clears it; informative only; default: kept
 *   --by            who is making the change, for the audit entry (default
 *                   "operator")
 *   --execute       write the change (one audit-trail entry,
 *                   DSAR_MODULE_CHANGE, in the same transaction)
 *
 * The organisation must be on the paid plan (EU_CLOUD, scripts/set-org-plan.ts)
 * for the add-on to matter; a pilot organisation keeps the pilot's limit.
 * Exit codes: 0 done (or nothing to change), 1 refused input, 2 unexpected error.
 */

import { PrismaClient } from "@prisma/client";
import {
  DsarModuleInputError,
  isDsarModuleStatus,
  setDsarModule,
  type DsarModuleState,
  type SetDsarModuleInput,
} from "../src/server/services/dsar/set-module";

export function parseDateArg(name: string, value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === "none") return null;
  const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) throw new DsarModuleInputError(`--${name}: not a date: ${value}`);
  return d;
}

export function parseArgs(argv: string[]): SetDsarModuleInput {
  const values: Record<string, string> = {};
  let execute = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--execute") {
      execute = true;
      continue;
    }
    if (a === "--dry-run") continue; // the default; accepted for symmetry
    if (!a.startsWith("--")) throw new DsarModuleInputError(`Unexpected argument: ${a}`);
    const name = a.slice(2);
    if (!["org", "status", "subscription", "renews", "by"].includes(name)) {
      throw new DsarModuleInputError(`Unknown option: ${a}`);
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new DsarModuleInputError(`${a} needs a value.`);
    values[name] = v;
    i++;
  }
  if (!values.org) throw new DsarModuleInputError("--org is required (id or slug).");
  const status = (values.status ?? "").toUpperCase();
  if (!isDsarModuleStatus(status)) throw new DsarModuleInputError("--status must be ACTIVE, CANCELLED or NONE.");
  return {
    org: values.org,
    status,
    subscriptionId:
      values.subscription === undefined ? undefined : values.subscription === "none" ? null : values.subscription,
    renewsAt: parseDateArg("renews", values.renews),
    operator: values.by ?? "operator",
    execute,
  };
}

function show(label: string, s: DsarModuleState): string {
  return [
    `${label}:`,
    `  dsarModuleStatus          ${s.dsarModuleStatus ?? "-"}`,
    `  dsarModuleSubscriptionId  ${s.dsarModuleSubscriptionId ?? "-"}`,
    `  dsarModuleRenewsAt        ${s.dsarModuleRenewsAt ? s.dsarModuleRenewsAt.toISOString() : "-"}`,
  ].join("\n");
}

async function main(): Promise<number> {
  let input: SetDsarModuleInput;
  try {
    input = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  const prisma = new PrismaClient();
  try {
    const result = await setDsarModule(prisma, input);
    const o = result.organization;
    console.log(`Organisation: ${o.name} (id ${o.id}, slug ${o.slug}, plan ${o.plan})`);
    console.log(show("Before", result.before));
    console.log(show("After", result.after));
    if (result.note) console.log(`Note: ${result.note}`);
    if (!result.changed) console.log("Nothing to change.");
    else if (!input.execute) console.log("Dry run: nothing written. Add --execute to write.");
    else console.log("Written, with one audit-trail entry (DSAR_MODULE_CHANGE).");
    return 0;
  } catch (err) {
    if (err instanceof DsarModuleInputError) {
      console.error(err.message);
      return 1;
    }
    console.error(err);
    return 2;
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed, not when a test imports the parser.
if (process.argv[1] && /set-dsar-module\.ts$/.test(process.argv[1])) {
  main().then((code) => process.exit(code));
}
