// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Seeds the global vendor catalog (`vendor_catalog`) from the release
 * snapshot (`vendors/catalog-snapshot.json`) via the shared helper.
 *
 *   npm run db:seed-vendors            # upsert the snapshot catalog
 *   npm run db:seed-vendors -- --prune # also reconcile: drop prunable orphans
 *
 * --prune deletes vendor-catalog rows that are absent from the snapshot AND
 * owned by us (source ∈ vendor-watch/processors.json/seed). It NEVER deletes a
 * verified, publicly-profiled, or operator-curated row. See
 * src/lib/seed-catalog-from-snapshot.ts and docs/vendor-data-sourcing.md.
 *
 * The helper fails loudly (throws) if the snapshot is missing, unparseable, or
 * implausibly small — the catalog is core to a fresh install.
 */

import { PrismaClient } from "@prisma/client";
import { seedCatalogFromSnapshot } from "../src/lib/seed-catalog-from-snapshot";

const prisma = new PrismaClient();

async function main() {
  const prune = process.argv.includes("--prune");
  console.log(
    `Seeding vendor catalog from catalog-snapshot.json${prune ? " (with --prune)" : ""}...`
  );

  const { upserted, pruned, skipped } = await seedCatalogFromSnapshot(prisma, { prune });

  console.log(
    `Catalog seed complete: ${upserted} upserted, ${pruned} pruned, ${skipped} protected orphans kept.`
  );
}

main()
  .catch((e) => {
    console.error("Error seeding vendor catalog:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
