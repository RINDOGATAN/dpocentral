// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One header for a record's own page (F5 of the September browser round):
 * the data asset and the processing activity pages both use RecordHeader
 * (a text back link, the icon, the name, the badges, the actions on the
 * right), and neither draws a header of its own.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const PAGES = {
  asset: "src/app/(dashboard)/privacy/data-inventory/[id]/page.tsx",
  activity: "src/app/(dashboard)/privacy/data-inventory/activities/[id]/page.tsx",
};

describe("record header", () => {
  it("is a text back link over the shared PageHeader", () => {
    const src = read("src/components/privacy/record-header.tsx");
    expect(src).toContain("<PageHeader");
    expect(src).toMatch(/<ArrowLeft[^>]*\/>\s*\{back\.label\}/);
  });

  for (const [kind, file] of Object.entries(PAGES)) {
    it(`is the one header of the ${kind} page`, () => {
      const src = read(file);
      expect(src).toContain("<RecordHeader");
      expect(src).not.toMatch(/<h1\b/);
      expect(src).toMatch(/back=\{\{ href: "[^"]+", label: tp\("back"\) \}\}/);
      expect(src).toMatch(/icon=\{\w+\}/);
      expect(src).toContain("badges={");
      expect(src).toContain("actions={");
    });
  }

  it("the activity page goes back to the activities list, in words, in both languages", () => {
    expect(read(PAGES.activity)).toContain('href: "/privacy/data-inventory/processing-activities"');
    for (const bundle of [en, es]) {
      const d = bundle.pages.activityDetail;
      expect(d.back && d.edit && d.inactive && d.notFound && d.backToInventory).toBeTruthy();
    }
  });
});
