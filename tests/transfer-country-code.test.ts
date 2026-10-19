// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A transfer's destination is a two-letter country code: the forms accept
 * nothing else (a name such as "India" never matched the transfer rules),
 * and the inventory tabs say when more records exist than are loaded.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { isCountryCode, normaliseCountryCode } from "@/lib/country-code";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("country code", () => {
  it("keeps two capital letters", () => {
    expect(normaliseCountryCode("in")).toBe("IN");
    expect(normaliseCountryCode("India")).toBe("IN");
    expect(normaliseCountryCode(" u.s. ")).toBe("US");
    expect(isCountryCode("IN")).toBe(true);
    expect(isCountryCode("I")).toBe(false);
    expect(isCountryCode("India")).toBe(false);
  });

  it("the transfer form (on Transfers, its one home) picks a country by name and explains the code", () => {
    for (const f of ["src/app/(dashboard)/privacy/transfers/page.tsx"]) {
      const s = src(f);
      expect(s).toContain("<CountryPicker");
      expect(s).toContain("isIsoCountryCode(");
      expect(s).toContain("countryHint");
    }
    expect(en.pages.dataInventory.transferDialog.countryHint).toContain("ISO 3166");
    expect(es.pages.dataInventory.transferDialog.countryHint).toContain("ISO 3166");
  });
});

describe("inventory tab counts", () => {
  it("add a plus sign while more pages exist", () => {
    const s = src("src/app/(dashboard)/privacy/data-inventory/page.tsx");
    expect(s).toContain("hasMoreAssets ? `${dataAssets.length}+`");
    expect(s).toContain("hasMoreActivities ? `${activitiesCount}+`");
  });
});
