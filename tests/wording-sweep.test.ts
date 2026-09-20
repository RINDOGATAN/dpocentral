// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The guidance in this product stands on the law, not on who presented it.
 *
 * Nothing a user can read may name a professional association, a public
 * workshop or a dated event. This test scans the surfaces that carry
 * user-visible copy: the message bundles, the assessment template sources and
 * the public documentation pages.
 *
 * Files outside that list are not scanned on purpose. "Events & Webinars" is a
 * legitimate data category in the vendor mappings, and the vendor catalogue
 * snapshot describes third-party products in their own words.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

/** Split so this file never matches itself. */
const BANNED: Array<{ label: string; pattern: RegExp }> = [
  { label: "association name", pattern: new RegExp("California Lawyers\\s+Association", "i") },
  { label: "workshop", pattern: /\bworkshops?\b/i },
  { label: "taller", pattern: /\btalleres?\b/i },
  { label: "seminario", pattern: /\bseminarios?\b/i },
  { label: "event date (en)", pattern: /\b17 September 20\d\d\b/i },
  { label: "event date (es)", pattern: /\b17 de septiembre de 20\d\d\b/i },
  { label: "as presented at", pattern: /\bas presented at\b/i },
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

const USER_VISIBLE_FILES = [
  path.join(ROOT, "src/messages/en.json"),
  path.join(ROOT, "src/messages/es.json"),
  path.join(ROOT, "src/config/dpia-template-v2.ts"),
  path.join(ROOT, "src/config/health-adtech-template.ts"),
  ...walk(path.join(ROOT, "src/app/(public)/docs")).filter((f) => f.endsWith(".tsx")),
];

describe("wording sweep", () => {
  it("scans the surfaces that carry user-visible copy", () => {
    expect(USER_VISIBLE_FILES.length).toBeGreaterThan(5);
  });

  for (const file of USER_VISIBLE_FILES) {
    const rel = path.relative(ROOT, file);
    it(`names no association, workshop or event in ${rel}`, () => {
      const text = readFileSync(file, "utf8");
      for (const { label, pattern } of BANNED) {
        expect(pattern.test(text), `${rel}: ${label}`).toBe(false);
      }
    });
  }
});
