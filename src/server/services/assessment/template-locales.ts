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
import {
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

export function templateMetaForLocale(
  template: { id: string; type: string; name: string; description?: string | null },
  locale: Locale
) {
  return translateTemplateMeta(template, objectLookup(TEMPLATE_BUNDLES[locale]));
}
