// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public documentation follows the offer as it stands (owner, 10 Oct 2026):
 * three hosting options in the landing's own words, the whole-programme export
 * and import, AI features off until an Owner or Admin turns them on, and no
 * vendor questionnaires sent from DPO Central (vendors state their practices on
 * Vendor.Watch). It never brings back the six-week engagement, a "no
 * certification" line or "no contractual safeguards", and the links to it are
 * labelled "Docs" / "Documentación".
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import landingEn from "@/landing/i18n/en/dpo-startups.json";
import landingEs from "@/landing/i18n/es/dpo-startups.json";

type Bundle = typeof en;
const docs = (b: unknown) => (b as Bundle).docs;
const all = (o: unknown): string[] =>
  typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(all) : [];

const BANNED =
  /six.week|seis semanas|runbook|manual de operaci|no independent certification|no security certification|sin certificaci[oó]n independiente|no tenemos certificaci|sin certificaci[oó]n de seguridad|no contractual safeguards|sin garant[ií]as contractuales|not meant for real/i;

describe("the documentation follows the offer", () => {
  for (const [locale, bundle, landing] of [
    ["en", en, landingEn],
    ["es", es, landingEs],
  ] as const) {
    const d = docs(bundle);
    const L = landing as Record<string, string>;

    it(`never brings back the engagement or a "no guarantees" line in ${locale}`, () => {
      for (const text of all(d)) expect(text).not.toMatch(BANNED);
    });

    it(`states the three hosting options in the landing's words in ${locale}`, () => {
      const h = d.publicOverview.hosting;
      expect(h.intro).toBe(L[`${locale}.ways.sub`]);
      expect(h.cloud.desc).toBe(L[`${locale}.ways.w1.desc`]);
      expect(h.managed.desc).toBe(L[`${locale}.ways.w2.desc`]);
      expect(h.own.desc).toBe(L[`${locale}.ways.w3.desc`]);
    });

    it(`describes the programme export, the import and AI off by default in ${locale}`, () => {
      expect(d.publicOverview.portability.export).toMatch(/programme\.json/);
      expect(d.publicOverview.portability.import).toMatch(/CSV/);
      expect(d.publicOverview.ai.body).toMatch(locale === "es" ? /desactivadas/ : /are off/);
    });

    it(`never claims questionnaires are sent to vendors in ${locale}`, () => {
      const vendorText = [...all(d.publicVendors), ...all(d.vendors)].join("\n");
      expect(vendorText).not.toMatch(locale === "es" ? /(?<!no )env[ií]a (el |un |)cuestionario/i : /(?<!not )send (a |the |privacy |standardized )?(due diligence )?questionnaire/i);
    });

    it(`labels the links to the documentation as ${locale === "es" ? "Documentación" : "Docs"}`, () => {
      const want = locale === "es" ? "Documentación" : "Docs";
      const b = bundle as unknown as { footer: Record<string, string> };
      expect(b.footer.docs).toBe(want);
      expect(b.footer.userGuide).toBe(want);
      expect(d.shell.userGuide).toBe(want);
    });
  }
});
