// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Once, for organisations whose TODO.LAW transfer was added before the
 * ready-made assessment existed: fills in the supplementary measures, the
 * Schrems II checklist and a transfer impact assessment waiting for the
 * organisation's approval (src/server/services/todolaw-transfer-assessment.ts).
 * Idempotent.
 *
 *   npx tsx scripts/backfill-todolaw-tia.ts             # dry run (default)
 *   npx tsx scripts/backfill-todolaw-tia.ts --execute   # writes
 *
 * Refuses any database other than DPO Central's own (the hosted production
 * endpoint) or a local one. Prints organisation ids and counts only.
 */

import prisma from "../src/lib/prisma";
import { backfillTodoLawTia } from "../src/server/services/todolaw-transfer-assessment";
import { latestDpaAcceptance } from "../src/server/services/todolaw-processor";

const ALLOWED_HOST_FRAGMENTS = ["ep-morning-mode", "localhost", "127.0.0.1"];

function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
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

  const rows = await backfillTodoLawTia(prisma, {
    execute,
    localeOf: async (id) => (await latestDpaAcceptance(prisma, id))?.locale ?? "en",
  });
  for (const r of rows) console.log(`  ${r.organizationId}  ${r.outcome}`);
  const count = (o: string) => rows.filter((r) => r.outcome === o).length;
  console.log(
    `\n${rows.length} organisations: ${execute ? "pre-filled" : "would pre-fill"} ${execute ? count("prefilled") : count("prefill")}, ` +
      `already done ${count("done")}, no TODO.LAW transfer ${count("no-transfer")}, no TIA template ${count("no-template")}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
