// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Catalogue search shows a vendor recorded twice (same website, same name)
 * once, as its richer record, and keeps two products of one company apart.
 * Spanish screens show the catalogue's Spanish description, and none when a
 * vendor has no Spanish text.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  catalogDescriptionFor,
  catalogDomain,
  catalogNameKey,
  dedupeCatalogRows,
} from "@/lib/vendor-catalog-display";

describe("catalogDomain and catalogNameKey", () => {
  it("reduce a website to its host and a name to its comparable words", () => {
    expect(catalogDomain("https://www.example.com/privacy")).toBe("example.com");
    expect(catalogDomain("example.com")).toBe("example.com");
    expect(catalogDomain(null)).toBeNull();
    expect(catalogNameKey("Acme io")).toBe("acme");
    expect(catalogNameKey("Acme, Inc.")).toBe("acme");
    expect(catalogNameKey("Acme CRM")).toBe("acme crm");
  });
});

describe("dedupeCatalogRows", () => {
  it("keeps the richer of two records for one vendor, in the first one's place", () => {
    const rows = [
      { slug: "acme", name: "Acme", website: "https://acme.example", description: null, certifications: [] },
      { slug: "other", name: "Other", website: "https://other.example" },
      {
        slug: "acme-analytics",
        name: "Acme",
        website: "https://www.acme.example",
        description: "Analytics",
        certifications: ["ISO 27001"],
        subprocessors: [{ name: "x" }],
      },
    ];
    expect(dedupeCatalogRows(rows).map((r) => r.slug)).toEqual(["acme-analytics", "other"]);
  });

  it("treats a company suffix as the same name", () => {
    const rows = [
      { slug: "acme", name: "Acme", website: "acme.example", description: "Longer description here" },
      { slug: "acme-io", name: "Acme io", website: "acme.example", description: "Short" },
    ];
    expect(dedupeCatalogRows(rows).map((r) => r.slug)).toEqual(["acme"]);
  });

  it("keeps two products of one company, and rows without a website", () => {
    const rows = [
      { slug: "acme", name: "Acme", website: "acme.example" },
      { slug: "acme-crm", name: "Acme CRM", website: "acme.example" },
      { slug: "nosite-1", name: "Nosite", website: null },
      { slug: "nosite-2", name: "Nosite", website: null },
    ];
    expect(dedupeCatalogRows(rows)).toHaveLength(4);
  });

  it("removes the duplicates the release snapshot holds and nothing else", () => {
    const snapshot = JSON.parse(
      readFileSync(path.resolve(__dirname, "../vendors/catalog-snapshot.json"), "utf8"),
    ) as { vendors: { slug: string; name: string; website: string | null }[] };
    const kept = new Set(dedupeCatalogRows(snapshot.vendors).map((v) => v.slug));
    const dropped = snapshot.vendors.filter((v) => !kept.has(v.slug));
    // Each row left out has a twin kept with the same website and name.
    for (const d of dropped) {
      const twin = snapshot.vendors.find(
        (v) =>
          kept.has(v.slug) &&
          catalogDomain(v.website) === catalogDomain(d.website) &&
          catalogNameKey(v.name) === catalogNameKey(d.name),
      );
      expect(twin, d.slug).toBeTruthy();
    }
    expect(dropped.length).toBeLessThan(10);
  });
});

describe("catalogDescriptionFor", () => {
  it("shows the English description on English screens and the Spanish one on Spanish screens", () => {
    const v = { description: "A vendor", descriptionEs: "Un proveedor" };
    expect(catalogDescriptionFor(v, "en")).toBe("A vendor");
    expect(catalogDescriptionFor(v, "es")).toBe("Un proveedor");
    expect(catalogDescriptionFor(v, "de")).toBeNull();
  });

  it("never shows English on a Spanish screen, and tolerates rows without the Spanish field", () => {
    expect(catalogDescriptionFor({ description: "A vendor" }, "es")).toBeNull();
    expect(catalogDescriptionFor({ description: "A vendor", descriptionEs: null }, "es")).toBeNull();
    expect(catalogDescriptionFor({ description: "A vendor", descriptionEs: "" }, "es")).toBeNull();
    expect(catalogDescriptionFor({ description: null }, "en")).toBeNull();
  });

  it("is used by both catalogue search lists", () => {
    for (const file of ["quickstart/page.tsx", "vendors/new/page.tsx"]) {
      const src = readFileSync(path.resolve(__dirname, "../src/app/(dashboard)/privacy", file), "utf8");
      expect(src, file).toMatch(/catalogDescriptionFor\(vendor, (templateLocale|locale)\)/);
      expect(src, file).not.toContain("catalogDescriptionFor(vendor.description");
    }
  });
});
