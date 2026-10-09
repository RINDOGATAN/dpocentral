// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The user guide describes the product as it is since the Classic layout was
 * retired (9 October 2026): the Guided dashboard, its documents panel, the
 * next actions and deadlines, the menu, All clients and the executive report.
 * Nothing in the guide may describe the retired screens (counter cards, quick
 * actions, recent activity, the client cards), in English or in Spanish, and
 * every section the guide's table of contents links to must exist.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Every string leaf of a bundle node, keyed by its dotted path. */
function stringLeaves(node: unknown, prefix = ""): Array<[string, string]> {
  if (typeof node === "string") return [[prefix, node]];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => stringLeaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

const RETIRED: Record<"en" | "es", RegExp> = {
  en: /quick actions?\b|recent activity|stat cards are|main navigation|my clients|client cards?|layout switch|classic/i,
  es: /acciones? rápidas?|actividad reciente|tarjetas de estadísticas son|navegación principal|mis clientes|tarjetas? de cliente|clásic[oa]/i,
};

type Bundle = { docs: Record<string, unknown> };

describe("the user guide describes the Guided product", () => {
  for (const [locale, bundle] of [["en", en], ["es", es]] as const) {
    const docs = (bundle as unknown as Bundle).docs;

    it(`names no retired screen in ${locale}`, () => {
      const hits = stringLeaves(docs, "docs").filter(([, text]) => RETIRED[locale].test(text));
      expect(hits).toEqual([]);
    });

    it(`has the Getting started sections in ${locale}`, () => {
      const gs = docs.gettingStarted as Record<string, unknown>;
      expect(Object.keys(gs)).toEqual([
        "title",
        "subtitle",
        "dashboard",
        "documents",
        "nextActions",
        "quickstart",
        "navigation",
        "roles",
        "nav",
      ]);
    });
  }

  it("does not repeat the English text in Spanish", () => {
    const enGs = stringLeaves((en as unknown as Bundle).docs.gettingStarted);
    const esGs = new Map(stringLeaves((es as unknown as Bundle).docs.gettingStarted));
    for (const [key, text] of enGs) {
      if (text.length > 20) expect(esGs.get(key), key).not.toBe(text);
    }
  });

  it("links only to sections that exist", () => {
    const toc = read("src/components/docs/toc-sidebar.tsx");
    const pages: Record<string, string> = {
      "/privacy/docs": "src/app/(dashboard)/privacy/docs/page.tsx",
      "/privacy/docs/experts": "src/app/(dashboard)/privacy/docs/experts/page.tsx",
      "/privacy/docs/reports": "src/app/(dashboard)/privacy/docs/reports/page.tsx",
    };
    for (const [href, file] of Object.entries(pages)) {
      const block = toc.split(`href: "${href}",`)[1]?.split("href:")[0] ?? "";
      const hashes = [...block.matchAll(/hash: "#([\w-]+)"/g)].map((m) => m[1]);
      expect(hashes.length, href).toBeGreaterThan(0);
      const page = read(file);
      for (const hash of hashes) expect(page, `${href}#${hash}`).toContain(`id="${hash}"`);
    }
  });

  describe("the table of contents speaks the reader's language", () => {
    const toc = read("src/components/docs/toc-sidebar.tsx");
    type TocBundle = Record<string, { label: string; items?: Record<string, string> }>;
    const enToc = (en as unknown as { docs: { toc: TocBundle } }).docs.toc;
    const esToc = (es as unknown as { docs: { toc: TocBundle } }).docs.toc;

    // Each section of the component, with the keys of its entries.
    const sections = toc
      .split(/\n  \{\n    href: /)
      .slice(1)
      .map((block) => ({
        key: /key: "(\w+)"/.exec(block)![1],
        children: [...block.matchAll(/\{ key: "(\w+)", hash:/g)].map((m) => m[1]),
      }));

    it("holds no hard-coded label and reads docs.toc", () => {
      expect(toc).not.toMatch(/label: "/);
      expect(toc).toContain('useTranslations("docs.toc")');
      expect(sections.length).toBeGreaterThan(10);
    });

    for (const [locale, bundle] of [["en", enToc], ["es", esToc]] as const) {
      it(`has every label in ${locale}`, () => {
        for (const { key, children } of sections) {
          expect(bundle[key]?.label, `${locale} ${key}`).toBeTruthy();
          for (const child of children) expect(bundle[key]?.items?.[child], `${locale} ${key}.${child}`).toBeTruthy();
        }
      });
    }

    it("never falls back to English in Spanish", () => {
      // Abbreviations that read the same in both languages.
      const same = new Set(["premium.items.pia", "premium.items.tia"]);
      expect(Object.keys(esToc)).toEqual(Object.keys(enToc));
      for (const [key, text] of stringLeaves(enToc)) {
        const spanish = stringLeaves(esToc).find(([k]) => k === key)?.[1];
        expect(spanish, key).toBeTruthy();
        if (!same.has(key)) expect(spanish, key).not.toBe(text);
      }
      const allEs = stringLeaves(esToc).map(([, text]) => text).join(" | ");
      expect(allEs).not.toMatch(/\b(Guide|Overview|Management|Tracking|Settings|Reports?)\b/);
    });
  });
});
