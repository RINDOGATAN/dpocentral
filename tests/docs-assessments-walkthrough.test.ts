// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public documentation of assessments carries the DPIA walkthrough in
 * English and in Castilian Spanish, it matches the real screens, it ends with
 * the conformance table and the export, and it keeps the disclaimer that the
 * product is not legal advice.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const STEPS = [
  "start",
  "create",
  "frameworks",
  "european",
  "california",
  "outstanding",
  "approve",
  "export",
] as const;

type Docs = {
  walkthrough: {
    title: string;
    intro: string;
    actors: Record<string, string>;
    steps: Record<string, { title: string; description: string; detail1?: string; detail2?: string }>;
  };
  conformance: { title: string; intro: string; note: string; disclaimer: string };
  templates: { hostedNote: string };
  exports: { individualFeatures: Record<string, string> };
};

const docs = (bundle: unknown): Docs =>
  (bundle as { docs: { publicAssessments: Docs } }).docs.publicAssessments;

describe("the public DPIA walkthrough", () => {
  for (const [locale, bundle] of [["en", en], ["es", es]] as const) {
    const d = docs(bundle);

    it(`runs through eight steps in ${locale}`, () => {
      expect(Object.keys(d.walkthrough.steps)).toEqual([...STEPS]);
      for (const key of STEPS) {
        expect(d.walkthrough.steps[key].title.length, key).toBeGreaterThan(5);
        expect(d.walkthrough.steps[key].description.length, key).toBeGreaterThan(30);
      }
      expect(d.walkthrough.steps.create.detail1).toBeTruthy();
      expect(d.walkthrough.steps.frameworks.detail2).toBeTruthy();
    });

    it(`ends with the conformance table and the export in ${locale}`, () => {
      expect(STEPS[STEPS.length - 1]).toBe("export");
      expect(d.conformance.title).toBeTruthy();
      expect(d.conformance.note).toBeTruthy();
      expect(d.exports.individualFeatures.conformance).toBeTruthy();
      expect(d.exports.individualFeatures.draft).toBeTruthy();
    });

    it(`keeps the disclaimer in ${locale}`, () => {
      expect(d.conformance.disclaimer).toMatch(
        locale === "es" ? /no asesoramiento jur[ií]dico/i : /not legal advice/i
      );
    });

    it(`says the hosted service opens every type in ${locale}`, () => {
      expect(d.templates.hostedNote.length).toBeGreaterThan(30);
    });
  }

  it("does not repeat the English text in Spanish", () => {
    for (const key of STEPS) {
      expect(docs(es).walkthrough.steps[key].description, key).not.toBe(
        docs(en).walkthrough.steps[key].description
      );
    }
  });

  it("uses plain punctuation, no long dash", () => {
    const texts = [en, es].flatMap((bundle) => {
      const d = docs(bundle);
      return [
        d.walkthrough.title,
        d.walkthrough.intro,
        ...Object.values(d.walkthrough.steps).flatMap((s) => Object.values(s)),
        ...Object.values(d.conformance),
        d.templates.hostedNote,
        d.exports.individualFeatures.conformance,
        d.exports.individualFeatures.draft,
        d.exports.individualFeatures.cover,
      ];
    });
    for (const text of texts.filter((v) => typeof v === "string")) {
      expect(text).not.toMatch(/[—–]/);
    }
  });

  it("is rendered by the page, in the order of the real screens", () => {
    const page = readFileSync(
      path.resolve(__dirname, "..", "src/app/(public)/docs/assessments/page.tsx"),
      "utf8"
    );
    for (const key of STEPS) expect(page, key).toContain(`"${key}"`);
    expect(page).toContain("DPIA_FRAMEWORK_ELEMENTS");
    expect(page).toContain('t("conformance.disclaimer")');
  });
});
