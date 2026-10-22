// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The catalogue's trainingUse and retention fields reach the vendor_catalog
 * row from snapshots that carry them; older snapshots without the keys leave
 * the columns alone.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapVendorToUpsert } from "@/lib/vendor-watch-mapper";
import type { VendorWatchVendor } from "@/lib/vendor-watch-types";

const base = {
  slug: "acme",
  name: "Acme",
  category: "Analytics",
  subcategory: null,
  description: "A vendor",
} as unknown as VendorWatchVendor;

const withFields = (extra: Record<string, unknown>) =>
  mapVendorToUpsert({ ...base, ...extra } as VendorWatchVendor) as Record<string, unknown>;

describe("mapVendorToUpsert: trainingUse and retention", () => {
  it.each(["no", "opt-out", "opt-in", "yes", "not-stated"])("passes %s through", (value) => {
    expect(withFields({ trainingUse: value }).trainingUse).toBe(value);
  });

  it("maps an invalid value or null to null", () => {
    expect(withFields({ trainingUse: "maybe" }).trainingUse).toBeNull();
    expect(withFields({ trainingUse: 3 }).trainingUse).toBeNull();
    expect(withFields({ trainingUse: null }).trainingUse).toBeNull();
  });

  it("passes retention through as given, null when null", () => {
    expect(withFields({ retention: "30 days" }).retention).toBe("30 days");
    expect(withFields({ retention: null }).retention).toBeNull();
  });

  it("leaves both columns out when the snapshot has no keys", () => {
    const row = mapVendorToUpsert(base);
    expect("trainingUse" in row).toBe(false);
    expect("retention" in row).toBe(false);
  });

  it("has the schema columns and an additive migration", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/trainingUse String\?/);
    expect(schema).toMatch(/retention\s+String\? @db\.Text/);
    const sql = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20261021120000_vendor_catalog_training_retention/migration.sql"),
      "utf8",
    );
    expect(sql).toContain('ADD COLUMN "trainingUse" TEXT;');
    expect(sql).toContain('ADD COLUMN "retention" TEXT;');
    expect(sql).not.toMatch(/DROP|UPDATE|DELETE/i);
  });
});
