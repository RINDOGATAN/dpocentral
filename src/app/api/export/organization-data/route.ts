// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";

/**
 * GET /api/export/organization-data?organizationId=...
 *
 * Every record the organisation holds, as one JSON file. Any member may
 * download it. It is a GET route, so it stays available when a hosted pilot
 * organisation has become read-only: the pilot's promise is that everything
 * created there can be taken to the user's own instance.
 */
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

    const where = { organizationId };
    const [
      members,
      jurisdictions,
      dataAssets,
      processingActivities,
      dataFlows,
      dataTransfers,
      dsarIntakeForms,
      dsarRequests,
      assessmentTemplates,
      assessments,
      incidents,
      vendors,
      aiSystems,
    ] = await Promise.all([
      prisma.organizationMember.findMany({
        where,
        select: {
          role: true,
          joinedAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.organizationJurisdiction.findMany({ where, include: { jurisdiction: true } }),
      prisma.dataAsset.findMany({ where, include: { dataElements: true } }),
      prisma.processingActivity.findMany({ where, include: { assets: true } }),
      prisma.dataFlow.findMany({ where }),
      prisma.dataTransfer.findMany({ where }),
      prisma.dSARIntakeForm.findMany({ where }),
      prisma.dSARRequest.findMany({
        where,
        include: { tasks: true, communications: true },
      }),
      prisma.assessmentTemplate.findMany({ where }),
      prisma.assessment.findMany({
        where,
        include: { responses: true, mitigations: true, approvals: true },
      }),
      prisma.incident.findMany({
        where,
        include: {
          notifications: true,
          timeline: true,
          tasks: true,
          affectedAssets: true,
          documents: true,
        },
      }),
      prisma.vendor.findMany({ where, include: { contracts: true, reviews: true } }),
      prisma.aISystem.findMany({ where }),
    ]);

    const org = membership.organization;
    const body = {
      exportedAt: new Date().toISOString(),
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        domain: org.domain,
        settings: org.settings,
        createdAt: org.createdAt,
      },
      members,
      jurisdictions,
      dataAssets,
      processingActivities,
      dataFlows,
      dataTransfers,
      dsarIntakeForms,
      dsarRequests,
      assessmentTemplates,
      assessments,
      incidents,
      vendors,
      aiSystems,
    };

    const date = new Date().toISOString().split("T")[0];
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${org.slug}-export-${date}.json"`,
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "organization-data");
  }
}
