// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The scrub applied to every piece of text copied from one client to another.
 *
 * 1. The source client's full name is replaced with the new client's name
 *    (any letter case, whole words only).
 * 2. Anything else that points at the source is FLAGGED, not changed: its
 *    e-mail or web domain, the domain's first label, and the distinctive words
 *    of its name ("Acme" in "Acme Holdings Ltd"). A flag is shown to the person
 *    before the copy runs and listed again after it, so nothing identifying is
 *    carried across silently. It is not rewritten because a word such as a
 *    product name can match by coincidence, and only a person can tell.
 *
 * Pure leaf module: no Prisma, no React. Ported from AI Sentinel.
 */

export interface ScrubSource {
  name: string;
  domain?: string | null;
}

export interface ScrubFlag {
  /** What matched, as found in the text. */
  term: string;
  kind: "name" | "domain";
  /** The words around the match, for the review list. */
  snippet: string;
}

export interface ScrubResult {
  text: string;
  replaced: number;
  flags: ScrubFlag[];
}

/** Words that say what kind of company it is, not which one. */
const GENERIC_WORDS = new Set([
  "inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited", "llc", "llp",
  "plc", "gmbh", "ag", "sa", "sl", "sas", "sarl", "srl", "spa", "bv", "nv", "oy", "ab", "as",
  "group", "grupo", "holding", "holdings", "international", "global", "the", "and", "und", "y",
  "de", "del", "la", "el", "los", "las", "of", "for", "partners", "services", "servicios",
  "solutions", "soluciones", "technologies", "technology", "tech", "systems", "ai", "labs",
  "consulting", "bank", "banco",
]);

/** Public mail providers: a match on these says nothing about the client. */
const PUBLIC_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "yandex.com",
]);

const MIN_WORD = 3;
const SNIPPET_RADIUS = 30;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A case-insensitive whole-word pattern: no letter or digit on either side. */
function wholeWord(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "giu");
}

function words(name: string): string[] {
  return name
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.trim())
    .filter(Boolean);
}

function normaliseDomain(domain: string | null | undefined): string | null {
  const d = (domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return d && d.includes(".") && !PUBLIC_MAIL.has(d) ? d : null;
}

/** The terms that are flagged in copied text, longest first. */
export function flagTerms(source: ScrubSource): { term: string; kind: ScrubFlag["kind"] }[] {
  const terms = new Map<string, ScrubFlag["kind"]>();
  for (const word of words(source.name)) {
    const lower = word.toLowerCase();
    if (lower.length < MIN_WORD || GENERIC_WORDS.has(lower) || /^\d+$/.test(lower)) continue;
    terms.set(lower, "name");
  }
  const domain = normaliseDomain(source.domain);
  if (domain) {
    terms.set(domain, "domain");
    const label = domain.split(".")[0];
    if (label.length >= MIN_WORD && !GENERIC_WORDS.has(label) && !terms.has(label)) {
      terms.set(label, "domain");
    }
  }
  return [...terms.entries()]
    .map(([term, kind]) => ({ term, kind }))
    .sort((a, b) => b.term.length - a.term.length);
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

export function makeScrubber(source: ScrubSource, targetName: string) {
  const sourceName = source.name.trim();
  const target = targetName.trim();
  const namePattern = sourceName ? wholeWord(sourceName) : null;
  const terms = flagTerms(source).filter(
    // A word the new client's own name also carries is not a pointer to the source.
    (t) => !wholeWord(t.term).test(target),
  );

  function scrub(text: string): ScrubResult {
    if (!text) return { text, replaced: 0, flags: [] };
    let replaced = 0;
    let out = text;
    if (namePattern && target) {
      out = out.replace(namePattern, () => {
        replaced += 1;
        return target;
      });
    }
    const flags: ScrubFlag[] = [];
    const covered: [number, number][] = [];
    for (const { term, kind } of terms) {
      for (const match of out.matchAll(wholeWord(term))) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        // "acme.com" already flagged: do not flag its "acme" again.
        if (covered.some(([s, e]) => start >= s && end <= e)) continue;
        covered.push([start, end]);
        flags.push({ term: match[0], kind, snippet: snippetAround(out, start, match[0].length) });
      }
    }
    return { text: out, replaced, flags };
  }

  /** The same scrub over every string inside a JSON value (template sections, answers). */
  function scrubJson<T>(value: T): { value: T; replaced: number; flags: ScrubFlag[] } {
    let replaced = 0;
    const flags: ScrubFlag[] = [];
    const walk = (v: unknown): unknown => {
      if (typeof v === "string") {
        const r = scrub(v);
        replaced += r.replaced;
        flags.push(...r.flags);
        return r.text;
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
      }
      return v;
    };
    return { value: walk(value) as T, replaced, flags };
  }

  return { scrub, scrubJson };
}

export type Scrubber = ReturnType<typeof makeScrubber>;
