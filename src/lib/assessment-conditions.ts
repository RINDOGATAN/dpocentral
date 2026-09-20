// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Conditional questions in assessment templates.
 *
 * A section or a question may carry `showIf: { questionId, anyOf }`: it is
 * shown only when the answer to `questionId` (a select or multiselect in the
 * same template) includes at least one of the `anyOf` options, or, with
 * `alsoWhenUnanswered`, while that question has no answer at all. Options are
 * named in the template's stored language (English); an answer saved in
 * another language is matched through the translated option list at the
 * same position. Templates without `showIf` behave exactly as before.
 *
 * Hidden questions are not asked, not counted in progress, not required on
 * submission and not printed in the report. Their saved answers are kept, so
 * re-selecting a jurisdiction brings them back.
 *
 * Pure functions, shared by the assessment page, the router and the report.
 */

export interface ShowIf {
  questionId: string;
  anyOf: string[];
  /**
   * Show the item as well when the controlling question has no answer yet.
   *
   * Used where a condition is added to a question that already existed: an
   * assessment started before the controlling question was introduced keeps
   * showing it, instead of losing answers it already holds. A condition that
   * gates genuinely new content leaves this off, so the new questions appear
   * only for the answer that asks for them.
   */
  alsoWhenUnanswered?: boolean;
}

export interface ConditionalQuestion {
  id: string;
  options?: string[];
  showIf?: ShowIf;
  [k: string]: unknown;
}

export interface ConditionalSection {
  id: string;
  questions?: ConditionalQuestion[];
  showIf?: ShowIf;
  [k: string]: unknown;
}

/** questionId -> saved response (string, JSON-encoded array, or raw JSON). */
export type AnswerMap = Record<string, unknown>;

/** Builds the answer map from saved responses. */
export function answerMapFrom(
  responses: ReadonlyArray<{ questionId: string; response: unknown }> | undefined | null
): AnswerMap {
  const map: AnswerMap = {};
  for (const r of responses ?? []) map[r.questionId] = r.response;
  return map;
}

/** The selected values of a saved answer (a multiselect is a JSON array). */
export function answerValues(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  const text = String(raw);
  if (text === "") return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // not JSON: a single value
    }
  }
  return [text];
}

/**
 * Maps saved values to the template's stored option names, using the
 * translated option lists (same order) for answers saved in another language.
 */
export function canonicalValues(
  values: string[],
  options: string[] | undefined,
  localizedOptions: ReadonlyArray<string[] | undefined> = []
): string[] {
  if (!options) return values;
  return values.map((v) => {
    if (options.includes(v)) return v;
    for (const list of localizedOptions) {
      const i = list?.indexOf(v) ?? -1;
      if (i >= 0 && i < options.length) return options[i];
    }
    return v;
  });
}

export function hasConditions(sections: ReadonlyArray<ConditionalSection> | null | undefined): boolean {
  return (sections ?? []).some(
    (s) => !!s?.showIf || (s?.questions ?? []).some((q) => !!q?.showIf)
  );
}

function questionIndex(
  sections: ReadonlyArray<ConditionalSection>
): Map<string, ConditionalQuestion> {
  const index = new Map<string, ConditionalQuestion>();
  for (const s of sections) for (const q of s.questions ?? []) index.set(q.id, q);
  return index;
}

/**
 * The ids hidden by `showIf`, given the stored (English) sections, the saved
 * answers, and the same sections in other languages (for option matching).
 */
export function hiddenByConditions(
  sections: ReadonlyArray<ConditionalSection>,
  answers: AnswerMap,
  localizedSections: ReadonlyArray<ReadonlyArray<ConditionalSection>> = []
): { sections: Set<string>; questions: Set<string> } {
  const hidden = { sections: new Set<string>(), questions: new Set<string>() };
  if (!hasConditions(sections)) return hidden;

  const stored = questionIndex(sections);
  const localized = localizedSections.map(questionIndex);

  const met = (cond: ShowIf): boolean => {
    const controller = stored.get(cond.questionId);
    const values = canonicalValues(
      answerValues(answers[cond.questionId]),
      controller?.options,
      localized.map((l) => l.get(cond.questionId)?.options)
    );
    if (values.length === 0) return !!cond.alsoWhenUnanswered;
    return values.some((v) => cond.anyOf.includes(v));
  };

  for (const s of sections) {
    const sectionHidden = !!s.showIf && !met(s.showIf);
    const questions = s.questions ?? [];
    let shown = 0;
    for (const q of questions) {
      if (sectionHidden || (q.showIf && !met(q.showIf))) hidden.questions.add(q.id);
      else shown++;
    }
    if (sectionHidden || (questions.length > 0 && shown === 0)) hidden.sections.add(s.id);
  }
  return hidden;
}

/** Removes hidden sections and questions (works on translated copies too). */
export function withoutHidden<S extends ConditionalSection>(
  sections: ReadonlyArray<S>,
  hidden: { sections: Set<string>; questions: Set<string> }
): S[] {
  if (hidden.sections.size === 0 && hidden.questions.size === 0) return [...sections];
  return sections
    .filter((s) => !hidden.sections.has(s.id))
    .map((s) => ({
      ...s,
      questions: (s.questions ?? []).filter((q) => !hidden.questions.has(q.id)),
    }));
}

/** Visible stored sections for the saved answers. */
export function visibleSections<S extends ConditionalSection>(
  sections: ReadonlyArray<S>,
  answers: AnswerMap,
  localizedSections: ReadonlyArray<ReadonlyArray<ConditionalSection>> = []
): S[] {
  return withoutHidden(sections, hiddenByConditions(sections, answers, localizedSections));
}

/** Completion over the visible questions only. */
export function visibleProgress(
  sections: ReadonlyArray<ConditionalSection>,
  responses: ReadonlyArray<{ questionId: string; response: unknown }>,
  localizedSections: ReadonlyArray<ReadonlyArray<ConditionalSection>> = []
): { total: number; answered: number; percentage: number; requiredMissing: string[] } {
  const visible = visibleSections(sections, answerMapFrom(responses), localizedSections);
  const answeredIds = new Set(responses.map((r) => r.questionId));
  let total = 0;
  let answered = 0;
  const requiredMissing: string[] = [];
  for (const s of visible) {
    for (const q of s.questions ?? []) {
      total++;
      if (answeredIds.has(q.id)) answered++;
      else if (q.required) requiredMissing.push(q.id);
    }
  }
  return {
    total,
    answered,
    percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    requiredMissing,
  };
}
