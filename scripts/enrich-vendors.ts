/**
 * Batch vendor enrichment script with progress tracking.
 *
 * Processes unenriched vendors in alphabetical order. Each enriched vendor
 * gets source: "ai-enriched", so re-running always resumes where it left off.
 *
 * Usage:
 *   npx tsx scripts/enrich-vendors.ts              # default batch of 5
 *   npx tsx scripts/enrich-vendors.ts --batch 10   # process 10
 *   npx tsx scripts/enrich-vendors.ts --dry-run    # preview candidates only
 *   npx tsx scripts/enrich-vendors.ts --from Z     # start from letter Z
 */

import { PrismaClient } from "@prisma/client";
import { enrichVendor } from "../src/server/services/vendor/enrichment";

const prisma = new PrismaClient();

// ── CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function option(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BATCH_SIZE = parseInt(option("batch", "5"), 10);
const DRY_RUN = flag("dry-run");
const FROM_LETTER = option("from", "");

async function main() {
  // 1. Build catalog slug set for subprocessor linking
  const allVendors = await prisma.vendorCatalog.findMany({
    select: { slug: true },
  });
  const catalogSlugs = new Set(allVendors.map((v) => v.slug));

  // 2. Find unenriched candidates
  const candidates = await prisma.vendorCatalog.findMany({
    where: {
      OR: [
        { website: { not: null } },
        { trustCenterUrl: { not: null } },
      ],
      NOT: { source: "ai-enriched" },
      ...(FROM_LETTER
        ? { name: { gte: FROM_LETTER } }
        : {}),
    },
    orderBy: { name: "asc" },
    take: BATCH_SIZE,
  });

  // 3. Count remaining for progress
  const totalRemaining = await prisma.vendorCatalog.count({
    where: {
      OR: [
        { website: { not: null } },
        { trustCenterUrl: { not: null } },
      ],
      NOT: { source: "ai-enriched" },
    },
  });

  const totalCatalog = allVendors.length;
  const alreadyEnriched = await prisma.vendorCatalog.count({
    where: { source: "ai-enriched" },
  });

  console.log("════════════════════════════════════════════════════");
  console.log("  Vendor Enrichment Pipeline");
  console.log("════════════════════════════════════════════════════");
  console.log(`  Catalog total:     ${totalCatalog}`);
  console.log(`  Already enriched:  ${alreadyEnriched}`);
  console.log(`  Remaining:         ${totalRemaining}`);
  console.log(`  This batch:        ${candidates.length}` + (DRY_RUN ? " (DRY RUN)" : ""));
  if (FROM_LETTER) console.log(`  Starting from:     "${FROM_LETTER}"`);
  console.log("════════════════════════════════════════════════════\n");

  if (candidates.length === 0) {
    console.log("✅ No unenriched vendors with a website remaining.");
    return;
  }

  // 4. Show batch index
  console.log("Batch vendors:");
  candidates.forEach((v, i) => {
    const url = v.website || v.trustCenterUrl || "—";
    console.log(`  ${i + 1}. ${v.name} (${v.slug}) — ${url}`);
  });
  console.log("");

  if (DRY_RUN) {
    console.log("Dry run — no enrichment performed.");
    return;
  }

  // 5. Process each vendor
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const vendor = candidates[i];
    const prefix = `[${i + 1}/${candidates.length}]`;

    process.stdout.write(`${prefix} ${vendor.name}...`);

    try {
      const result = await enrichVendor({
        vendorName: vendor.name,
        website: vendor.website,
        trustCenterUrl: vendor.trustCenterUrl,
        privacyPolicyUrl: vendor.privacyPolicyUrl,
        dpaUrl: vendor.dpaUrl,
        securityPageUrl: vendor.securityPageUrl,
        existing: {
          certifications: vendor.certifications,
          frameworks: vendor.frameworks,
          gdprCompliant: vendor.gdprCompliant,
          ccpaCompliant: vendor.ccpaCompliant,
          hipaaCompliant: vendor.hipaaCompliant,
          dataLocations: vendor.dataLocations,
          hasEuDataCenter: vendor.hasEuDataCenter,
          subprocessors: vendor.subprocessors,
          description: vendor.description,
          trustCenterUrl: vendor.trustCenterUrl,
          privacyPolicyUrl: vendor.privacyPolicyUrl,
          dpaUrl: vendor.dpaUrl,
          securityPageUrl: vendor.securityPageUrl,
        },
        overwriteExisting: false,
        catalogSlugs,
      });

      if (!result.success) {
        console.log(` ❌ ${result.error}`);
        // Still mark as ai-enriched so we don't retry failures forever
        await prisma.vendorCatalog.update({
          where: { slug: vendor.slug },
          data: { source: "ai-enriched" },
        });
        failed++;
        continue;
      }

      const fields = result.enrichedFields;
      const { certEvidenceUrls, ...catalogFields } = fields;
      const fieldCount = Object.keys(catalogFields).length;

      if (fieldCount > 0) {
        await prisma.vendorCatalog.update({
          where: { slug: vendor.slug },
          data: {
            ...(fields.certifications && { certifications: fields.certifications }),
            ...(fields.frameworks && { frameworks: fields.frameworks }),
            ...(fields.gdprCompliant !== undefined && { gdprCompliant: fields.gdprCompliant }),
            ...(fields.ccpaCompliant !== undefined && { ccpaCompliant: fields.ccpaCompliant }),
            ...(fields.hipaaCompliant !== undefined && { hipaaCompliant: fields.hipaaCompliant }),
            ...(fields.dataLocations && { dataLocations: fields.dataLocations }),
            ...(fields.hasEuDataCenter !== undefined && { hasEuDataCenter: fields.hasEuDataCenter }),
            ...(fields.subprocessors && { subprocessors: fields.subprocessors }),
            ...(fields.description && { description: fields.description }),
            ...(fields.trustCenterUrl && { trustCenterUrl: fields.trustCenterUrl }),
            ...(fields.privacyPolicyUrl && { privacyPolicyUrl: fields.privacyPolicyUrl }),
            ...(fields.dpaUrl && { dpaUrl: fields.dpaUrl }),
            ...(fields.securityPageUrl && { securityPageUrl: fields.securityPageUrl }),
            source: "ai-enriched",
          },
        });
      } else {
        // No new fields but still mark as enriched
        await prisma.vendorCatalog.update({
          where: { slug: vendor.slug },
          data: { source: "ai-enriched" },
        });
      }

      // Build summary of what was found
      const summary: string[] = [];
      if (fields.certifications?.length) summary.push(`${fields.certifications.length} certs`);
      if (fields.frameworks?.length) summary.push(`${fields.frameworks.length} frameworks`);
      if (fields.subprocessors?.length) {
        const linked = fields.subprocessors.filter((s) => s.catalogVendorSlug).length;
        summary.push(`${fields.subprocessors.length} subs` + (linked ? ` (${linked} linked)` : ""));
      }
      if (fields.dataLocations?.length) summary.push(`${fields.dataLocations.length} locations`);
      if (fields.description) summary.push("desc");
      if (fields.gdprCompliant !== undefined) summary.push("GDPR");
      if (certEvidenceUrls) summary.push(`${Object.keys(certEvidenceUrls).length} evidence URLs`);
      const discoveredUrlCount = result.pagesScraped;

      console.log(
        ` ✅ ${discoveredUrlCount} pages, ${fieldCount} fields` +
        (summary.length ? ` (${summary.join(", ")})` : " (no new data)")
      );

      successful++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` ❌ ${msg.slice(0, 80)}`);
      failed++;
    }
  }

  // 6. Summary
  console.log("\n════════════════════════════════════════════════════");
  console.log(`  Batch complete: ${successful} enriched, ${failed} failed`);
  console.log(`  Progress: ${alreadyEnriched + successful}/${totalCatalog} total enriched`);
  console.log(`  Remaining: ~${totalRemaining - candidates.length}`);
  console.log("════════════════════════════════════════════════════");
  console.log("\nRun again to process the next batch.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
