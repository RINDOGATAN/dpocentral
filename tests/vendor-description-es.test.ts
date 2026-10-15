// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The catalogue's Spanish description (descriptionEs) reaches the vendor_catalog
 * row from snapshots that carry it, and older snapshots without it leave the
 * column alone. The usage ranking script reads in one read-only transaction.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapVendorToUpsert } from "@/lib/vendor-watch-mapper";
import type { VendorWatchVendor } from "@/lib/vendor-watch-types";
import { QUERY, vendorUsageRanking } from "../scripts/vendor-usage-ranking";

const base = {
  slug: "acme",
  name: "Acme",
  category: "Analytics",
  subcategory: null,
  description: "A vendor",
} as unknown as VendorWatchVendor;

describe("mapVendorToUpsert: descriptionEs", () => {
  it("carries the Spanish description when the snapshot has the field", () => {
    expect(mapVendorToUpsert({ ...base, descriptionEs: "Un proveedor" }).descriptionEs).toBe("Un proveedor");
    expect(mapVendorToUpsert({ ...base, descriptionEs: null }).descriptionEs).toBeNull();
  });

  it("leaves the column alone for a snapshot without the field", () => {
    expect("descriptionEs" in mapVendorToUpsert(base)).toBe(false);
  });

  it("is modelled in the schema with a migration", () => {
    const schema = readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/descriptionEs String\? @db\.Text/);
    const sql = readFileSync(
      path.resolve(__dirname, "../prisma/migrations/20261015120000_vendor_catalog_description_es/migration.sql"),
      "utf8"
    );
    expect(sql).toContain('ALTER TABLE "vendor_catalog" ADD COLUMN "descriptionEs" TEXT;');
  });
});

describe("vendor usage ranking", () => {
  it("sets the transaction read only before its single SELECT", async () => {
    const calls: string[] = [];
    const tx = {
      $executeRawUnsafe: async (sql: string) => {
        calls.push(sql);
        return 0;
      },
      $queryRawUnsafe: async <T,>(sql: string) => {
        calls.push(sql.trim().split(/\s+/)[0]);
        return [{ slug: "stripe", count: BigInt(4) }] as T;
      },
    };
    expect(await vendorUsageRanking(tx)).toEqual([{ slug: "stripe", count: 4 }]);
    expect(calls).toEqual(["SET TRANSACTION READ ONLY", "WITH"]);
    expect(QUERY).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i);
  });
});
