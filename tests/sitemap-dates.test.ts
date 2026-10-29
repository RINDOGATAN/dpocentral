// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The sitemap never stamps a URL with the request or build time. The pages'
 * content comes from shared message catalogs, components and config, so no
 * reliable per-page change date exists and every entry carries none.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("sitemap lastModified", () => {
  it("carries no date on any entry, at any clock time", async () => {
    vi.useFakeTimers();
    try {
      const sitemap = (await import("@/app/sitemap")).default;
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      const first = sitemap();
      vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));
      const second = sitemap();
      expect(first.length).toBeGreaterThan(0);
      for (const entry of [...first, ...second]) {
        expect(entry, entry.url).not.toHaveProperty("lastModified");
      }
      expect(second).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not read the clock", () => {
    const src = readFileSync("src/app/sitemap.ts", "utf8");
    expect(src).not.toMatch(/new Date\(|Date\.now\(/);
  });
});
