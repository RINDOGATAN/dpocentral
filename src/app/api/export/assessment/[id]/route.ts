import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { AssessmentReport } from "@/server/services/export/assessment-report";
import type { AssessmentExportData } from "@/server/services/export/assessment-report";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";

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

  // Note: export is allowed for any assessment the user can access.
  // The premium gate is on *creating* assessments (template access),
  // not on exporting completed ones.

  // Build export data
  const sections = (assessment.template.sections as any[]) || [];
  const totalQuestions = sections.reduce(
    (sum: number, sec: any) => sum + (sec.questions?.length || 0),
    0
  );

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
      name: assessment.template.name,
      version: assessment.template.version,
      sections,
    },
    processingActivity: assessment.processingActivity,
    vendor: assessment.vendor,
    responses: assessment.responses.map((r) => ({
      sectionId: r.sectionId,
      questionId: r.questionId,
      response: typeof r.response === "string" ? r.response : JSON.stringify(r.response),
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
    completionPercentage:
      totalQuestions > 0
        ? Math.round((assessment.responses.length / totalQuestions) * 100)
        : 0,
    totalQuestions,
  };

  const buffer = await renderToBuffer(AssessmentReport({ data }));
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
