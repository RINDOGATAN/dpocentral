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
 *   - a long dash (U+2014): use a colon, a comma or parentheses instead;
 *   - a short list of Latin American terms that read as foreign in Spain.
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

describe("Spanish copy", () => {
  it("scans the app bundle and the landing bundles", () => {
    expect(BUNDLES.length).toBeGreaterThan(1);
  });

  for (const bundle of BUNDLES) {
    const es = leaves(readJson(bundle.es));
    const en = leaves(readJson(bundle.en));

    it(`${bundle.name} has every key the English bundle has`, () => {
      const esKeys = new Set(es.map(([k]) => k));
      expect(en.map(([k]) => k).filter((k) => !esKeys.has(k))).toEqual([]);
    });

    it(`${bundle.name} addresses the reader as tú, never usted`, () => {
      expect(es.filter(([, t]) => USTED.test(t)).map(([k, t]) => `${k}: ${t}`)).toEqual([]);
    });

    it(`${bundle.name} carries no long dash`, () => {
      expect(es.filter(([, t]) => t.includes("—")).map(([k]) => k)).toEqual([]);
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
  });
});
