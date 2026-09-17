// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Translation of assessment template text, shared by the page hook
 * (src/lib/template-i18n.ts) and the server (report export, conditions).
 *
 * Key shape, under the `templates` namespace of a message bundle:
 *   <type>.template.<templateId>.{name,description}
 *   <type>.section.<sectionId>.{title,description}
 *   <type>.question.<questionId>.{text,helpText,options[]}
 * A missing key falls back to the stored (English) text; options are matched
 * by position.
 */

export type TemplateLookup = (key: string) => unknown;

type RawQuestion = {
  id: string;
  text: string;
  helpText?: string;
  options?: string[];
  [k: string]: unknown;
};

export type RawSection = {
  id: string;
  title: string;
  description?: string;
  questions?: RawQuestion[];
  [k: string]: unknown;
};

export function templateNamespace(type: string | null | undefined): string {
  if (!type) return "custom";
  return type.toLowerCase();
}

function str(lookup: TemplateLookup, key: string, fallback: string): string {
  const v = lookup(key);
  return typeof v === "string" ? v : fallback;
}

function arr(lookup: TemplateLookup, key: string, fallback: string[] | undefined) {
  if (!fallback) return undefined;
  const v = lookup(key);
  if (!Array.isArray(v)) return fallback;
  return fallback.map((orig, i) => (typeof v[i] === "string" ? (v[i] as string) : orig));
}

export function translateSections<S extends RawSection>(
  type: string | null | undefined,
  sections: ReadonlyArray<S>,
  lookup: TemplateLookup
): S[] {
  const ns = templateNamespace(type);
  return sections.map((section) => ({
    ...section,
    title: str(lookup, `${ns}.section.${section.id}.title`, section.title),
    description: section.description
      ? str(lookup, `${ns}.section.${section.id}.description`, section.description)
      : section.description,
    questions: (section.questions ?? []).map((q) => ({
      ...q,
      text: str(lookup, `${ns}.question.${q.id}.text`, q.text),
      helpText: q.helpText ? str(lookup, `${ns}.question.${q.id}.helpText`, q.helpText) : q.helpText,
      options: arr(lookup, `${ns}.question.${q.id}.options`, q.options),
    })),
  }));
}

export function translateTemplateMeta(
  template: { id: string; type: string; name: string; description?: string | null },
  lookup: TemplateLookup
): { name: string; description: string | null | undefined } {
  const base = `${templateNamespace(template.type)}.template.${template.id}`;
  return {
    name: str(lookup, `${base}.name`, template.name),
    description: template.description
      ? str(lookup, `${base}.description`, template.description)
      : template.description,
  };
}

/** A lookup over a plain message object (the `templates` subtree). */
export function objectLookup(tree: unknown): TemplateLookup {
  return (key) => {
    let node: unknown = tree;
    for (const part of key.split(".")) {
      if (node == null || typeof node !== "object") return undefined;
      node = (node as Record<string, unknown>)[part];
    }
    return node;
  };
}
