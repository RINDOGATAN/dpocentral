// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The region an organisation was created from (src/server/services/org-region.ts):
 * recorded on the hosted service only, as "EU" or "OTHER", never the country.
 */

import { describe, it, expect } from "vitest";
import { signupRegionOf, signupRegionSettings } from "@/server/services/org-region";

describe("signupRegionSettings", () => {
  it("records EU for the 27 member states and OTHER for everyone else, on the hosted service", () => {
    expect(signupRegionSettings("ES", true)).toEqual({ signupRegion: "EU" });
    expect(signupRegionSettings("de", true)).toEqual({ signupRegion: "EU" });
    expect(signupRegionSettings("GB", true)).toEqual({ signupRegion: "OTHER" });
    expect(signupRegionSettings("NO", true)).toEqual({ signupRegion: "OTHER" });
    expect(signupRegionSettings("US", true)).toEqual({ signupRegion: "OTHER" });
  });

  it("records nothing on the kit or without a country", () => {
    expect(signupRegionSettings("ES", false)).toBeUndefined();
    expect(signupRegionSettings(null, true)).toBeUndefined();
    expect(signupRegionSettings(" ", true)).toBeUndefined();
  });
});

describe("signupRegionOf", () => {
  it("reads only the two known values", () => {
    expect(signupRegionOf({ signupRegion: "EU", other: 1 })).toBe("EU");
    expect(signupRegionOf({ signupRegion: "OTHER" })).toBe("OTHER");
    expect(signupRegionOf({ signupRegion: "ES" })).toBeNull();
    expect(signupRegionOf(null)).toBeNull();
    expect(signupRegionOf([])).toBeNull();
  });
});
