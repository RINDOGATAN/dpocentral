// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Turns the completeness of an assessment into the two things the exported
 * document needs: the draft mark with its list of outstanding items, and the
 * conformance table, both already in the report's language.
 *
 * The export never refuses. An unfinished assessment produces a document
 * marked a draft that says what is missing; a finished one produces neither.
 * An approved assessment is never marked a draft: it is the record of what
 * was approved. A requirement the template gained after the approval is
 * listed under the approval line, for the next revision.
 */

import { FRAMEWORK_LABELS } from "@/config/assessment-frameworks";
import type { Completeness } from "@/lib/assessment-completeness";
import type { AssessmentExportData } from "./assessment-report";
import type { PdfT } from "./privacy-program/data-mapping";

export function exportConformance({
  completeness,
  sections,
  lang,
  t,
  approvedOn = null,
}: {
  completeness: Completeness;
  /** The visible sections, in the report's language. */
  sections: ReadonlyArray<{ id: string; title: string }>;
  lang: "en" | "es";
  /** Scoped to `pdf.assessmentReport`. */
  t: PdfT;
  /** The approval date in the report's format, when the assessment is approved. */
  approvedOn?: string | null;
}): Pick<AssessmentExportData, "draft" | "conformance" | "approved"> {
  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));

  const conformance = completeness.coverage
    ? {
        rows: completeness.coverage.map((row) => ({
          id: row.element.id,
          citation: row.element.citation[lang],
          label: row.element.label[lang],
          covered: row.covered,
          ruleNotMet: row.ruleNotMet,
          step: row.sectionId ? (sectionTitle.get(row.sectionId) ?? null) : null,
        })),
        verdicts: [
          ...completeness.summary.map((f) =>
            t(f.complete ? "conformanceComplete" : "conformancePartial", {
              framework: FRAMEWORK_LABELS[f.framework][lang],
              covered: f.covered,
              total: f.total,
            })
          ),
          ...(completeness.art36 === "HIGH_RESIDUAL_NO_CONSULTATION"
            ? [t("conformanceArt36HighResidual")]
            : completeness.art36 === "CONSULTATION_UNDECIDED"
              ? [t("conformanceArt36Undecided")]
              : completeness.priorConsultationRequired
                ? [t("conformancePriorConsultation")]
                : []),
        ],
        californiaNotRequired:
          completeness.frameworks.includes("US_CCPA") &&
          completeness.californiaTrigger === "not-required",
      }
    : undefined;

  const outstandingRequirements = completeness.outstandingRequirements.map((row) => ({
    citation: row.element.citation[lang],
    label: row.element.label[lang],
  }));

  if (approvedOn) {
    return {
      draft: undefined,
      conformance,
      approved: {
        date: approvedOn,
        laterRequirements: [
          ...completeness.outstandingQuestions.map((q) => `${sectionTitle.get(q.sectionId) ?? q.sectionTitle}: ${q.text}`),
          ...outstandingRequirements.map((r) => `${r.citation} ${r.label}`),
        ],
      },
    };
  }

  const draft = completeness.complete
    ? undefined
    : {
        outstandingQuestions: completeness.outstandingQuestions.map((q) => ({
          sectionTitle: sectionTitle.get(q.sectionId) ?? q.sectionTitle,
          text: q.text,
        })),
        outstandingRequirements,
      };

  return { draft, conformance, approved: undefined };
}
