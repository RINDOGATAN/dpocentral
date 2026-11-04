// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * English labels are in sentence case ("Add vendor", not "Add Vendor"). Product names, law names, acronyms and proper nouns keep
 * their capitals. The CSV column headings (pdf.csv) are a stable export format
 * and are left as they were; so are the stored template names (templates.*).
 */

import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";

const get = (path: string): string =>
  path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en) as string;

describe("English labels in sentence case", () => {
  it("writes the common buttons and headings in sentence case", () => {
    expect(get("common.showAll")).toBe("Show all");
    expect(get("common.viewDetails")).toBe("View details");
    expect(get("pages.newVendor.title")).toBe("Add vendor");
    expect(get("pages.vendors.exportRegister")).toBe("Export register");
    expect(get("pages.vendors.stats.total")).toBe("Total vendors");
  });

  it("keeps product and law names", () => {
    expect(JSON.stringify(en)).not.toMatch(/Dpo central|Eu AI act/);
  });

  it("leaves the CSV column headings unchanged", () => {
    const csv = (en as unknown as { pdf: { csv: Record<string, Record<string, string>> } }).pdf.csv;
    expect(csv.vendors.riskTier).toBe("Risk Tier");
  });
});
