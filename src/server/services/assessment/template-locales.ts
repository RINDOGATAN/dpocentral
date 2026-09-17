// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Server-side template translations, read from the message bundles.
 *
 * Used where no request locale drives the text (visibility of conditional
 * questions must match an answer saved in any language) and by the report
 * export, which renders in the requested locale.
 */

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { locales, type Locale } from "@/i18n/config";
import { answerValues } from "@/lib/assessment-conditions";
import {
  localizeValues,
  objectLookup,
  translateSections,
  translateTemplateMeta,
  type RawSection,
} from "@/lib/template-i18n-core";

const TEMPLATE_BUNDLES: Record<Locale, unknown> = {
  en: (en as { templates?: unknown }).templates,
  es: (es as { templates?: unknown }).templates,
};

export function sectionsForLocale<S extends RawSection>(
  type: string,
  sections: ReadonlyArray<S>,
  locale: Locale
): S[] {
  return translateSections(type, sections, objectLookup(TEMPLATE_BUNDLES[locale]));
}

/** The template's sections in every supported language (for answer matching). */
export function allLocalizedSections<S extends RawSection>(
  type: string,
  sections: ReadonlyArray<S>
): S[][] {
  return locales.map((locale) => sectionsForLocale(type, sections, locale));
}

type OptionQuestion = { id: string; type?: unknown; options?: string[] };

/**
 * Formats saved answers in the given language: options matched by position
 * across languages, lists joined with "; ", Yes/No translated. Free text is
 * printed as saved.
 */
export function answerFormatter(
  type: string,
  storedSections: ReadonlyArray<RawSection>,
  locale: Locale,
  labels: { yes: string; no: string }
): (questionId: string, raw: unknown) => string {
  const index = (sections: ReadonlyArray<RawSection>) => {
    const map = new Map<string, OptionQuestion>();
    for (const s of sections) for (const q of s.questions ?? []) map.set(q.id, q);
    return map;
  };
  const stored = index(storedSections);
  const shown = index(sectionsForLocale(type, storedSections, locale));
  const others = allLocalizedSections(type, storedSections).map(index);

  return (questionId, raw) => {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const baseId = questionId.split("::")[0];
    const q = stored.get(baseId);
    if (q?.type === "boolean") {
      return text === "Yes" ? labels.yes : text === "No" ? labels.no : text;
    }
    if (!q?.options) return text;
    return localizeValues(
      answerValues(raw),
      q.options,
      shown.get(baseId)?.options,
      others.map((m) => m.get(baseId)?.options)
    ).join("; ");
  };
}

export function templateMetaForLocale(
  template: { id: string; type: string; name: string; description?: string | null },
  locale: Locale
) {
  return translateTemplateMeta(template, objectLookup(TEMPLATE_BUNDLES[locale]));
}
