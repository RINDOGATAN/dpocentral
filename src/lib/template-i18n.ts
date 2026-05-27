"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

/**
 * Assessment templates ship with their question text, helpText, section
 * titles/descriptions, and select/multiselect options stored as English JSON
 * inside the AssessmentTemplate.sections column (and the system DPIA template
 * file under @dpocentral/premium-skills). To present them in Spanish without a
 * schema migration we keep an i18n bundle keyed by template type + element ID
 * and fall back to the raw English when a key is missing.
 *
 * Key shape:
 *   templates.<type>.section.<sectionId>.{title,description}
 *   templates.<type>.question.<questionId>.{text,helpText,options[]}
 *
 * <type> is the AssessmentTemplate.type enum value (DPIA, LIA, TIA, VENDOR,
 * CUSTOM), lowercased. Section/question IDs come from the seed JSON and are
 * already template-scoped (lia1, q1_1, etc.).
 */

type RawQuestion = {
  id: string;
  text: string;
  helpText?: string;
  options?: string[];
  [k: string]: unknown;
};

type RawSection = {
  id: string;
  title: string;
  description?: string;
  questions?: RawQuestion[];
  [k: string]: unknown;
};

export type TemplateType = string | null | undefined;

export interface TranslatedTemplate {
  sections: RawSection[];
}

function templateNamespace(type: TemplateType): string {
  if (!type) return "custom";
  return type.toLowerCase();
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
  const t = useTranslations("templates");
  const ns = templateNamespace(type);

  return useMemo(() => {
    if (!rawSections || rawSections.length === 0) return [];

    const get = (key: string, fallback: string): string => {
      try {
        return t.has(key) ? t(key) : fallback;
      } catch {
        return fallback;
      }
    };

    const getArray = (key: string, fallback: string[] | undefined): string[] | undefined => {
      if (!fallback) return undefined;
      try {
        if (!t.has(key)) return fallback;
        const raw = t.raw(key);
        if (!Array.isArray(raw)) return fallback;
        // Map each option by index; missing entries fall back.
        return fallback.map((orig, i) => {
          const tr = raw[i];
          return typeof tr === "string" ? tr : orig;
        });
      } catch {
        return fallback;
      }
    };

    return rawSections.map((section) => {
      const sectionId = section.id;
      const translatedTitle = get(
        `${ns}.section.${sectionId}.title`,
        section.title
      );
      const translatedDescription = section.description
        ? get(`${ns}.section.${sectionId}.description`, section.description)
        : section.description;

      const translatedQuestions = (section.questions ?? []).map((q) => {
        const qid = q.id;
        const text = get(`${ns}.question.${qid}.text`, q.text);
        const helpText = q.helpText
          ? get(`${ns}.question.${qid}.helpText`, q.helpText)
          : q.helpText;
        const options = getArray(`${ns}.question.${qid}.options`, q.options);
        return { ...q, text, helpText, options };
      });

      return {
        ...section,
        title: translatedTitle,
        description: translatedDescription,
        questions: translatedQuestions,
      };
    });
  }, [rawSections, ns, t]);
}
