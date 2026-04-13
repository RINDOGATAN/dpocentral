import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  AssessmentPortfolioReport,
  type AssessmentPortfolioData,
  type PortfolioAssessment,
} from "@/server/services/export/assessment-portfolio-report";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json({ error: "Missing organizationId" }, { status: 400 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, user: { email: userEmail } },
  });
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // ── Fetch all assessments with relations ───────────────
  const assessments = await prisma.assessment.findMany({
    where: { organizationId },
    include: {
      template: { select: { type: true, name: true, version: true, sections: true } },
      processingActivity: { select: { name: true } },
      vendor: { select: { name: true } },
      mitigations: { select: { status: true } },
      approvals: { select: { status: true }, orderBy: { level: "desc" }, take: 1 },
      _count: { select: { responses: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // ── Transform to portfolio items ───────────────────────
  const portfolioAssessments: PortfolioAssessment[] = assessments.map((a) => {
    const sections = (a.template?.sections as any[]) || [];
    const totalQuestions = sections.reduce(
      (sum: number, sec: any) => sum + (sec.questions?.length || 0),
      0
    );
    const responseCount = a._count.responses;
    const completionPercentage = totalQuestions > 0
      ? Math.round((responseCount / totalQuestions) * 100)
      : 0;

    const mitigationCount = a.mitigations.length;
    const mitigationsCompleted = a.mitigations.filter(
      (m) => m.status === "IMPLEMENTED" || m.status === "VERIFIED"
    ).length;

    return {
      id: a.id,
      name: a.name,
      status: a.status,
      riskLevel: a.riskLevel,
      riskScore: a.riskScore,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      completedAt: a.completedAt,
      dueDate: a.dueDate,
      completionPercentage,
      templateType: a.template?.type ?? "CUSTOM",
      templateName: a.template?.name ?? "Unknown",
      linkedActivity: a.processingActivity?.name ?? null,
      linkedVendor: a.vendor?.name ?? null,
      mitigationCount,
      mitigationsCompleted,
      approvalStatus: a.approvals[0]?.status ?? null,
      responseCount,
      totalQuestions,
    };
  });

  // ── Compute stats ──────────────────────────────────────
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byRiskLevel: Record<string, number> = {};
  let totalMitigations = 0;
  let mitigationsCompleted = 0;
  let completionSum = 0;

  for (const a of portfolioAssessments) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    byType[a.templateType] = (byType[a.templateType] ?? 0) + 1;
    if (a.riskLevel) {
      byRiskLevel[a.riskLevel] = (byRiskLevel[a.riskLevel] ?? 0) + 1;
    }
    totalMitigations += a.mitigationCount;
    mitigationsCompleted += a.mitigationsCompleted;
    completionSum += a.completionPercentage;
  }

  const now = new Date();
  const overdue = portfolioAssessments.filter(
    (a) =>
      a.dueDate &&
      new Date(a.dueDate) < now &&
      !["APPROVED", "ARCHIVED"].includes(a.status)
  ).length;

  const reportData: AssessmentPortfolioData = {
    organization: { name: org.name },
    generatedAt: fmtDate(new Date()),
    assessments: portfolioAssessments,
    stats: {
      total: portfolioAssessments.length,
      byStatus,
      byType,
      byRiskLevel,
      approved: byStatus["APPROVED"] ?? 0,
      overdue,
      avgCompletion: portfolioAssessments.length > 0
        ? Math.round(completionSum / portfolioAssessments.length)
        : 0,
      totalMitigations,
      mitigationsCompleted,
    },
  };

  // ── Render PDF ─────────────────────────────────────────
  const buffer = await renderToBuffer(
    AssessmentPortfolioReport({ data: reportData })
  );

  const dateStr = fmtDate(new Date());
  const filename = `Assessment-Portfolio-${org.name.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf`;

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
      entityType: "Report",
      entityId: "assessment-portfolio",
      action: "EXPORT_PDF",
      changes: {
        format: "pdf",
        reportType: "assessment-portfolio",
        assessmentCount: portfolioAssessments.length,
      },
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    return pdfErrorResponse(err, "assessment-portfolio");
  }
}
