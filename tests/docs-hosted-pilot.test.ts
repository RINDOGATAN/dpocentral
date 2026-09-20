// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public documentation carries a "Hosted pilot" section, early on the
 * overview page, in English and in Castilian Spanish. It says what the hosted
 * service allows (the editing window, the impact assessments, the record
 * ceilings) and what it does not carry (contractual safeguards), it states
 * that exports are never limited, and the banner's "see docs" link lands on it.
 * The figures are read from the pilot configuration, so the page cannot state
 * a number the product does not enforce.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { PILOT_DOCS_PATH } from "@/lib/hosted";
import { HOSTED_DPIA_LIMIT, PILOT_DAYS, PILOT_LIMITS } from "@/server/services/pilot/caps";

type Section = {
  title: string;
  intro: string;
  window: string;
  assessments: string;
  ceilingsTitle: string;
  ceilingsIntro: string;
  oneOrganization: string;
  exports: string;
  safeguards: string;
  run: string;
};

const section = (bundle: unknown): Section =>
  (bundle as { docs: { publicOverview: { hostedPilot: Section } } }).docs.publicOverview
    .hostedPilot;

const PAGE = readFileSync(
  path.resolve(__dirname, "..", "src/app/(public)/docs/page.tsx"),
  "utf8"
);

describe("the hosted pilot documentation", () => {
  for (const [locale, bundle] of [["en", en], ["es", es]] as const) {
    const s = section(bundle);

    it(`states every limit and the absence of safeguards in ${locale}`, () => {
      for (const [key, text] of Object.entries(s)) {
        expect(typeof text, key).toBe("string");
        expect(text.length, key).toBeGreaterThan(5);
      }
      expect(s.window).toContain("{days}");
      expect(s.assessments).toContain("{assessments}");
      expect(s.run).toContain("<run>");
    });

    it(`says the count is of assessments created in ${locale}`, () => {
      expect(s.assessments).toMatch(locale === "es" ? /creadas/i : /created/i);
    });

    it(`says exports are not limited in ${locale}`, () => {
      expect(s.exports).toMatch(locale === "es" ? /no tienen l[ií]mite/i : /not limited/i);
    });

    it(`uses plain punctuation, no long dash, in ${locale}`, () => {
      for (const [key, text] of Object.entries(s)) expect(text, key).not.toMatch(/[—–]/);
    });
  }

  it("does not repeat the English text in Spanish", () => {
    for (const key of Object.keys(section(en)) as (keyof Section)[]) {
      expect(section(es)[key], key).not.toBe(section(en)[key]);
    }
  });

  it("speaks to the reader as tu, never usted", () => {
    for (const text of Object.values(section(es))) {
      expect(text).not.toMatch(/\busted(es)?\b/i);
    }
  });

  it("is rendered by the overview page, before the quick start", () => {
    expect(PAGE).toContain('id="hosted-pilot"');
    expect(PAGE.indexOf('id="hosted-pilot"')).toBeLessThan(PAGE.indexOf("quickstart.title"));
    for (const key of Object.keys(section(en))) {
      if (key === "run") expect(PAGE).toContain('t.rich("hostedPilot.run"');
      else expect(PAGE, key).toContain(`hostedPilot.${key}`);
    }
  });

  it("takes its figures from the pilot configuration", () => {
    expect(PAGE).toContain("PILOT_DAYS");
    expect(PAGE).toContain("HOSTED_DPIA_LIMIT");
    expect(PAGE).toContain("PILOT_LIMITS");
    expect(PAGE).toContain("RESOURCE_LABELS");
    // Nothing in the copy hard-codes a figure the configuration owns.
    for (const s of [section(en), section(es)]) {
      expect(s.window).not.toContain(String(PILOT_DAYS));
      expect(s.assessments).not.toContain(String(HOSTED_DPIA_LIMIT));
      expect(s.ceilingsIntro).not.toMatch(/\d/);
    }
    expect(Object.keys(PILOT_LIMITS).length).toBeGreaterThan(5);
  });

  it("is where the banner's link lands", () => {
    expect(PILOT_DOCS_PATH).toBe("/docs#hosted-pilot");
    expect(
      readFileSync(
        path.resolve(__dirname, "..", "src/components/pilot/hosted-pilot.tsx"),
        "utf8"
      )
    ).toContain("PILOT_DOCS_PATH");
  });
});
