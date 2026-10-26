// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Once, for organisations whose quick start drew client-side tools (web
 * analytics, session replay, tag managers, consent banners, ad pixels and the
 * like, src/config/client-side-collection.ts) as fed by the internal systems:
 * moves those unedited flows so that they start from the organisation's
 * "Public website and apps" record (created if missing), and moves the tool's
 * activity link with them (src/server/services/data-flows/public-properties.ts).
 * Flows a person changed or drew, and flows back from a tool, are left alone.
 * Idempotent.
 *
 *   npx tsx scripts/backfill-public-properties-flows.ts                 # dry run (default)
 *   npx tsx scripts/backfill-public-properties-flows.ts --execute       # writes
 *   npx tsx scripts/backfill-public-properties-flows.ts --org <id>      # one organisation
 *
 * Refuses any database other than DPO Central's own (the hosted production
 * endpoint) or a local one. Prints organisation ids and counts only.
 */

import prisma from "../src/lib/prisma";
import { backfillPublicPropertiesFlows } from "../src/server/services/data-flows/public-properties";

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
  const orgIndex = process.argv.indexOf("--org");
  const organizationId = orgIndex > -1 ? process.argv[orgIndex + 1] : undefined;
  const host = databaseHost();
  if (!ALLOWED_HOST_FRAGMENTS.some((f) => host.includes(f))) {
    console.error(
      `Refused: DATABASE_URL must point at DPO Central's own database (host containing ${ALLOWED_HOST_FRAGMENTS.join(", ")}). Got: ${host || "(none)"}`,
    );
    process.exit(2);
  }
  console.log(`${execute ? "EXECUTE" : "DRY RUN"} against ${host}`);

  const rows = await backfillPublicPropertiesFlows(prisma, { execute, organizationId });
  for (const r of rows)
    console.log(`  ${r.organizationId}  flows ${r.flows}, activity links ${r.links}, flows back left as they are ${r.returnFlowsKept}`);
  const sum = (k: "flows" | "links") => rows.reduce((s, r) => s + r[k], 0);
  console.log(
    `\n${rows.length} organisations: ${execute ? "moved" : "would move"} ${sum("flows")} flows and ${sum("links")} activity links.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
