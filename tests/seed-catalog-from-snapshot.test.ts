/**
 * Hermetic unit tests for seedCatalogFromSnapshot. Prisma is a plain mock
 * (vi.fn upsert/findMany/deleteMany) — no database, no network. Snapshots are
 * read from tests/fixtures/*.json via the opts.snapshotPath override.
 *
 * Asserts:
 *  - every snapshot vendor is upserted by slug (create carries source:"vendor-watch");
 *  - --prune deletes a stale prunable orphan but KEEPS a verified orphan and a
 *    non-prunable-source ("manual") orphan;
 *  - an undersized snapshot throws and never prunes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fileURLToPath } from "url";
import { seedCatalogFromSnapshot } from "@/lib/seed-catalog-from-snapshot";

const SNAPSHOT_PATH = fileURLToPath(
  new URL("./fixtures/catalog-snapshot.json", import.meta.url)
);
const UNDERSIZED_PATH = fileURLToPath(
  new URL("./fixtures/catalog-snapshot-undersized.json", import.meta.url)
);

const upsert = vi.fn();
const findMany = vi.fn();
const deleteMany = vi.fn();

const prisma = {
  vendorCatalog: {
    upsert: (...args: unknown[]) => upsert(...args),
    findMany: (...args: unknown[]) => findMany(...args),
    deleteMany: (...args: unknown[]) => deleteMany(...args),
  },
} as unknown as Parameters<typeof seedCatalogFromSnapshot>[0];

// The four slugs in tests/fixtures/catalog-snapshot.json.
const SNAPSHOT_SLUGS = ["acme-analytics", "beacon-crm", "cobalt-ai", "delta-mail"];

beforeEach(() => {
  vi.clearAllMocks();
  upsert.mockResolvedValue({});
  findMany.mockResolvedValue([]);
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("seedCatalogFromSnapshot", () => {
  it("upserts every snapshot vendor by slug (create carries source vendor-watch)", async () => {
    const res = await seedCatalogFromSnapshot(prisma, { snapshotPath: SNAPSHOT_PATH });

    expect(upsert).toHaveBeenCalledTimes(SNAPSHOT_SLUGS.length);
    const upsertedSlugs = upsert.mock.calls.map((c) => (c[0] as { where: { slug: string } }).where.slug);
    expect(upsertedSlugs.sort()).toEqual([...SNAPSHOT_SLUGS].sort());

    // Mapper output flows into both create and update; create adds slug.
    const first = upsert.mock.calls[0][0] as {
      where: { slug: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(first.create.slug).toBe(first.where.slug);
    expect(first.create.source).toBe("vendor-watch");
    expect(first.update.source).toBe("vendor-watch");

    // No prune requested → nothing deleted.
    expect(deleteMany).not.toHaveBeenCalled();
    expect(res).toEqual({ upserted: 4, pruned: 0, skipped: 0 });
  });

  it("with prune, deletes a stale prunable orphan but keeps a verified orphan and a manual orphan", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    findMany.mockResolvedValue([
      // In-snapshot rows: never touched.
      { slug: "acme-analytics", source: "vendor-watch", isVerified: false, publicProfileEnabled: false, verifiedBy: null },
      // Stale orphan from an owned source → deleted.
      { slug: "legacy-widget", source: "processors.json", isVerified: false, publicProfileEnabled: false, verifiedBy: null },
      // Verified orphan → KEPT even though absent from snapshot.
      { slug: "verified-vendor", source: "vendor-watch", isVerified: true, publicProfileEnabled: false, verifiedBy: null },
      // Operator-curated (non-prunable source) orphan → KEPT.
      { slug: "hand-added", source: "manual", isVerified: false, publicProfileEnabled: false, verifiedBy: null },
    ]);

    const res = await seedCatalogFromSnapshot(prisma, {
      snapshotPath: SNAPSHOT_PATH,
      prune: true,
    });

    expect(deleteMany).toHaveBeenCalledTimes(1);
    const delArg = deleteMany.mock.calls[0][0] as { where: { slug: { in: string[] } } };
    expect(delArg.where.slug.in).toEqual(["legacy-widget"]);

    expect(res.upserted).toBe(4);
    expect(res.pruned).toBe(1);
    expect(res.skipped).toBe(2); // verified-vendor + hand-added
  });

  it("keeps a publicProfileEnabled orphan and a verifiedBy orphan under prune", async () => {
    findMany.mockResolvedValue([
      { slug: "public-profile", source: "vendor-watch", isVerified: false, publicProfileEnabled: true, verifiedBy: null },
      { slug: "human-verified", source: "seed", isVerified: false, publicProfileEnabled: false, verifiedBy: "admin@x" },
    ]);

    const res = await seedCatalogFromSnapshot(prisma, {
      snapshotPath: SNAPSHOT_PATH,
      prune: true,
    });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(res.pruned).toBe(0);
    expect(res.skipped).toBe(2);
  });

  it("throws on an undersized snapshot and never prunes", async () => {
    await expect(
      seedCatalogFromSnapshot(prisma, { snapshotPath: UNDERSIZED_PATH, prune: true })
    ).rejects.toThrow(/implausibly small/);

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("throws when the snapshot file is missing", async () => {
    await expect(
      seedCatalogFromSnapshot(prisma, { snapshotPath: "/nonexistent/catalog-snapshot.json" })
    ).rejects.toThrow(/not found/);
  });
});
