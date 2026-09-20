// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where an auto-filled answer is written, in the standard DPIA template.
 *
 * The auto-fill drafts answers from the processing activity already recorded.
 * Each draft must land on a question the template actually asks: a response
 * saved under an id no question carries is invisible in the app, counts for
 * nothing in the completeness figure, and prints nowhere in the export, while
 * the wizard reports that it wrote the answer.
 *
 * The ids below are the standard DPIA template's own
 * (src/config/dpia-template-v2.ts). tests/auto-fill-template.test.ts fails if
 * any of them stops matching a question, and if the two fixed answers stop
 * matching an option that question offers.
 */

export interface AutoFillTarget {
  sectionId: string;
  questionId: string;
}

export const AUTO_FILL_TARGETS = {
  /** What is the purpose of the processing? */
  purpose: { sectionId: "s1", questionId: "q1_2" },
  /** What categories of personal data will be processed? */
  dataCategories: { sectionId: "s1", questionId: "q1_1" },
  /** What is the legal basis for processing? */
  legalBasis: { sectionId: "s1", questionId: "q1_3" },
  /** Describe the data flows and recipients. */
  recipients: { sectionId: "s1", questionId: "q1_6" },
  /** What is the sensitivity level of the data? */
  sensitivity: { sectionId: "s2", questionId: "q2_1" },
  /** Retention period and justification. */
  retention: { sectionId: "s2", questionId: "q2_2" },
  /** Geographic scope and international transfers. */
  transfers: { sectionId: "s2", questionId: "q2_3" },
  /** What data minimization measures are in place? */
  minimisation: { sectionId: "s3", questionId: "q3_3" },
  /** Does the processing involve special category data? */
  specialCategory: { sectionId: "s5", questionId: "q5_2" },
  /** Describe the identified risks to data subjects. */
  risks: { sectionId: "s5", questionId: "q5_6" },
} as const satisfies Record<string, AutoFillTarget>;

/**
 * The legal basis recorded on a processing activity, as the exact option the
 * legal-basis question offers. An activity with no basis recorded, or one the
 * template does not offer, is left unanswered rather than guessed.
 */
export const LEGAL_BASIS_OPTIONS: Record<string, string> = {
  CONSENT: "Consent (Art. 6(1)(a))",
  CONTRACT: "Contract (Art. 6(1)(b))",
  LEGAL_OBLIGATION: "Legal obligation (Art. 6(1)(c))",
  VITAL_INTERESTS: "Vital interests (Art. 6(1)(d))",
  PUBLIC_TASK: "Public task (Art. 6(1)(e))",
  LEGITIMATE_INTERESTS: "Legitimate interests (Art. 6(1)(f))",
};

/** The sensitivity option that records special category or criminal data. */
export const SENSITIVITY_SPECIAL_CATEGORY =
  "Includes special category data (Art. 9) or criminal offence data (Art. 10)";
