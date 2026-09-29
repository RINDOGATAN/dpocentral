// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Recent activity dates (F10 of the September browser round): one format per
 * interface language, to the minute, never the browser's own numeric default
 * with seconds ("9/28/2026, 11:34:49 AM").
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { formatDateTimeIn } from "@/lib/utils";

const WHEN = "2026-09-28T11:34:49Z";

describe("formatDateTimeIn", () => {
  it("writes English dates day first, to the minute", () => {
    const s = formatDateTimeIn(WHEN, "en", "UTC");
    expect(s).toMatch(/^28 Sept? 2026, 11:34$/);
  });

  it("writes Spanish dates in Castilian, to the minute", () => {
    const s = formatDateTimeIn(WHEN, "es", "UTC");
    expect(s).toMatch(/^28 sept? 2026, 11:34$/);
  });

  it("never shows seconds, and falls back to English for another language", () => {
    for (const locale of ["en", "es", "fr"]) {
      expect(formatDateTimeIn(WHEN, locale, "UTC")).not.toContain(":49");
    }
    expect(formatDateTimeIn(WHEN, "fr", "UTC")).toBe(formatDateTimeIn(WHEN, "en", "UTC"));
  });
});

describe("Recent activity on the home", () => {
  it("formats with the interface's language", () => {
    const home = readFileSync(
      path.resolve(__dirname, "../src/app/(dashboard)/privacy/page.tsx"),
      "utf8"
    );
    expect(home).toContain("formatDateTimeIn(activity.createdAt, locale)");
    expect(home).not.toMatch(/toLocaleString\(\)/);
  });
});
