// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Assessment progress and required-answer checks that honour a template's
 * `showIf` conditions (src/lib/assessment-conditions.ts). Templates without
 * conditions keep their original behaviour.
 */

import { hasConditions, visibleProgress, type ConditionalSection } from "@/lib/assessment-conditions";
import { allLocalizedSections } from "./template-locales";

type ProgressTemplate = { type: string; sections: unknown };
type ProgressResponse = { questionId: string; response: unknown };
type Section = ConditionalSection & {
  title: string;
  questions?: Array<{ id: string; text: string; required?: boolean; options?: string[] }>;
};

function sectionsOf(template: ProgressTemplate): Section[] {
  return Array.isArray(template.sections) ? (template.sections as Section[]) : [];
}

/** Required questions still unanswered (hidden questions are not required). */
export function unansweredRequired(
  template: ProgressTemplate,
  responses: ProgressResponse[]
): string[] {
  const sections = sectionsOf(template);
  if (hasConditions(sections)) {
    return visibleProgress(sections, responses, allLocalizedSections(template.type, sections))
      .requiredMissing;
  }
  const answeredIds = new Set(responses.map((r) => r.questionId));
  return sections
    .flatMap((s) => (s.questions ?? []).filter((q) => q.required).map((q) => q.id))
    .filter((id) => !answeredIds.has(id));
}

/**
 * Names the unanswered required questions, so a refusal says what is missing
 * instead of only how much. Long lists are cut short with a count.
 */
export function describeUnanswered(
  template: ProgressTemplate,
  unanswered: string[],
  limit = 3
): string {
  const text = new Map<string, string>();
  for (const s of sectionsOf(template)) {
    for (const q of s.questions ?? []) text.set(q.id, q.text);
  }
  const named = unanswered.map((id) => text.get(id.split("::")[0]) ?? id);
  const shown = named.slice(0, limit).join("; ");
  const rest = named.length - Math.min(limit, named.length);
  return rest > 0 ? `${shown}; and ${rest} more` : shown;
}

/**
 * Completion. Templates with conditions count their visible questions only;
 * others keep the original count (every saved response over every question).
 */
export function assessmentProgress(
  template: ProgressTemplate,
  responses: ProgressResponse[]
): { totalQuestions: number; answeredQuestions: number; completionPercentage: number } {
  const sections = sectionsOf(template);
  if (hasConditions(sections)) {
    const p = visibleProgress(sections, responses, allLocalizedSections(template.type, sections));
    return { totalQuestions: p.total, answeredQuestions: p.answered, completionPercentage: p.percentage };
  }
  const totalQuestions = sections.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);
  return {
    totalQuestions,
    answeredQuestions: responses.length,
    completionPercentage:
      totalQuestions > 0 ? Math.round((responses.length / totalQuestions) * 100) : 0,
  };
}
