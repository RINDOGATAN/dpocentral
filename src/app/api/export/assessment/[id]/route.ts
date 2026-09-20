// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { getCookieLocale } from "@/i18n/server-locale";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { AssessmentReport } from "@/server/services/export/assessment-report";
import type { AssessmentExportData } from "@/server/services/export/assessment-report";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = await getToken({ req: request as unknown as NextRequest });
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {

  // Fetch assessment with all relations
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
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
    },
  });

  if (!assessment) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  if (!assessment.template) {
    return Response.json({ error: "Assessment template is missing" }, { status: 500 });
  }

  // Verify org membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: assessment.organizationId,
      user: { email: userEmail },
    },
  });
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Export is allowed for any assessment the user can access, finished or
  // not. The premium gate is on *creating* assessments (template access),
  // never on exporting one. An unfinished assessment still exports: the
  // document is marked a draft and lists what is outstanding on its first
  // page. Refusing the export is what made it useless.

  const url = new URL(request.url);
  const requestedLocale = url.searchParams.get("locale");
  const cookieLocale = await getCookieLocale();
  const resolvedLocale = ([requestedLocale, cookieLocale, defaultLocale].find(
    (l): l is string => !!l && (locales as readonly string[]).includes(l)
  ) ?? defaultLocale) as Locale;

  // Build export data: template text in the report's language, and only the
  // questions the answers make visible (templates with `showIf`).
  const templateType = assessment.template.type;
  const storedSections = (assessment.template.sections as any[]) || [];
  const localizedSections = sectionsForLocale(templateType, storedSections, resolvedLocale);
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
  const templateName = templateMetaForLocale(assessment.template, resolvedLocale).name;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "pdf.assessmentReport" });

  const displayAnswer = answerFormatter(templateType, storedSections, resolvedLocale, {
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
    lang: resolvedLocale === "es" ? "es" : "en",
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
          locale: resolvedLocale,
          namespace: "healthAdtechReport",
        })) as unknown as PdfT,
      }
    : undefined;

  const buffer = await renderToBuffer(
    AssessmentReport({ data, t, locale: resolvedLocale, healthAdtech })
  );
  const dateStr = fmtDate(new Date());
  const filename = `Assessment-${assessment.template.type}-${assessment.name.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf`;

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId: assessment.organizationId,
      userId: membership.userId,
      entityType: "Assessment",
      entityId: assessment.id,
      action: "EXPORT_PDF",
      changes: { format: "pdf", assessmentType: assessment.template.type },
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    return pdfErrorResponse(err, "assessment");
  }
}
