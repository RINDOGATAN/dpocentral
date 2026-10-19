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
import { inherentAndResidual, withDerivedRisk } from "@/server/services/assessment/risk-score";
import { registerRows, registerSummary } from "@/lib/assessment-risk-register";
import { FRAMEWORK_CITATIONS } from "@/config/assessment-frameworks";
import { PDF, fileTitle, nameForFile, type ExportFile } from "./context";
import { assessmentNameWithoutType, assessmentTypeShort } from "@/lib/assessment-file-name";
import { withPdfLocale } from "@/server/services/export/pdf-locale";

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
  risks: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.AssessmentInclude;

export type AssessmentForExport = Prisma.AssessmentGetPayload<{ include: typeof ASSESSMENT_EXPORT_INCLUDE }> & {
  template: NonNullable<Prisma.AssessmentGetPayload<{ include: typeof ASSESSMENT_EXPORT_INCLUDE }>["template"]>;
};

/** The assessment's file name, the same in the single download and the pack. */
export function assessmentFileName(
  assessment: { name: string; template: { type: string } },
  locale?: string,
): string {
  return `${fileTitle("Assessment", locale)}-${assessmentTypeShort(assessment.template.type, locale)}-${nameForFile(assessmentNameWithoutType(assessment.name))}-${fmtDate(new Date())}.pdf`;
}

/** A date in the report's language: dd/mm/yyyy in Spanish, yyyy-mm-dd in English. */
export function reportDate(d: Date | string | null | undefined, locale?: string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const iso = date.toISOString().slice(0, 10);
  if (locale !== "es") return iso;
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
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
  const register = registerRows(assessment.risks ?? [], assessment.mitigations);
  const summary = registerSummary(register);
  const completeness = assessmentCompleteness({
    templateId: assessment.template.id,
    visibleSections: sections,
    responses: assessment.responses,
    registerRisks: register.length,
    registerResidual: summary.residual,
  });
  const lang = locale === "es" ? "es" : "en";
  const approvedAt = assessment.status === "APPROVED" ? (assessment.completedAt ?? assessment.updatedAt) : null;
  const { draft, conformance, approved } = exportConformance({
    completeness,
    sections: sections as Array<{ id: string; title: string }>,
    lang,
    t: t as unknown as PdfT,
    approvedOn: approvedAt ? reportDate(approvedAt, lang) : null,
  });

  // Risk figures derived from the answers, as the app shows them; once
  // approved, the figures stored at approval.
  const risk = withDerivedRisk(assessment, assessment.template, assessment.responses);
  const split = assessment.riskFrozenAt
    ? {
        inherentScore: assessment.inherentRiskScore,
        inherentLevel: assessment.inherentRiskLevel,
        residualLevel: assessment.residualRiskLevel,
      }
    : inherentAndResidual(assessment.template, assessment.responses, summary);

  // Sign-off: what the answers record about the DPO's advice, the prior
  // consultation and the review, in the report's language.
  const answerText = (questionId: string): string | null => {
    if (hidden?.questions.has(questionId)) return null;
    const r = assessment.responses.find((x) => x.questionId === questionId);
    return r ? displayAnswer(questionId, r.response) : null;
  };
  const preparedBy = [
    ...new Set(
      assessment.responses
        .map((r) => r.responder?.name || r.responder?.email)
        .filter((n): n is string => !!n)
    ),
  ];
  const decided = assessment.approvals.filter((a) => a.decidedAt);
  const lastDecision = decided[decided.length - 1];
  const measureTitles = new Map<string, string[]>();
  for (const m of assessment.mitigations) {
    measureTitles.set(m.riskId, [...(measureTitles.get(m.riskId) ?? []), m.title]);
  }

  const data: AssessmentExportData = {
    id: assessment.id,
    name: assessment.name,
    description: assessment.description,
    status: assessment.status,
    riskLevel: risk.riskLevel,
    riskScore: risk.riskScore,
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
    approved,
    conformance,
    inherentRiskLevel: split.inherentLevel,
    inherentRiskScore: split.inherentScore,
    residualRiskLevel: split.residualLevel,
    register:
      templateType === "DPIA" || register.length > 0
        ? {
            rows: register.map((row) => ({
              title: row.risk.title,
              description: row.risk.description,
              rightsAffected: row.risk.rightsAffected,
              likelihood: row.risk.likelihood,
              severity: row.risk.severity,
              inherent: row.inherent,
              residualLikelihood: row.risk.residualLikelihood,
              residualSeverity: row.risk.residualSeverity,
              residual: row.residual,
              status: row.risk.status,
              measures: measureTitles.get(row.risk.id) ?? [],
            })),
            unsupported: register
              .filter((row) => summary.unsupportedReductions.includes(row.risk.id))
              .map((row) => row.risk.title),
          }
        : undefined,
    signOff:
      templateType === "DPIA"
        ? {
            // The template version the approval was given on, where it was kept.
            templateVersion:
              ((assessment.versions.find((v) => v.version === assessment.approvedVersion)?.snapshot as
                | { templateVersion?: string }
                | null)?.templateVersion) ?? assessment.template.version,
            approvedVersion: assessment.approvedVersion,
            preparedBy,
            dpoAdvice: answerText("q7_3"),
            consultation: answerText("q7_2"),
            consultationRecord: answerText("q7_5"),
            review: answerText("q7_4"),
            decision: assessment.status,
            decidedAt: lastDecision?.decidedAt ?? null,
          }
        : undefined,
    citation:
      templateType === "DPIA" && completeness.frameworks.length > 0
        ? completeness.frameworks.map((f) => FRAMEWORK_CITATIONS[f][lang]).join("; ")
        : null,
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

  const buffer = await withPdfLocale(locale, () => renderToBuffer(
    AssessmentReport({ data, t, locale: locale, healthAdtech }))
  );
  return {
    data: new Uint8Array(buffer),
    filename: assessmentFileName(assessment, locale),
    contentType: PDF,
    draft: !!draft,
  };
}
