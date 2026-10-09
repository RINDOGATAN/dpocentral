// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One assessment's report PDF. An unfinished assessment still exports: the
 * document is marked a draft and lists what is outstanding on its first page
 * (its own cover, so it needs no separate gaps page). See ./context.ts.
 */

import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { AssessmentReport } from "@/server/services/export/assessment-report";
import type { AssessmentExportData } from "@/server/services/export/assessment-report";
import { fmtDate } from "@/server/services/export/pdf-styles";
import type { Locale } from "@/i18n/config";
import type { PdfT } from "@/server/services/export/privacy-program/data-mapping";
import {
  answerMapFrom,
  hasConditions,
  hiddenByConditions,
  withoutHidden,
} from "@/lib/assessment-conditions";
import { computeHealthAdtechResult, isHealthAdtechTemplate } from "@/lib/health-adtech/results";
import { assessmentProgress } from "@/server/services/assessment/progress";
import { assessmentCompleteness } from "@/lib/assessment-completeness";
import { exportConformance } from "@/server/services/export/assessment-conformance";
import {
  allLocalizedSections,
  answerFormatter,
  sectionsForLocale,
  templateMetaForLocale,
} from "@/server/services/assessment/template-locales";
import { PDF, type ExportFile } from "./context";

/** What the report reads of an assessment. */
export const ASSESSMENT_EXPORT_INCLUDE = {
  organization: true,
  template: true,
  processingActivity: { select: { name: true } },
  vendor: { select: { name: true } },
  responses: {
    include: {
      responder: { select: { id: true, name: true, email: true } },
    },
    orderBy: { respondedAt: "desc" },
  },
  mitigations: { orderBy: { priority: "asc" } },
  approvals: {
    include: {
      approver: { select: { id: true, name: true, email: true } },
    },
    orderBy: { level: "asc" },
  },
  versions: { orderBy: { version: "desc" }, take: 5 },
} satisfies Prisma.AssessmentInclude;

export type AssessmentForExport = Prisma.AssessmentGetPayload<{ include: typeof ASSESSMENT_EXPORT_INCLUDE }> & {
  template: NonNullable<Prisma.AssessmentGetPayload<{ include: typeof ASSESSMENT_EXPORT_INCLUDE }>["template"]>;
};

/** The assessment's file name, the same in the single download and the pack. */
export function assessmentFileName(assessment: { name: string; template: { type: string } }): string {
  return `Assessment-${assessment.template.type}-${assessment.name.replace(/[^a-zA-Z0-9]/g, "-")}-${fmtDate(new Date())}.pdf`;
}

export async function buildAssessmentExport(
  assessment: AssessmentForExport,
  locale: Locale,
): Promise<ExportFile & { draft: boolean }> {
  // Build export data: template text in the report's language, and only the
  // questions the answers make visible (templates with `showIf`).
  const templateType = assessment.template.type;
  const storedSections = (assessment.template.sections as any[]) || [];
  const localizedSections = sectionsForLocale(templateType, storedSections, locale);
  const conditional = hasConditions(storedSections);
  const hidden = conditional
    ? hiddenByConditions(
        storedSections,
        answerMapFrom(assessment.responses),
        allLocalizedSections(templateType, storedSections)
      )
    : null;
  const sections = hidden ? withoutHidden(localizedSections, hidden) : localizedSections;
  const exportedResponses = hidden
    ? assessment.responses.filter((r) => !hidden.questions.has(r.questionId))
    : assessment.responses;
  const { totalQuestions, completionPercentage } = assessmentProgress(
    assessment.template,
    assessment.responses
  );
  const templateName = templateMetaForLocale(assessment.template, locale).name;
  const t = await getTranslations({ locale: locale, namespace: "pdf.assessmentReport" });

  const displayAnswer = answerFormatter(templateType, storedSections, locale, {
    yes: t("yes"),
    no: t("no"),
  });

  // What is still outstanding, in the report's language. The same module
  // feeds the completeness panel in the app, so the two never disagree.
  const completeness = assessmentCompleteness({
    templateId: assessment.template.id,
    visibleSections: sections,
    responses: assessment.responses,
  });
  const { draft, conformance } = exportConformance({
    completeness,
    sections: sections as Array<{ id: string; title: string }>,
    lang: locale === "es" ? "es" : "en",
    t: t as unknown as PdfT,
  });

  const data: AssessmentExportData = {
    id: assessment.id,
    name: assessment.name,
    description: assessment.description,
    status: assessment.status,
    riskLevel: assessment.riskLevel,
    riskScore: assessment.riskScore,
    startedAt: assessment.startedAt,
    submittedAt: assessment.submittedAt,
    completedAt: assessment.completedAt,
    dueDate: assessment.dueDate,
    template: {
      type: assessment.template.type,
      name: templateName,
      version: assessment.template.version,
      sections,
    },
    processingActivity: assessment.processingActivity,
    vendor: assessment.vendor,
    responses: exportedResponses.map((r) => ({
      sectionId: r.sectionId,
      questionId: r.questionId,
      response: displayAnswer(r.questionId, r.response),
      riskScore: r.riskScore,
      notes: r.notes,
      responder: r.responder,
      respondedAt: r.respondedAt,
    })),
    mitigations: assessment.mitigations.map((m) => ({
      title: m.title,
      description: m.description,
      status: m.status,
      owner: m.owner,
      priority: m.priority,
      dueDate: m.dueDate,
      completedAt: m.completedAt,
      evidence: m.evidence,
    })),
    approvals: assessment.approvals.map((a) => ({
      level: a.level,
      status: a.status,
      comments: a.comments,
      decidedAt: a.decidedAt,
      approver: a.approver,
    })),
    organization: { name: assessment.organization.name },
    completionPercentage,
    totalQuestions,
    draft,
    conformance,
  };

  const healthAdtech = isHealthAdtechTemplate(assessment.template)
    ? {
        result: computeHealthAdtechResult(assessment.responses),
        t: (await getTranslations({
          locale: locale,
          namespace: "healthAdtechReport",
        })) as unknown as PdfT,
      }
    : undefined;

  const buffer = await renderToBuffer(
    AssessmentReport({ data, t, locale: locale, healthAdtech })
  );
  return {
    data: new Uint8Array(buffer),
    filename: assessmentFileName(assessment),
    contentType: PDF,
    draft: !!draft,
  };
}
