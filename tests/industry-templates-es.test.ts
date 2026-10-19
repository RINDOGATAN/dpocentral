// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The industry quick-start templates read in Spanish on Spanish screens:
 * every user-visible string has a Spanish entry, the localized templates keep
 * their cross-references, and no template names a real company.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  INDUSTRY_TEMPLATES,
  localizeTemplate,
  returnFlowName,
  type IndustryTemplate,
} from "@/config/industry-templates";
import { INDUSTRY_TEMPLATES_ES, INDUSTRY_TEMPLATE_ASSET_ARTICLES_ES } from "@/config/industry-templates-es";

function visibleStrings(t: IndustryTemplate): string[] {
  const out: string[] = [t.name, t.description];
  for (const a of t.assets) {
    out.push(a.name, a.description, a.hostingType, a.owner, ...a.elements.map((e) => e.name));
  }
  for (const a of t.activities) {
    out.push(a.name, a.description, a.purpose, a.retentionPeriod, ...a.dataSubjects, ...a.recipients, ...a.assetNames);
    if (a.legalBasisNote) out.push(a.legalBasisNote);
  }
  for (const f of t.flows) {
    out.push(f.name, f.description, f.frequency, f.sourceAssetName, f.destAssetName);
    if (f.returnFlow) {
      out.push(f.returnFlow.description);
      if (f.returnFlow.frequency) out.push(f.returnFlow.frequency);
    }
  }
  return out;
}

describe("industry templates in Spanish", () => {
  it("every user-visible string has a Spanish entry", () => {
    const missing = INDUSTRY_TEMPLATES.flatMap(visibleStrings).filter((s) => !(s in INDUSTRY_TEMPLATES_ES));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("English stays unchanged", () => {
    for (const t of INDUSTRY_TEMPLATES) expect(localizeTemplate(t, "en")).toBe(t);
  });

  it("localized cross-references still resolve and asset names stay distinct", () => {
    for (const t of INDUSTRY_TEMPLATES.map((x) => localizeTemplate(x, "es"))) {
      const names = t.assets.map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
      for (const a of t.activities) for (const n of a.assetNames) expect(names).toContain(n);
      for (const f of t.flows) {
        expect(names).toContain(f.sourceAssetName);
        expect(names).toContain(f.destAssetName);
      }
    }
  });

  it("the Spanish text names no real company and has no long dash", () => {
    const all = [
      ...INDUSTRY_TEMPLATES.flatMap(visibleStrings),
      ...Object.values(INDUSTRY_TEMPLATES_ES),
    ].join("\n");
    expect(all).not.toMatch(/stripe|paypal|datadog|sentry/i);
    expect(all).not.toMatch(/[–—]/);
    expect(Object.values(INDUSTRY_TEMPLATES_ES).join("\n")).not.toMatch(/\busted(es)?\b|\bvosotros\b/i);
  });

  it("return flows are named in the screen's language", () => {
    expect(returnFlowName("A", "B", "en")).toBe("A to B");
    expect(returnFlowName("A", "B", "es")).toBe("De A a B");
    expect(returnFlowName("Sistema de gestión de pedidos", "Base de datos de clientes", "es")).toBe(
      "Del sistema de gestión de pedidos a la base de datos de clientes",
    );
    expect(returnFlowName("CRM", "SAP Business One", "es")).toBe("De CRM a SAP Business One");
    expect(returnFlowName("Stripe", "Base de datos", "en")).toBe("Stripe to Base de datos");
  });

  it("every Spanish system name has its article", () => {
    const names = INDUSTRY_TEMPLATES.flatMap((t) => localizeTemplate(t, "es").assets.map((a) => a.name));
    expect(names.filter((n) => !(n in INDUSTRY_TEMPLATE_ASSET_ARTICLES_ES))).toEqual([]);
  });

  it("return flows take the article and contraction of each system", () => {
    expect(returnFlowName("Portal del paciente", "Historia clínica electrónica (HCE)", "es")).toBe(
      "Del portal del paciente a la historia clínica electrónica (HCE)",
    );
    expect(returnFlowName("Pasarela de pago", "Sistema de gestión de pedidos", "es")).toBe(
      "De la pasarela de pago al sistema de gestión de pedidos",
    );
    expect(returnFlowName("Plataforma de boletines", "Registros de la aplicación", "es")).toBe(
      "De la plataforma de boletines a los registros de la aplicación",
    );
    expect(returnFlowName("Portal del paciente", "Historia clínica electrónica (HCE)", "en")).toBe(
      "Portal del paciente to Historia clínica electrónica (HCE)",
    );
  });

  it("every Spanish flow name carries its articles", () => {
    const names = INDUSTRY_TEMPLATES.flatMap((t) => {
      const es = localizeTemplate(t, "es");
      return es.flows.flatMap((f) =>
        f.returnFlow ? [f.name, returnFlowName(f.destAssetName, f.sourceAssetName, "es")] : [f.name],
      );
    });
    expect(names.length).toBeGreaterThan(0);
    // "De " is followed by an article ("De la", "De los", "De las") or is the
    // contraction "Del"; the destination is introduced by "a la/los/las" or "al".
    for (const n of names) {
      expect(n).toMatch(/^(Del |De (la|los|las) )/);
      expect(n).toMatch(/ (al|a (la|los|las)) /);
    }
  });
});

describe("the healthcare template's legal basis", () => {
  const healthcare = INDUSTRY_TEMPLATES.find((t) => t.id === "healthcare")!;
  const care = healthcare.activities.find((a) => a.name === "Patient Care & Treatment")!;

  it("uses public task (Art. 6(1)(e)), not vital interests, and names the private-care variant", () => {
    expect(care.legalBasis).toBe("PUBLIC_TASK");
    expect(care.legalBasisNote).toContain("Art. 6(1)(e)");
    expect(care.legalBasisNote).toContain("Art. 6(1)(b)");
    expect(care.legalBasisNote).toContain("Art. 9(2)(h) and 9(3)");
    expect(healthcare.activities.some((a) => a.legalBasis === "VITAL_INTERESTS")).toBe(false);
    expect(healthcare.description).toContain("Illustrative example: check the legal basis for your case.");
    const es = localizeTemplate(healthcare, "es");
    const esCare = es.activities.find((a) => a.name === "Atención y tratamiento de pacientes")!;
    expect(esCare.legalBasis).toBe("PUBLIC_TASK");
    expect(esCare.legalBasisNote).toContain("art. 6.1.e)");
    expect(esCare.legalBasisNote).toContain("art. 6.1.b)");
    expect(esCare.legalBasisNote).toContain("arts. 9.2.h) y 9.3");
    expect(es.description).toContain("Ejemplo con fines ilustrativos: revisa la base jurídica para tu caso.");
  });

  it("the quick start writes the note to the activity's legal basis detail", () => {
    const src = readFileSync(path.join(__dirname, "../src/server/routers/privacy/quickstart.ts"), "utf8");
    expect(src).toContain("legalBasisDetail: templateActivity.legalBasisNote");
  });
});
