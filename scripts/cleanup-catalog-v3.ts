/**
 * One-time cleanup for HOSTED/PRODUCTION databases after the vendor-catalog
 * truth pass (processors.json v3.0.0, commit 7ffa46c) and the seed
 * de-personalization (commit e90ffb9).
 *
 * The seeder only upserts — it never deletes — so installs seeded before
 * those commits still carry:
 *   1. the 45 garbage catalog entries removed from processors.json
 *      (wrong-company scrapes, parked domains, retired products,
 *      misspelled duplicates), and
 *   2. the legacy PlatformAdmin row (vendor PII on a latent-grant table).
 *
 * This script deletes exactly those rows and nothing else. Fresh installs
 * (seeded from v3.0.0 data) are unaffected — it finds nothing to delete.
 *
 * Usage (run by the operator against the production DATABASE_URL):
 *   npx tsx scripts/cleanup-catalog-v3.ts --dry-run   # report only, no writes
 *   npx tsx scripts/cleanup-catalog-v3.ts             # delete
 *
 * Idempotent: re-running after a successful pass deletes zero rows.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The 45 catalog slugs removed in processors.json v3.0.0 (diff of commit
// 7ffa46c). Do not extend this list casually — every slug here is deleted
// from the shared VendorCatalog reference table.
const REMOVED_SLUGS = [
  "ablyft",
  "abtesty",
  "arengu",
  "at-internet",
  "aweber",
  "better-lead-generation-services",
  "bitrix24",
  "byside",
  "clicktale",
  "content-square",
  "core-audience",
  "cquotient",
  "curator",
  "demdex",
  "duoban",
  "evergage",
  "habu",
  "hubspot-chatbot",
  "hubspot-marketing-hub",
  "igodigital",
  "infinity",
  "iperceptions",
  "juicer",
  "kampyle",
  "marketizator",
  "oneall",
  "pluso",
  "qubit",
  "repai",
  "retargeted",
  "ruddestack",
  "ruxit",
  "salesforce-audience-studio",
  "salesloft",
  "smart-emailing",
  "social-snap",
  "symmetri",
  "tealium-cdp",
  "tolt",
  "trackerplan",
  "triggered-messaging",
  "usocial",
  "widde",
  "wigzo",
  "zarget",
];

// The legacy operator identity seeded into every pre-e90ffb9 install.
// (The current seed only creates a fictional admin@dpocentral.example row,
// and only when DEMO_SEED=true.)
const LEGACY_PLATFORM_ADMIN_EMAIL = "smaldonado@privacycloud.com";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const mode = dryRun ? "DRY RUN — no writes" : "LIVE — deleting";
  console.log(`cleanup-catalog-v3: ${mode}`);

  // 1. Garbage catalog entries
  const staleVendors = await prisma.vendorCatalog.findMany({
    where: { slug: { in: REMOVED_SLUGS } },
    select: { slug: true, name: true },
    orderBy: { slug: "asc" },
  });

  if (staleVendors.length === 0) {
    console.log("VendorCatalog: nothing to delete (already clean).");
  } else {
    console.log(`VendorCatalog: ${staleVendors.length} stale entries found:`);
    for (const v of staleVendors) console.log(`  - ${v.slug} (${v.name})`);
    if (!dryRun) {
      const res = await prisma.vendorCatalog.deleteMany({
        where: { slug: { in: REMOVED_SLUGS } },
      });
      console.log(`VendorCatalog: deleted ${res.count} rows.`);
    }
  }

  // 2. Legacy PlatformAdmin row
  const legacyAdmin = await prisma.platformAdmin.findUnique({
    where: { email: LEGACY_PLATFORM_ADMIN_EMAIL },
    select: { id: true, email: true, isActive: true },
  });

  if (!legacyAdmin) {
    console.log("PlatformAdmin: legacy row not present (already clean).");
  } else {
    console.log(
      `PlatformAdmin: legacy row found (${legacyAdmin.email}, active=${legacyAdmin.isActive}).`
    );
    if (!dryRun) {
      await prisma.platformAdmin.delete({ where: { id: legacyAdmin.id } });
      console.log("PlatformAdmin: deleted.");
    }
  }

  if (dryRun) {
    console.log("Dry run complete. Re-run without --dry-run to apply.");
  } else {
    console.log("Cleanup complete. Safe to re-run (idempotent).");
  }
}

main()
  .catch((e) => {
    console.error("cleanup-catalog-v3 failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
