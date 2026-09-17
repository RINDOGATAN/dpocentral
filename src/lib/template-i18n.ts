"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import {
  translateSections,
  translateTemplateMeta,
  type RawSection,
  type TemplateLookup,
} from "@/lib/template-i18n-core";

/**
 * Assessment templates ship with their question text, helpText, section
 * titles/descriptions, and select/multiselect options stored as English JSON
 * inside the AssessmentTemplate.sections column (and the system DPIA template
 * file under @dpocentral/premium-skills). To present them in Spanish without a
 * schema migration we keep an i18n bundle keyed by template type + element ID
 * and fall back to the raw English when a key is missing.
 *
 * Key shape:
 *   templates.<type>.template.<templateId>.{name,description}
 *   templates.<type>.section.<sectionId>.{title,description}
 *   templates.<type>.question.<questionId>.{text,helpText,options[]}
 *
 * <type> is the AssessmentTemplate.type enum value (DPIA, LIA, TIA, VENDOR,
 * CUSTOM), lowercased. Section/question IDs come from the seed JSON and are
 * already template-scoped (lia1, q1_1, etc.). The translation itself lives in
 * template-i18n-core.ts, shared with the server.
 */

export type TemplateType = string | null | undefined;

export interface TranslatedTemplate {
  sections: RawSection[];
}

function useTemplateLookup(): TemplateLookup {
  const t = useTranslations("templates");
  return useCallback(
    (key: string) => {
      try {
        if (!t.has(key)) return undefined;
        const raw = t.raw(key);
        return Array.isArray(raw) ? raw : t(key);
      } catch {
        return undefined;
      }
    },
    [t]
  );
}

/**
 * Returns a deep copy of the template's sections with text/helpText/options
 * swapped to the active locale where a translation exists. Untranslated keys
 * fall back to the original English text from the template JSON.
 */
export function useTranslatedSections(
  type: TemplateType,
  rawSections: RawSection[] | undefined | null
): RawSection[] {
  const lookup = useTemplateLookup();
  return useMemo(() => {
    if (!rawSections || rawSections.length === 0) return [];
    return translateSections(type, rawSections, lookup);
  }, [rawSections, type, lookup]);
}

/** Translates a template's name and description where a translation exists. */
export function useTemplateMeta() {
  const lookup = useTemplateLookup();
  return useCallback(
    (template: { id: string; type: string; name: string; description?: string | null }) =>
      translateTemplateMeta(template, lookup),
    [lookup]
  );
}
