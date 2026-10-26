// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Once, for organisations whose ready-made TODO.LAW transfer assessment was
 * created before it carried an approval request: adds the request, addressed
 * to the organisation's owner (else an administrator, else a privacy officer),
 * so the assessment can be approved or rejected
 * (src/server/services/todolaw-transfer-assessment.ts). Idempotent: an
 * assessment that already has an approval row, or is no longer waiting for
 * approval, is left alone. Nothing is approved.
 *
 *   npx tsx scripts/backfill-todolaw-tia-approval.ts             # dry run (default)
 *   npx tsx scripts/backfill-todolaw-tia-approval.ts --execute   # writes
 *
 * Refuses any database other than DPO Central's own (the hosted production
 * endpoint) or a local one. Prints organisation ids and counts only.
 */

import prisma from "../src/lib/prisma";
import { backfillTodoLawTiaApprovals } from "../src/server/services/todolaw-transfer-assessment";

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

  const rows = await backfillTodoLawTiaApprovals(prisma, { execute });
  for (const r of rows) console.log(`  ${r.organizationId}  ${r.outcome}`);
  const count = (o: string) => rows.filter((r) => r.outcome === o).length;
  console.log(
    `\n${rows.length} assessments: ${execute ? "requested" : "would request"} ${execute ? count("requested") : count("request")}, ` +
      `already with a request ${count("has-approval")}, no longer pending ${count("not-pending")}, no approver ${count("no-approver")}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
