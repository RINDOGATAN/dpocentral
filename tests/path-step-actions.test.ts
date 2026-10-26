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
  it("the band says what finishes the assessments step, and why a DPIA is required, in both languages", () => {
    expect(band).not.toContain("band.assessmentsCounts");
    expect(band).toContain('t("band.dpiaWhy"');
    expect(band).toContain('t("band.dpiaAnswersLink")');
    expect(band).toContain('href="/privacy/settings#applicability"');
    for (const m of [en, es]) {
      expect(m.guided.band).not.toHaveProperty("assessmentsCounts");
      for (const text of [m.guided.band.dpiaWhy, m.guided.band.dpiaAnswersLink, m.guided.finish.assessments, m.guided.finish.assessmentsDpia]) {
        expect(text.length).toBeGreaterThan(5);
        expect(text).not.toMatch(LONG_DASH);
      }
    }
    expect(en.guided.finish.assessments).toMatch(/any type/i);
    expect(es.guided.finish.assessments).toMatch(/cualquier tipo/);
    expect(es.guided.finish.assessmentsDpia).toContain("EIPD");
    expect(en.guided.finish.assessmentsDpia).toContain("DPIA");
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
