// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Turns the completeness of an assessment into the two things the exported
 * document needs: the draft mark with its list of outstanding items, and the
 * conformance table, both already in the report's language.
 *
 * The export never refuses. An unfinished assessment produces a document
 * marked a draft that says what is missing; a finished one produces neither.
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
}: {
  completeness: Completeness;
  /** The visible sections, in the report's language. */
  sections: ReadonlyArray<{ id: string; title: string }>;
  lang: "en" | "es";
  /** Scoped to `pdf.assessmentReport`. */
  t: PdfT;
}): Pick<AssessmentExportData, "draft" | "conformance"> {
  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));

  const conformance = completeness.coverage
    ? {
        rows: completeness.coverage.map((row) => ({
          id: row.element.id,
          citation: row.element.citation[lang],
          label: row.element.label[lang],
          covered: row.covered,
          step: row.sectionId ? (sectionTitle.get(row.sectionId) ?? null) : null,
        })),
        verdicts: completeness.summary.map((f) =>
          t(f.complete ? "conformanceComplete" : "conformancePartial", {
            framework: FRAMEWORK_LABELS[f.framework][lang],
            covered: f.covered,
            total: f.total,
          })
        ),
        californiaNotRequired:
          completeness.frameworks.includes("US_CCPA") &&
          completeness.californiaTrigger === "not-required",
      }
    : undefined;

  const draft = completeness.complete
    ? undefined
    : {
        outstandingQuestions: completeness.outstandingQuestions.map((q) => ({
          sectionTitle: sectionTitle.get(q.sectionId) ?? q.sectionTitle,
          text: q.text,
        })),
        outstandingRequirements: completeness.outstandingRequirements.map((row) => ({
          citation: row.element.citation[lang],
          label: row.element.label[lang],
        })),
      };

  return { draft, conformance };
}
