// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one page-header pattern (src/components/privacy/page-header.tsx), checked
 * on the source: the seven path lists use it, its row never wraps, and the
 * title is the header's own — not a second <h1> beside it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PAGE_HEADER_ACTIONS } from "../src/components/privacy/page-header";

const ROOT = "src/app/(dashboard)/privacy";

// The seven lists on the privacy programme path.
const LISTS = [
  "data-inventory",
  "vendors",
  "assessments",
  "dsar",
  "incidents",
  "transfers",
  "ai-systems",
];

const read = (dir: string) => readFileSync(path.join(process.cwd(), ROOT, dir, "page.tsx"), "utf8");

describe("the page header", () => {
  it("is used by every path list, which owns the only <h1>", () => {
    for (const dir of LISTS) {
      const src = read(dir);
      expect(src, dir).toContain("<PageHeader");
      // The title lives in PageHeader; no second <h1> beside it.
      expect(src.match(/<h1\b/g) ?? [], dir).toHaveLength(0);
    }
  });

  it("keeps its actions on one row that never wraps", () => {
    const classes = PAGE_HEADER_ACTIONS.split(/\s+/);
    expect(classes).toContain("flex-nowrap");
    expect(classes).not.toContain("flex-wrap");
    // On a phone the row is full width and the main (last) action takes what is left.
    expect(classes).toContain("w-full");
    expect(classes).toContain("[&>*:last-child]:flex-1");
  });
});
