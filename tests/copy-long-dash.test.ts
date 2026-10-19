// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Copy rule: no long dash (U+2014) in user-visible copy, and no en dash
 * (U+2013) used as a range or a break either ("0 to 25", "Articles 44 to 49").
 * A colon, a comma or parentheses read better and translate cleanly.
 *
 * Two places are checked: the message bundles, and the string literals,
 * template literals and JSX text of src/**\/*.ts(x), read with the TypeScript
 * parser so that comments (which never render) are not flagged.
 *
 * The message bundles still hold older strings with a long dash, many of them
 * legal template text awaiting review. Those are listed, key by key, in
 * tests/fixtures/long-dash-baseline.json and may only shrink: any other key
 * with a long dash fails this check. When you clean a listed string, remove
 * its key from the baseline (the check fails until you do, so the list never
 * goes stale).
 *
 *   npm run lint:copy
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import ts from "typescript";

const ROOT = path.resolve(__dirname, "..");
const LONG_DASH = "—";
const EN_DASH = "–";
const BUNDLES = ["en", "es", "fr", "de"];

const baseline: Record<string, string[]> = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/long-dash-baseline.json"), "utf8")
);

/** Every string leaf of a message bundle, keyed by its dotted path. */
export function stringLeaves(node: unknown, prefix = ""): Array<[string, string]> {
  if (typeof node === "string") return [[prefix, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => stringLeaves(v, `${prefix}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => stringLeaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

export function keysWithLongDash(locale: string): string[] {
  const bundle = JSON.parse(readFileSync(path.join(ROOT, `src/messages/${locale}.json`), "utf8"));
  return stringLeaves(bundle)
    .filter(([, text]) => text.includes(LONG_DASH))
    .map(([key]) => key);
}

/**
 * Message keys that may keep an en dash: the answer options of the DPIA
 * template's question 1.5, which mirror src/config/dpia-template-v2.ts and are
 * stored as the answer itself in existing assessments (changing the text would
 * orphan those answers).
 */
const EN_DASH_ALLOWED = new Set([
  "templates.dpia.question.q1_5.options[1]",
  "templates.dpia.question.q1_5.options[2]",
  "templates.dpia.question.q1_5.options[3]",
]);

export function keysWithEnDash(locale: string): string[] {
  const bundle = JSON.parse(readFileSync(path.join(ROOT, `src/messages/${locale}.json`), "utf8"));
  return stringLeaves(bundle)
    .filter(([, text]) => text.includes(EN_DASH))
    .map(([key]) => key);
}

/**
 * Every string literal, template literal part and JSX text in `file` that
 * holds a long or en dash, as "path: text". Comments are not nodes of the
 * syntax tree, so they are never reported.
 */
export function literalsWithDash(file: string): string[] {
  const src = readFileSync(file, "utf8");
  if (!src.includes(LONG_DASH) && !src.includes(EN_DASH)) return [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    if (text !== null && (text.includes(LONG_DASH) || text.includes(EN_DASH))) found.push(`${rel}: ${text.trim()}`);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
  });
}

/**
 * Literals that may keep a dash, each with its reason. The list may only
 * shrink: a literal not listed fails, and a listed one that is gone fails too.
 */
const sourceBaseline: string[] = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/long-dash-source-baseline.json"), "utf8")
).literals;

describe("copy: no long dash in the message bundles", () => {
  for (const locale of BUNDLES) {
    const allowed = new Set(baseline[locale] ?? []);
    const found = keysWithLongDash(locale);

    it(`${locale}.json adds no new long dash`, () => {
      const added = found.filter((k) => !allowed.has(k));
      expect(added, `use a colon, a comma or parentheses instead of a long dash`).toEqual([]);
    });

    it(`${locale}.json baseline lists only strings that still carry one`, () => {
      const present = new Set(found);
      const cleaned = [...allowed].filter((k) => !present.has(k));
      expect(cleaned, `remove these keys from tests/fixtures/long-dash-baseline.json`).toEqual([]);
    });
  }

  for (const locale of BUNDLES) {
    it(`${locale}.json uses no en dash as a range or a break`, () => {
      expect(keysWithEnDash(locale).filter((k) => !EN_DASH_ALLOWED.has(k)), 'write "0 to 25", "Articles 44 to 49"').toEqual([]);
    });
  }

  it("the landing site's bundles carry no long dash in any language", () => {
    const found: string[] = [];
    for (const locale of ["en", "es"]) {
      const dir = path.join(ROOT, "src/landing/i18n", locale);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        const bundle = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
        for (const [key, text] of stringLeaves(bundle)) {
          if (text.includes(LONG_DASH)) found.push(`${locale}/${file}: ${key}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("the three strings found in the September browser round stay clean", () => {
    const fixed = [/quickstart\.applies\.skip$/, /lockedSubtitle$/, /modalDescription$/, /localSignInBody$/];
    for (const locale of BUNDLES) {
      const keys = [...keysWithLongDash(locale), ...(baseline[locale] ?? [])];
      for (const re of fixed) expect(keys.filter((k) => re.test(k)), `${locale}: ${re}`).toEqual([]);
    }
  });
});

describe("copy: no long dash in the string literals of the source", () => {
  const found = sourceFiles(path.join(ROOT, "src")).flatMap(literalsWithDash);

  it("src/**/*.ts(x) adds no string with a long or en dash", () => {
    const allowed = new Set(sourceBaseline);
    expect(
      found.filter((f) => !allowed.has(f)),
      "use a colon, a comma or parentheses; for an empty value, the common.notStated message",
    ).toEqual([]);
  });

  it("the source baseline lists only literals that still carry one", () => {
    const present = new Set(found);
    expect(sourceBaseline.filter((f) => !present.has(f)), "remove these from tests/fixtures/long-dash-source-baseline.json").toEqual([]);
  });

  it("reads literals and JSX text, never comments", () => {
    const dir = path.join(ROOT, "tests/fixtures");
    const sample = path.join(dir, "long-dash-sample.tsx.txt");
    // The parser decides what is text: the comment lines of the sample are not reported.
    const file = sample.replace(/\.txt$/, "");
    const src = readFileSync(sample, "utf8");
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(sf.statements.length).toBeGreaterThan(0);
    const texts: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isJsxText(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (node.text.includes(LONG_DASH)) texts.push(node.text.trim());
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    expect(texts).toEqual(["Shown — to the reader", "Also shown — here"]);
  });
});
