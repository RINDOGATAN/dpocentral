// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Vendor catalogue usage: how many vendor records each catalogue slug backs.
 *
 * Prints one line per slug, "<count> <slug>", most used first, and nothing
 * else: no organization, no vendor name, no free text.
 *
 * A vendor record has no catalogue slug column, so a record is linked to a
 * slug by, in this order:
 *   1. the quick start's audit entry (audit_logs, entityType "Vendor", action
 *      "CREATE", changes.catalogSlug);
 *   2. vendors.metadata.catalogSlug (set by the demo seed);
 *   3. otherwise, a vendor name equal (ignoring case) to exactly one
 *      catalogue name (records filled from the catalogue search form).
 * Each record counts once, for its first link. Records of demo organizations
 * (seeded id, seeded slug or settings.isDemo) are left out.
 *
 * READ ONLY by construction: one transaction whose first statement is
 * SET TRANSACTION READ ONLY, then a single SELECT. The database refuses any
 * write inside it.
 *
 * Reads a production database: run only with the owner's go-ahead.
 *
 * Usage:
 *   DATABASE_URL_PROD=<connection string> npx tsx scripts/vendor-usage-ranking.ts [--json]
 *   --json prints [{ "slug": ..., "count": ... }] instead of lines.
 */

const DEMO_VERTICAL_KEYS = ["saas", "healthcare", "fintech", "media", "proserv"];
export const DEMO_ORGANIZATION_IDS = ["demo-organization", ...DEMO_VERTICAL_KEYS.map((k) => `${k}-organization`)];
export const DEMO_ORGANIZATION_SLUGS = ["demo", ...DEMO_VERTICAL_KEYS.map((k) => `demo-${k}`)];

/** $1: demo organization ids, $2: demo organization slugs. */
export const QUERY = `
WITH demo AS (
  SELECT id FROM organizations
   WHERE id = ANY($1::text[]) OR slug = ANY($2::text[]) OR (settings->>'isDemo') = 'true'
),
live AS (
  SELECT v.id, v.name, v.metadata FROM vendors v
   WHERE v."organizationId" NOT IN (SELECT id FROM demo)
),
by_audit AS (
  SELECT DISTINCT ON (a."entityId") a."entityId" AS vendor_id, a.changes->>'catalogSlug' AS slug
    FROM audit_logs a
   WHERE a."entityType" = 'Vendor' AND a.action = 'CREATE' AND a.changes->>'catalogSlug' IS NOT NULL
   ORDER BY a."entityId", a."createdAt"
),
unique_names AS (
  SELECT lower(name) AS lname, min(slug) AS slug FROM vendor_catalog GROUP BY lower(name) HAVING count(*) = 1
),
linked AS (
  SELECT l.id AS vendor_id,
         COALESCE(b.slug, l.metadata->>'catalogSlug', n.slug) AS slug
    FROM live l
    LEFT JOIN by_audit b ON b.vendor_id = l.id
    LEFT JOIN unique_names n ON n.lname = lower(l.name)
)
SELECT slug, COUNT(*)::int AS count
  FROM linked
 WHERE slug IS NOT NULL
 GROUP BY slug
 ORDER BY count DESC, slug ASC`;

export interface SlugCount {
  slug: string;
  count: number;
}

/** The part of a Prisma transaction client this script uses. */
export interface RawClient {
  $executeRawUnsafe(sql: string): Promise<unknown>;
  $queryRawUnsafe<T>(sql: string, ...values: unknown[]): Promise<T>;
}

/** Runs QUERY as the only statement after SET TRANSACTION READ ONLY. */
export async function vendorUsageRanking(tx: RawClient): Promise<SlugCount[]> {
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const rows = await tx.$queryRawUnsafe<Array<{ slug: string; count: number | bigint }>>(
    QUERY,
    DEMO_ORGANIZATION_IDS,
    DEMO_ORGANIZATION_SLUGS
  );
  return rows.map((r) => ({ slug: r.slug, count: Number(r.count) }));
}

async function main() {
  const url = process.env.DATABASE_URL_PROD;
  if (!url) throw new Error("DATABASE_URL_PROD is not set");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const rows = await prisma.$transaction((tx) => vendorUsageRanking(tx as unknown as RawClient));
    if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
    else for (const r of rows) console.log(`${String(r.count).padStart(6)} ${r.slug}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /vendor-usage-ranking\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    // The error class only: a message could carry connection details.
    console.error(e instanceof Error ? e.name : "Error");
    process.exit(1);
  });
}
