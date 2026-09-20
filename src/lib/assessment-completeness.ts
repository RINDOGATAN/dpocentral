// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What is still outstanding on an assessment, in one place.
 *
 * The assessment page uses it for the completeness panel and the export uses
 * it for the draft mark and the conformance table, so the two can never
 * disagree about whether the work is finished.
 *
 * Pure functions. The caller passes the sections the answers make visible,
 * already in the language it wants to show, so the outstanding items read in
 * that language.
 */

import {
  californiaTriggerState,
  conformanceElementsFor,
  coverageSummary,
  frameworkCoverage,
  selectedFrameworks,
  type CaliforniaTriggerState,
  type CoverageRow,
  type FrameworkId,
  type FrameworkSummary,
} from "@/config/assessment-frameworks";
import { answerMapFrom } from "@/lib/assessment-conditions";

export interface CompletenessQuestion {
  id: string;
  text: string;
  required?: boolean;
}

export interface CompletenessSection {
  id: string;
  title: string;
  questions?: ReadonlyArray<CompletenessQuestion>;
}

export interface OutstandingItem {
  questionId: string;
  sectionId: string;
  sectionTitle: string;
  /** The question, in the language the caller passed in. */
  text: string;
}

export interface Completeness {
  /** Required questions the assessment shows and nobody has answered. */
  outstandingQuestions: OutstandingItem[];
  /** One row per requirement, or null where the template has no table. */
  coverage: CoverageRow[] | null;
  summary: FrameworkSummary[];
  frameworks: FrameworkId[];
  /** Requirements of a chosen framework that nothing answers yet. */
  outstandingRequirements: CoverageRow[];
  californiaTrigger: CaliforniaTriggerState;
  /** Nothing outstanding: no missing required answer, no missing requirement. */
  complete: boolean;
}

export interface CompletenessInput {
  templateId: string | null | undefined;
  /** Sections the answers make visible, in the language to show. */
  visibleSections: ReadonlyArray<CompletenessSection>;
  responses: ReadonlyArray<{ questionId: string; response: unknown }>;
}

export function assessmentCompleteness(input: CompletenessInput): Completeness {
  const answers = answerMapFrom(input.responses);
  const answeredQuestionIds = new Set(input.responses.map((r) => r.questionId));

  const outstandingQuestions: OutstandingItem[] = [];
  for (const section of input.visibleSections) {
    for (const question of section.questions ?? []) {
      if (!question.required || answeredQuestionIds.has(question.id)) continue;
      outstandingQuestions.push({
        questionId: question.id,
        sectionId: section.id,
        sectionTitle: section.title,
        text: question.text,
      });
    }
  }

  const elements = conformanceElementsFor(input.templateId);
  const frameworks = elements ? selectedFrameworks(answers) : [];
  const coverage = elements
    ? frameworkCoverage({
        elements,
        frameworks,
        visibleSections: input.visibleSections,
        answeredQuestionIds,
      })
    : null;
  const outstandingRequirements = (coverage ?? []).filter((row) => !row.covered);

  return {
    outstandingQuestions,
    coverage,
    summary: coverage ? coverageSummary(coverage) : [],
    frameworks,
    outstandingRequirements,
    californiaTrigger: californiaTriggerState(answers),
    complete: outstandingQuestions.length === 0 && outstandingRequirements.length === 0,
  };
}
