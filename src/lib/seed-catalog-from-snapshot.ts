/**
 * Seeds DPO Central's global vendor catalog (`vendor_catalog`) from a
 * release-generated snapshot file (`vendors/catalog-snapshot.json`).
 *
 * The snapshot is the rich, full catalog exported by vendor.watch at release
 * time (`db:export-snapshot`), in the SAME shape as the live `/catalog/sync`
 * payload. It is NOT committed to this repo — it is dropped in at release
 * time. Fresh installs seed from it; existing installs can reconcile with
 * `--prune`. This never touches vendor.watch's database.
 *
 * Contract: catalog-snapshot.json =
 *   { version, generatedAt, sourceCommit, count, vendors: VendorWatchVendor[] }
 * Seeds read `.vendors`. Each vendor is mapped through the SAME mapper the
 * live sync uses (`vendor-watch-mapper.ts`) and upserted by `slug`.
 *
 * The catalog is core to a fresh install, so this fails LOUDLY (throws) when
 * the snapshot is missing, unparseable, or implausibly small — never a silent
 * warn.
 */

import * as fs from "fs";
import * as path from "path";
import type { PrismaClient } from "@prisma/client";
import type { VendorWatchVendor } from "./vendor-watch-types";
import { mapVendorToUpsert } from "./vendor-watch-mapper";

/**
 * Minimum plausible catalog size. A real vendor.watch export is many hundreds
 * of vendors; anything smaller means a truncated or wrong file, so we refuse
 * to seed (and never prune) against it.
 */
export const MIN_EXPECTED = 300;

/**
 * Sources this reconciler is allowed to delete during a prune. A row from any
 * OTHER source (e.g. "manual", "ai-enriched") is operator- or app-owned and is
 * never touched, even if it is absent from the snapshot.
 */
export const PRUNABLE_SOURCES = new Set(["vendor-watch", "processors.json", "seed"]);

interface CatalogSnapshot {
  version?: string;
  generatedAt?: string;
  sourceCommit?: string;
  count: number;
  vendors: VendorWatchVendor[];
}

export interface SeedCatalogResult {
  upserted: number;
  pruned: number;
  skipped: number;
}

export interface SeedCatalogOptions {
  /** Reconcile: delete prunable orphans absent from the snapshot. */
  prune?: boolean;
  /** Override the snapshot path (tests). Defaults to repo-root snapshot. */
  snapshotPath?: string;
}

function defaultSnapshotPath(): string {
  return path.join(process.cwd(), "vendors", "catalog-snapshot.json");
}

function readSnapshot(snapshotPath: string): CatalogSnapshot {
  let raw: string;
  try {
    raw = fs.readFileSync(snapshotPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Catalog snapshot not found at ${snapshotPath}. The catalog is core to a ` +
        `fresh install: generate it with vendor.watch's db:export-snapshot and ` +
        `place it at vendors/catalog-snapshot.json. (${(err as Error).message})`
    );
  }

  let parsed: CatalogSnapshot;
  try {
    parsed = JSON.parse(raw) as CatalogSnapshot;
  } catch (err) {
    throw new Error(
      `Catalog snapshot at ${snapshotPath} is not valid JSON: ${(err as Error).message}`
    );
  }

  if (!parsed || !Array.isArray(parsed.vendors) || typeof parsed.count !== "number") {
    throw new Error(
      `Catalog snapshot at ${snapshotPath} is malformed: expected { count, vendors[] }.`
    );
  }

  if (parsed.count < MIN_EXPECTED) {
    throw new Error(
      `Catalog snapshot at ${snapshotPath} is implausibly small (count=${parsed.count}, ` +
        `expected >= ${MIN_EXPECTED}). Refusing to seed against a truncated catalog.`
    );
  }

  return parsed;
}

/**
 * Seed (upsert) the global vendor catalog from the release snapshot.
 *
 * @throws if the snapshot is missing, unparseable, malformed, or smaller than
 *   MIN_EXPECTED. Callers should let this propagate — a bad catalog is fatal
 *   to a fresh install.
 */
export async function seedCatalogFromSnapshot(
  prisma: PrismaClient,
  opts: SeedCatalogOptions = {}
): Promise<SeedCatalogResult> {
  const snapshotPath = opts.snapshotPath ?? defaultSnapshotPath();
  const snapshot = readSnapshot(snapshotPath);

  // ── Upsert every snapshot vendor by slug ────────────────────────────────
  const snapshotSlugs = new Set<string>();
  let upserted = 0;

  for (const v of snapshot.vendors) {
    const map = mapVendorToUpsert(v); // sets source: "vendor-watch"
    await prisma.vendorCatalog.upsert({
      where: { slug: v.slug },
      create: { ...map, slug: v.slug },
      update: { ...map },
    });
    snapshotSlugs.add(v.slug);
    upserted++;
  }

  let pruned = 0;
  let skipped = 0;

  // ── Prune: reconcile existing installs ──────────────────────────────────
  // Delete ONLY rows absent from the snapshot whose source is one we own.
  // NEVER delete a verified, publicly-profiled, or operator-curated row.
  if (opts.prune && snapshot.count >= MIN_EXPECTED) {
    const existing = await prisma.vendorCatalog.findMany({
      select: {
        slug: true,
        source: true,
        isVerified: true,
        publicProfileEnabled: true,
        verifiedBy: true,
      },
    });

    const toDelete: string[] = [];
    for (const row of existing) {
      if (snapshotSlugs.has(row.slug)) continue; // still in catalog, keep

      const isProtected =
        row.isVerified === true ||
        row.publicProfileEnabled === true ||
        row.verifiedBy != null ||
        !PRUNABLE_SOURCES.has(row.source ?? "");

      if (isProtected) {
        skipped++;
      } else {
        toDelete.push(row.slug);
      }
    }

    if (toDelete.length > 0) {
      const res = await prisma.vendorCatalog.deleteMany({
        where: { slug: { in: toDelete } },
      });
      pruned = res.count;
    }
  }

  return { upserted, pruned, skipped };
}
