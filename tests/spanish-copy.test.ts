// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Spanish copy is Castilian (peninsular) Spanish that addresses the
 * reader as "tú". This test scans every Spanish bundle (the app's
 * src/messages/es.json and the landing site's src/landing/i18n/es/*.json)
 * and fails on:
 *
 *   - a key present in the English bundle and missing from the Spanish one;
 *   - an "usted" form ("usted", "ustedes", "Ud.", "Uds.", "Vd.", "Vds.");
 *   - a plural "vosotros" address ("vuestra organización", "podéis");
 *   - "Términos de(l) servicio/uso": the product says «Condiciones»;
 *   - a long dash (U+2014): use a colon, a comma or parentheses instead;
 *   - a short list of Latin American terms that read as foreign in Spain;
 *   - "Skills" or "marketplace": the Spanish UI says «Módulos» and
 *     «catálogo de módulos» (the {skill} placeholder and the .skill file
 *     extension are not words and pass);
 *   - "retención": data retention in the RGPD sense is «conservación»;
 *   - an English-style article citation ("art. 6(1)(f)"): Spanish writes
 *     "art. 6.1.f)", "art. 32.1 del RGPD", "arts. 13 y 14".
 *
 * The Latin American list is deliberately narrow and matches whole word
 * forms only, so valid Castilian words are not caught ("datos agregados",
 * "ingresos", "presión" and "llena" as an adjective all pass).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

type Tree = Record<string, unknown>;

function leaves(node: unknown, prefix = ""): Array<[string, string]> {
  if (typeof node === "string") return [[prefix, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

const LANDING_ES = path.join(ROOT, "src/landing/i18n/es");
const LANDING_EN = path.join(ROOT, "src/landing/i18n/en");

/** Every Spanish bundle, paired with its English counterpart. */
const BUNDLES: Array<{ name: string; es: string; en: string }> = [
  { name: "src/messages/es.json", es: path.join(ROOT, "src/messages/es.json"), en: path.join(ROOT, "src/messages/en.json") },
  ...readdirSync(LANDING_ES)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: `src/landing/i18n/es/${f}`, es: path.join(LANDING_ES, f), en: path.join(LANDING_EN, f) })),
];

/** Formal address: the product always says "tú". */
const USTED = /\b(usted(es)?|Uds?\.|Vds?\.)(?=\s|$|[,.;:)])/i;

/** Plural second person: the reader is always one "tú", never "vosotros". */
const VOSOTROS = /\b(vosotr[oa]s|vuestr[oa]s?|descubrís|abráis|poneos|os rogamos|podéis|tenéis|necesitáis|queréis|habéis)\b/i;

/** One wording for the service terms everywhere. */
const TERMS = /\bTérminos (de|del) (servicio|uso)\b/i;

/** Latin American vocabulary, whole word forms only. */
const LATAM: Array<{ term: string; pattern: RegExp }> = [
  { term: "computadora / computador", pattern: /\bcomputador(a|as|es)?\b/i },
  { term: "celular", pattern: /\bcelular(es)?\b/i },
  { term: "cliquear", pattern: /\bcliqu(ea|ear|ee|een|eas)\b/i },
  { term: "presionar (a key or button)", pattern: /\bpresion(a|ar|e|en|as)\b/i },
  { term: "llenar (a form)", pattern: /\bllen(ar|e|en)\b/i },
  { term: "agregar (to add)", pattern: /\bagreg(a|ar|ue|uen|as|ando)\b/i },
  { term: "ingresar (to type in)", pattern: /\bingres(a|ar|e|en|as)\b/i },
  { term: "reporte", pattern: /\breportes?\b/i },
  { term: "aplicativo", pattern: /\baplicativos?\b/i },
  { term: "chequear / checar", pattern: /\b(chequ(ea|ear|ee)|chec(a|ar))\b/i },
  { term: "ahorita", pattern: /\bahorita\b/i },
];

/** «Módulos» and «catálogo de módulos», never the English product words. */
const SKILLS = /(?<![.{\w])skills?\b(?!\})|\bmarketplace\b/i;

/** Data retention is «conservación» (RGPD art. 5.1.e). */
const RETENCION = /\bretenci[oó]n(es)?\b/i;

/** Article citations in Spanish style: "art. 6.1.f)", never "art. 6(1)(f)". */
const PAREN_CITATION = /\b(arts?\.|art[ií]culos?)\s?\d+\(\d+\)|\(\d+\)\([a-z]\)/i;

describe("Spanish copy", () => {
  it("scans the app bundle and the landing bundles", () => {
    expect(BUNDLES.length).toBeGreaterThan(1);
  });

  for (const bundle of BUNDLES) {
    const es = leaves(readJson(bundle.es));
    const en = leaves(readJson(bundle.en));

    it(`${bundle.name} has every key the English bundle has`, () => {
      const esKeys = new Set(es.map(([k]) => k));
      // Keys under `en.` are the English landing's own sections (its copy is
      // written for the US, not translated), as `es.` keys are the Spanish
      // landing's; neither needs a counterpart in the other bundle.
      expect(en.map(([k]) => k).filter((k) => !k.startsWith("en.") && !esKeys.has(k))).toEqual([]);
    });

    it(`${bundle.name} addresses the reader as tú, never usted`, () => {
      expect(es.filter(([, t]) => USTED.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} addresses one reader, never vosotros`, () => {
      expect(es.filter(([, t]) => VOSOTROS.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} names the service terms «Condiciones»`, () => {
      expect(es.filter(([, t]) => TERMS.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} carries no long dash`, () => {
      expect(es.filter(([, t]) => t.includes("—")).map(([k]) => k)).toEqual([]);
    });

    it(`${bundle.name} says «Módulos», never "Skills" or "marketplace"`, () => {
      expect(es.filter(([, t]) => SKILLS.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} says «conservación», never "retención"`, () => {
      expect(es.filter(([, t]) => RETENCION.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} cites articles in the Spanish style`, () => {
      expect(es.filter(([, t]) => PAREN_CITATION.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} uses no Latin American vocabulary`, () => {
      const found = es.flatMap(([k, t]) =>
        LATAM.filter(({ pattern }) => pattern.test(t)).map(({ term }) => `${k}: ${term}`)
      );
      expect(found).toEqual([]);
    });
  }

  it("the rules catch what they are meant to catch", () => {
    expect(USTED.test("Si usted lo desea")).toBe(true);
    expect(USTED.test("Ud. puede")).toBe(true);
    expect(USTED.test("Tú puedes")).toBe(false);
    const hit = (t: string) => LATAM.some(({ pattern }) => pattern.test(t));
    expect(hit("Presiona el botón")).toBe(true);
    expect(hit("Agrega un proveedor")).toBe(true);
    expect(hit("Ingresa tu correo")).toBe(true);
    expect(hit("Datos agregados por región")).toBe(false);
    expect(hit("Ingresos anuales")).toBe(false);
    expect(hit("Alta presión regulatoria")).toBe(false);
    expect(SKILLS.test("Explorar el marketplace")).toBe(true);
    expect(SKILLS.test("Página de Skills")).toBe(true);
    expect(SKILLS.test("Activar {skill}")).toBe(false);
    expect(SKILLS.test("Elegir archivo .skill")).toBe(false);
    expect(RETENCION.test("Periodo de retención")).toBe(true);
    expect(RETENCION.test("Plazo de conservación")).toBe(false);
    expect(PAREN_CITATION.test("Interés legítimo (art. 6(1)(f))")).toBe(true);
    expect(PAREN_CITATION.test("condición del artículo 9(2)")).toBe(true);
    expect(PAREN_CITATION.test("Interés legítimo (art. 6.1.f))")).toBe(false);
    expect(PAREN_CITATION.test("art. 32.1 del RGPD; arts. 13 y 14")).toBe(false);
    expect(PAREN_CITATION.test("11 CCR 7152(a)(1) a (3)")).toBe(false);
  });
});
