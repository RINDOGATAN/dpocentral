// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public documentation carries a "Hosted pilot" section, early on the
 * overview page, in English and in Castilian Spanish. It says what the hosted
 * service allows (the editing window, the impact assessments, the record
 * ceilings), that real client data may be used (as on the landing), it states
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
import { PILOT_DAYS, PILOT_LIMITS } from "@/server/services/pilot/caps";

type Section = {
  title: string;
  intro: string;
  window: string;
  ceilingsTitle: string;
  ceilingsIntro: string;
  exports: string;
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

    it(`states every limit and where real data goes in ${locale}`, () => {
      for (const [key, text] of Object.entries(s)) {
        expect(typeof text, key).toBe("string");
        expect(text.length, key).toBeGreaterThan(5);
      }
      expect(s.window).toContain("{days}");
      // Owner, 16 Oct 2026: the public docs do not state how many organizations an account may hold.
      expect(JSON.stringify(s)).not.toMatch(/organizations per account|organizaciones por cuenta|up to \{organizations\}/i);
      // The intro names the limits and, as the landing does, that real client data may be used;
      // the next paragraph ("run") carries the paid plan and the quotation. No "no safeguards" line.
      expect(s.intro).toMatch(locale === "es" ? /dentro de los límites/ : /within the limits set out below\./);
      expect(s.intro).toContain(locale === "es"
        ? "Puedes empezar gratis y usarlo con datos reales de clientes: todos nuestros subencargados cuentan con las certificaciones y garantías necesarias."
        : "You can start free and use it with real client data: all our sub-processors have the necessary safeguards and certifications.");
      expect(s.intro).not.toMatch(/For real data|Para datos reales|test records|registros de prueba|capped|con límites/);
      // The paid plan lifts the limits; the prices stay on the pricing page, never in the app.
      expect(s.run).toMatch(locale === "es" ? /plan de pago/ : /paid plan/);
      expect(s.run).not.toMatch(/[€$]\s?\d|\d\s?[€$]/);
      expect(Object.keys(s)).not.toContain("safeguards");
      expect(JSON.stringify(s)).not.toMatch(/contractual safeguards|garantías contractuales/);
    });

    it(`names no DPIA allowance in ${locale}`, () => {
      expect(Object.keys(s)).not.toContain("assessments");
      expect(JSON.stringify(s)).not.toMatch(/DPIA|EIPD/);
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
      expect(PAGE, key).toContain(`hostedPilot.${key}`);
    }
  });

  it("takes its figures from the pilot configuration", () => {
    expect(PAGE).toContain("PILOT_DAYS");
    // DPIAs are not capped: the page names no DPIA allowance.
    expect(PAGE).not.toContain("PILOT_DPIA_LIMIT");
    expect(PAGE).not.toContain("hostedPilot.assessments");
    expect(PAGE).toContain("PILOT_LIMITS");
    expect(PAGE).toContain("RESOURCE_LABELS");
    expect(PAGE).not.toContain("ORGANIZATIONS_PER_ACCOUNT");
    // Nothing in the copy hard-codes a figure the configuration owns.
    for (const s of [section(en), section(es)]) {
      expect(s.window).not.toContain(String(PILOT_DAYS));
      expect(s).not.toHaveProperty("assessments");
      expect(s.ceilingsIntro).not.toMatch(/\d/);
    }
    expect(Object.keys(PILOT_LIMITS).length).toBeGreaterThan(5);
  });

  it("keeps the anchor the pilot links point to", () => {
    expect(PILOT_DOCS_PATH).toBe("/docs#hosted-pilot");
    expect(PAGE).toContain('id="hosted-pilot"');
  });
});
