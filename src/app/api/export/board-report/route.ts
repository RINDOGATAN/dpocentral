// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/export/board-report?organizationId=&from=YYYY-MM-DD&to=YYYY-MM-DD&locale=
 * The board report as a PDF (owner's decision d12), for the period asked for
 * or the last full quarter. Same authentication as the other exports: the
 * session, then membership of the organisation. A member limited to
 * departments gets no organisation-wide report, as on the dashboard.
 */

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { resolvePeriod } from "@/lib/board-report";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { buildBoardReportExport } from "@/server/services/export/documents/board-report";
import { fileResponse, resolveExportLocale } from "@/server/services/export/documents/context";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json({ error: "organizationId is required" }, { status: 400 });
  }

  const token = await getSessionToken(request);
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, user: { email: userEmail } },
      include: { organization: true },
    });
    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const scope = await loadBusinessUnitScope(prisma, membership.id);
    if (!scope.all) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const file = await buildBoardReportExport({
      prisma,
      organizationId,
      orgName: membership.organization.name,
      userId: membership.userId,
      locale: await resolveExportLocale(searchParams.get("locale")),
      period: resolvePeriod(searchParams.get("from"), searchParams.get("to"), new Date()),
      audit: true,
    });
    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "board-report");
  }
}
