// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Once, for organisations opened before TODO.LAW was added at opening: adds
 * TODO.LAW (vendor, processing agreement, transfer to the United States) to
 * each hosted organisation's programme, as drafts to confirm
 * (src/server/services/todolaw-processor.ts). Idempotent.
 *
 *   npx tsx scripts/backfill-todolaw-vendor.ts             # dry run (default)
 *   npx tsx scripts/backfill-todolaw-vendor.ts --execute   # writes
 *
 * Refuses any database other than DPO Central's own (the hosted production
 * endpoint) or a local one. Prints organisation ids and counts only.
 */

import prisma from "../src/lib/prisma";
import { backfillTodoLawProcessor } from "../src/server/services/todolaw-processor";

/** DPO Central's hosted production endpoint, and local databases for testing. */
const ALLOWED_HOST_FRAGMENTS = ["ep-morning-mode", "localhost", "127.0.0.1"];

function databaseHost(): string {
  const url = process.env.DATABASE_URL ?? "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function main() {
  const execute = process.argv.includes("--execute");
  const host = databaseHost();
  if (!ALLOWED_HOST_FRAGMENTS.some((f) => host.includes(f))) {
    console.error(
      `Refused: DATABASE_URL must point at DPO Central's own database (host containing ${ALLOWED_HOST_FRAGMENTS.join(", ")}). Got: ${host || "(none)"}`,
    );
    process.exit(2);
  }
  console.log(`${execute ? "EXECUTE" : "DRY RUN"} against ${host}`);

  const rows = await backfillTodoLawProcessor(prisma, { execute });
  for (const r of rows) console.log(`  ${r.organizationId}  ${r.outcome}`);

  const count = (o: string) => rows.filter((r) => r.outcome === o).length;
  const toAdd = execute ? count("added") : count("add");
  console.log(
    `\n${rows.length} organisations: ${execute ? "added" : "would add"} ${toAdd} ` +
      `(1 vendor, 1 agreement, 1 transfer each), already present ${count("exists")}, ` +
      `no acceptance on record (left alone) ${count("no-acceptance")}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
