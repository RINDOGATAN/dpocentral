// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Each page is titled with its menu label (the technical term stays in the
 * subtitle), and the inventory's records are "systems" on screen: "data
 * asset" is kept for the exports only (PDF, CSV and the portability files).
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

type Msgs = typeof en;

const PAIRS: Array<[string, (m: Msgs) => string, (m: Msgs) => string]> = [
  ["dataInventory", (m) => m.guided.steps.dataInventory.label, (m) => m.pages.dataInventory.title],
  ["ropa", (m) => m.guided.steps.ropa.label, (m) => m.pages.processingActivities.title],
  ["vendors", (m) => m.guided.steps.vendors.label, (m) => m.pages.vendors.title],
  ["aiSystems", (m) => m.guided.steps.aiSystems.label, (m) => m.pages.aiSystems.title],
  ["assessments", (m) => m.guided.steps.assessments.label, (m) => m.pages.assessments.title],
  ["transfers", (m) => m.guided.steps.transfers.label, (m) => m.pages.transfers.list.title],
  ["dsar", (m) => m.guided.steps.dsar.label, (m) => m.pages.dsar.title],
  ["incidents", (m) => m.guided.steps.incidents.label, (m) => m.pages.incidents.title],
  ["applies", (m) => m.guided.steps.applies.label, (m) => m.pages.regulations.title],
  ["quickstart", (m) => m.guided.steps.quickstart.label, (m) => m.pages.quickstart.title],
  ["reports", (m) => m.guided.library.reports, (m) => m.pages.reports.title],
];

function strings(node: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof node === "string") return [[path.join("."), node]];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => strings(v, [...path, k]));
  }
  return [];
}

describe("U1: the page title is the menu label", () => {
  for (const [lang, m] of [["en", en], ["es", es]] as const) {
    for (const [id, menu, title] of PAIRS) {
      it(`${lang} ${id}`, () => {
        expect(title(m as Msgs)).toBe(menu(m as Msgs));
      });
    }
  }

  it("names rights requests' technical term in the subtitle", () => {
    expect(en.pages.dsar.subtitle).toContain("Data subject requests (DSARs)");
  });
});

describe("U1: systems on screen, data asset only in exports", () => {
  it("never says asset on screen in English", () => {
    const hits = strings(en).filter(([k, v]) => !k.startsWith("pdf.") && /\basset/i.test(v.replace(/\{\w+/g, "")));
    expect(hits).toEqual([]);
  });

  it("never says activo de datos on screen in Spanish", () => {
    const hits = strings(es).filter(([k, v]) => !k.startsWith("pdf.") && /\bactivos? de datos\b/i.test(v));
    expect(hits).toEqual([]);
  });
});
