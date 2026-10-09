// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import {
  ASSESSMENT_EXPORT_INCLUDE,
  buildAssessmentExport,
} from "@/server/services/export/documents/assessment";
import { fileResponse, resolveExportLocale } from "@/server/services/export/documents/context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = await getSessionToken(request);
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
    include: ASSESSMENT_EXPORT_INCLUDE,
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
  const locale = await resolveExportLocale(url.searchParams.get("locale"));
  const file = await buildAssessmentExport(
    { ...assessment, template: assessment.template },
    locale,
  );

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

  return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "assessment");
  }
}
