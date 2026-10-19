// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words of the data map and the transfer forms:
 *   - an internal flow is never called a "transfer" in Spanish (that word is
 *     a Chapter V international transfer);
 *   - every new key exists in English and Spanish;
 *   - the data map has its own menu entry and page;
 *   - the transfer subtitle and the risk scale use words, not en dashes.
 */

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";

type Tree = { [k: string]: string | Tree };

function leaves(o: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(p, v);
    else for (const [kk, vv] of leaves(v, p)) out.set(kk, vv);
  }
  return out;
}

describe("data map and transfer copy", () => {
  it("calls an internal automated flow a flow, in both languages", () => {
    expect(es.dataFlow.sheet.automated).toBe("Flujo automatizado");
    expect(en.dataFlow.sheet.automated).toBe("Automated flow");
    expect(JSON.stringify(es.dataFlow)).not.toMatch(/[Tt]ransferencia automatizada|se transfieren/);
    expect(JSON.stringify(en.dataFlow)).not.toMatch(/Automated Transfer|data is transferred/);
  });

  it("has every data map and transfer key in both languages", () => {
    const sections: [Tree, Tree][] = [
      [en.dataFlow as unknown as Tree, es.dataFlow as unknown as Tree],
      [en.pages.transfers as unknown as Tree, es.pages.transfers as unknown as Tree],
      [en.pages.dataInventory.transferDialog as unknown as Tree, es.pages.dataInventory.transferDialog as unknown as Tree],
      [en.pages.dataMap as unknown as Tree, es.pages.dataMap as unknown as Tree],
    ];
    for (const [a, b] of sections) {
      expect([...leaves(b).keys()].sort()).toEqual([...leaves(a).keys()].sort());
    }
  });

  it("gives the data map its own menu entry and page, labelled in both languages", () => {
    const item = DPO_CENTRAL_PATH.library({ stripeEnabled: false }).find((i) => i.id === "dataMap");
    expect(item?.href).toBe("/privacy/data-map");
    expect(existsSync("src/app/(dashboard)/privacy/data-map/page.tsx")).toBe(true);
    expect(en.guided.library.dataMap).toBe("Data map");
    expect(es.guided.library.dataMap).toBe("Mapa de datos");
  });

  it("writes article and score ranges with words", () => {
    expect(en.pages.dataInventory.transferDialog.description).toContain("Art. 44 to 49");
    const all = JSON.stringify([en.pages.transfers, es.pages.transfers, en.dataFlow, es.dataFlow]);
    expect(all).not.toContain("–");
    expect(JSON.stringify(en)).not.toContain("0–25");
    expect(JSON.stringify(es)).not.toContain("0–25");
  });
});
