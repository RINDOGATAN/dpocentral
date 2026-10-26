// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Records the app writes on an organisation's behalf (the TODO.LAW processor,
 * its transfer and its ready-made TIA, and later the catalogue transfer packs)
 * are stored as text in one language: the one in use when they were created.
 * The people who read them may use the other one. This module shows such text
 * in the reader's language.
 *
 * A pack lists its bilingual texts. When a stored string is exactly one of
 * them, in either language, it is shown in the reader's language; any other
 * string (a field a person has edited, or wrote) is shown as stored. So an
 * edit is detected by the text itself: nothing is marked, nothing is
 * migrated, and a record keeps its stored text.
 *
 *   - texts: whole strings, e.g. a description;
 *   - patterns: strings with values in them, written with `{name}`
 *     placeholders, e.g. "version {version}"; a value that is itself one of
 *     the pack's texts (a link per language) is swapped too;
 *   - questionOptions: for assessment answers (objects with a `questionId`
 *     and a `response`), the question's option labels per language, matched
 *     by position, so a choice saved in one language reads in the other.
 *
 * Pure: no database, no request. The runtime that decides the reader's
 * language is ./runtime.ts.
 */

export type ContentLanguage = "en" | "es";
export const CONTENT_LANGUAGES: readonly ContentLanguage[] = ["en", "es"];

export type BilingualText = Record<ContentLanguage, string>;

export interface SystemContentPack {
  /** For logs and tests only. */
  id: string;
  texts: readonly BilingualText[];
  patterns?: readonly BilingualText[];
  questionOptions?: Readonly<Record<string, readonly BilingualText[]>>;
}

export interface SystemContentLocalizer {
  /** The string in `language`, or the string itself when no pack knows it. */
  text(value: string, language: ContentLanguage): string;
  /**
   * The value with every known string in `language`: arrays and plain objects
   * are walked (Dates, Decimals and other class instances are left as they
   * are). Returns the same reference when nothing changed.
   */
  deep<T>(value: T, language: ContentLanguage): T;
}

interface CompiledPattern {
  /** Literal text before the first placeholder, for a cheap first check. */
  prefix: Record<ContentLanguage, string>;
  regex: Record<ContentLanguage, RegExp>;
  names: Record<ContentLanguage, string[]>;
  template: BilingualText;
}

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePattern(template: BilingualText): CompiledPattern {
  const prefix = {} as Record<ContentLanguage, string>;
  const regex = {} as Record<ContentLanguage, RegExp>;
  const names = {} as Record<ContentLanguage, string[]>;
  for (const lang of CONTENT_LANGUAGES) {
    const source = template[lang];
    const found: string[] = [];
    let body = "";
    let last = 0;
    for (const m of source.matchAll(PLACEHOLDER)) {
      body += escapeRegex(source.slice(last, m.index)) + "([\\s\\S]+?)";
      found.push(m[1]);
      last = (m.index ?? 0) + m[0].length;
    }
    body += escapeRegex(source.slice(last));
    regex[lang] = new RegExp(`^${body}$`);
    names[lang] = found;
    const first = source.search(PLACEHOLDER);
    prefix[lang] = first === -1 ? source : source.slice(0, first);
  }
  return { prefix, regex, names, template };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function createSystemContentLocalizer(packs: readonly SystemContentPack[]): SystemContentLocalizer {
  // Every known string, in either language, to its bilingual pair.
  const byText = new Map<string, BilingualText>();
  const patterns: CompiledPattern[] = [];
  const options = new Map<string, readonly BilingualText[]>();
  for (const pack of packs) {
    for (const pair of pack.texts) for (const lang of CONTENT_LANGUAGES) if (!byText.has(pair[lang])) byText.set(pair[lang], pair);
    for (const p of pack.patterns ?? []) patterns.push(compilePattern(p));
    for (const [questionId, list] of Object.entries(pack.questionOptions ?? {})) options.set(questionId, list);
  }

  function text(value: string, language: ContentLanguage): string {
    const pair = byText.get(value);
    if (pair) return pair[language];
    for (const p of patterns) {
      for (const lang of CONTENT_LANGUAGES) {
        if (!value.startsWith(p.prefix[lang])) continue;
        const m = p.regex[lang].exec(value);
        if (!m) continue;
        if (lang === language) return value;
        const values: Record<string, string> = {};
        p.names[lang].forEach((name, i) => {
          const captured = m[i + 1];
          values[name] = byText.get(captured)?.[language] ?? captured;
        });
        return p.template[language].replace(PLACEHOLDER, (_, name: string) => values[name] ?? `{${name}}`);
      }
    }
    return value;
  }

  function option(questionId: string, value: unknown, language: ContentLanguage): unknown {
    const list = options.get(questionId);
    if (!list) return value;
    const one = (v: unknown) => {
      if (typeof v !== "string") return v;
      const hit = list.find((o) => o.en === v || o.es === v);
      return hit ? hit[language] : v;
    };
    if (Array.isArray(value)) {
      const mapped = value.map(one);
      return mapped.some((v, i) => v !== value[i]) ? mapped : value;
    }
    return one(value);
  }

  function deep<T>(value: T, language: ContentLanguage): T {
    if (typeof value === "string") return text(value, language) as T;
    if (Array.isArray(value)) {
      let changed = false;
      const out = value.map((v) => {
        const next = deep(v, language);
        if (next !== v) changed = true;
        return next;
      });
      return (changed ? out : value) as T;
    }
    if (!isPlainObject(value)) return value;
    let out: Record<string, unknown> | null = null;
    const questionId = typeof value.questionId === "string" ? value.questionId : null;
    for (const [k, v] of Object.entries(value)) {
      let next = deep(v, language);
      if (k === "response" && questionId) next = option(questionId, next, language);
      if (next !== v) {
        out ??= { ...value };
        out[k] = next;
      }
    }
    return (out ?? value) as T;
  }

  return { text, deep };
}
