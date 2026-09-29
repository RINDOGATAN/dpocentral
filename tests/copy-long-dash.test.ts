// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Copy rule: no long dash (U+2014) in user-visible copy. A colon, a comma or
 * parentheses read better and translate cleanly.
 *
 * The message bundles still hold older strings with a long dash, many of them
 * legal template text awaiting review. Those are listed, key by key, in
 * tests/fixtures/long-dash-baseline.json and may only shrink: any other key
 * with a long dash fails this check. When you clean a listed string, remove
 * its key from the baseline (the check fails until you do, so the list never
 * goes stale).
 *
 *   npm run lint:copy
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const LONG_DASH = "—";
const BUNDLES = ["en", "es", "fr", "de"];

const baseline: Record<string, string[]> = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/long-dash-baseline.json"), "utf8")
);

/** Every string leaf of a message bundle, keyed by its dotted path. */
export function stringLeaves(node: unknown, prefix = ""): Array<[string, string]> {
  if (typeof node === "string") return [[prefix, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => stringLeaves(v, `${prefix}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => stringLeaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

export function keysWithLongDash(locale: string): string[] {
  const bundle = JSON.parse(readFileSync(path.join(ROOT, `src/messages/${locale}.json`), "utf8"));
  return stringLeaves(bundle)
    .filter(([, text]) => text.includes(LONG_DASH))
    .map(([key]) => key);
}

describe("copy: no long dash in the message bundles", () => {
  for (const locale of BUNDLES) {
    const allowed = new Set(baseline[locale] ?? []);
    const found = keysWithLongDash(locale);

    it(`${locale}.json adds no new long dash`, () => {
      const added = found.filter((k) => !allowed.has(k));
      expect(added, `use a colon, a comma or parentheses instead of a long dash`).toEqual([]);
    });

    it(`${locale}.json baseline lists only strings that still carry one`, () => {
      const present = new Set(found);
      const cleaned = [...allowed].filter((k) => !present.has(k));
      expect(cleaned, `remove these keys from tests/fixtures/long-dash-baseline.json`).toEqual([]);
    });
  }

  it("the three strings found in the September browser round stay clean", () => {
    const fixed = [/quickstart\.applies\.skip$/, /lockedSubtitle$/, /modalDescription$/, /localSignInBody$/];
    for (const locale of BUNDLES) {
      const keys = [...keysWithLongDash(locale), ...(baseline[locale] ?? [])];
      for (const re of fixed) expect(keys.filter((k) => re.test(k)), `${locale}: ${re}`).toEqual([]);
    }
  });
});
