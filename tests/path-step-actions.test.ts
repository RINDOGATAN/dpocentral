// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Every path step says what moves it forward: the band shows what completes
 * the step, the assessments step says which assessments do not count, and
 * optional steps say they are optional (in the band and in the menu).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import en from "../src/messages/en.json";
import es from "../src/messages/es.json";
import { DPO_CENTRAL_PATH } from "../src/components/guided/path-config";

const band = readFileSync("src/components/guided/step-band.tsx", "utf8");
const menu = readFileSync("src/components/guided/path-menu.tsx", "utf8");
const LONG_DASH = /[–—]/;

describe("path step actions", () => {
  it("the band names which assessments do not count, in both languages", () => {
    expect(band).toContain('t("band.assessmentsCounts")');
    for (const m of [en, es]) {
      const text = m.guided.band.assessmentsCounts;
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toMatch(LONG_DASH);
    }
    expect(es.guided.band.assessmentsCounts).toContain("EIPD");
    expect(en.guided.band.assessmentsCounts).toContain("DPIA");
  });

  it("every optional step shown in the band has its sentence in both languages", () => {
    const optional = DPO_CENTRAL_PATH.stages.flatMap((s) => s.steps).filter((s) => s.optional);
    expect(optional.map((s) => s.id)).toEqual(expect.arrayContaining(["aiSystems", "lia"]));
    for (const id of ["aiSystems", "lia"]) {
      for (const m of [en, es]) {
        const text = (m.guided.band.optional as Record<string, string>)[id];
        expect(text).toBeTruthy();
        expect(text).not.toMatch(LONG_DASH);
      }
    }
    expect(es.guided.band.optional.lia.startsWith("Opcional:")).toBe(true);
    expect(en.guided.band.optional.lia.startsWith("Optional:")).toBe(true);
  });

  it("the menu marks optional steps visibly", () => {
    expect(menu).toContain("step-optional-");
    expect(menu).toContain('t("stepStatus.optional")');
  });

  it("every step listed for a finishing sentence has one in both languages", () => {
    const ids = ["quickstart", "applies", "dataInventory", "ropa", "vendors", "transfers", "dsar"];
    for (const id of ids) {
      expect(band).toContain(`"${id}"`);
      for (const m of [en, es]) {
        const text = (m.guided.finish as Record<string, string>)[id];
        expect(text).toBeTruthy();
        expect(text).not.toMatch(LONG_DASH);
      }
    }
  });
});
