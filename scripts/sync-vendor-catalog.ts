/**
 * Syncs DPO Central's global vendor catalog (`vendor_catalog`) from
 * vendor.watch's `/catalog/sync` API into DPO's OWN database.
 *
 * DPO owns its DB and no longer shares vendor.watch's. This job pulls
 * the catalog over HTTP (paginated, x-api-key auth) and upserts each
 * vendor by slug into the local mirror. Cloud runs it on a schedule; a
 * self-host box runs it once on operator demand, then air-gaps. It never
 * touches vendor.watch's database. See docs/vendor-data-sourcing.md.
 *
 *   npm run db:sync-vendor-catalog
 *
 * Requires VENDORWATCH_CATALOG_API_URL and VENDORWATCH_CATALOG_API_KEY.
 */

import { PrismaClient } from "@prisma/client";
import type { VendorWatchSyncResponse } from "../src/lib/vendor-watch-types";
import { mapVendorToUpsert } from "../src/lib/vendor-watch-mapper";

const prisma = new PrismaClient();

async function main() {
  const apiUrl = process.env.VENDORWATCH_CATALOG_API_URL;
  const apiKey = process.env.VENDORWATCH_CATALOG_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error(
      "Missing VENDORWATCH_CATALOG_API_URL or VENDORWATCH_CATALOG_API_KEY"
    );
    process.exit(1);
  }

  console.log(`Syncing vendor catalog from ${apiUrl}...`);

  let cursor: string | undefined;
  let totalSynced = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  do {
    const url = new URL(apiUrl);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(body);
      process.exit(1);
    }

    const data: VendorWatchSyncResponse = await res.json();
    console.log(`Fetched ${data.count} vendors (cursor: ${cursor || "start"})`);

    for (const v of data.vendors) {
      const mapped = mapVendorToUpsert(v);

      const existing = await prisma.vendorCatalog.findUnique({
        where: { slug: v.slug },
      });

      if (existing) {
        await prisma.vendorCatalog.update({
          where: { slug: v.slug },
          data: mapped,
        });
        totalUpdated++;
      } else {
        await prisma.vendorCatalog.create({
          data: { slug: v.slug, ...mapped },
        });
        totalCreated++;
      }

      totalSynced++;
    }

    cursor = data.nextCursor;
  } while (cursor);

  console.log(
    `\nSync complete: ${totalSynced} total, ${totalCreated} created, ${totalUpdated} updated`
  );
}

main()
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
