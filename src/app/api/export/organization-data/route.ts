// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { dsarReadFilter } from "@/server/services/dsar/access";
import { isDsarModuleEnabled } from "@/config/features";
import { canExportProgramme } from "@/server/services/portability/access";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { exportableOrganizationSettings } from "@/server/services/export/organization-settings";

/**
 * GET /api/export/organization-data?organizationId=...
 *
 * Every record the organisation holds, as one JSON file, with the names and
 * e-mail addresses of its members. Owners and admins only, and only those who
 * see the whole organisation (a member limited to departments is refused: the
 * file is not split by department). Rights requests still follow the reading
 * rule of the DSAR module (src/lib/dsar-access.ts). Each download is recorded
 * in the audit trail (EXPORT_ORGANIZATION_DATA: who, when, what) before the
 * file is sent. Only the allow-listed organisation settings leave
 * (exportableOrganizationSettings): pending invitations and integration secrets
 * stay behind. It is a GET route, so it stays available when a hosted pilot
 * organisation has become read-only: the pilot's promise is that everything
 * created there can be taken to the user's own instance.
 *
 * When the rights-request module is not part of this plan
 * (NEXT_PUBLIC_DSAR_ENABLED=false) the file leaves the rights requests and
 * intake forms out; owners and admins download those on their own from
 * /api/export/rights-requests.
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
    if (!membership || !canExportProgramme(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const scope = await loadBusinessUnitScope(prisma, membership.id);
    if (!scope.all) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const where = { organizationId };
    const dsarOn = isDsarModuleEnabled();
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
      dsarOn ? prisma.dSARIntakeForm.findMany({ where }) : null,
      dsarOn
        ? prisma.dSARRequest.findMany({
            where: { ...where, ...dsarReadFilter(membership.role, membership.userId) },
            include: { tasks: true, communications: true },
          })
        : null,
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
    const sections = {
      members: members.length,
      jurisdictions: jurisdictions.length,
      dataAssets: dataAssets.length,
      processingActivities: processingActivities.length,
      dataFlows: dataFlows.length,
      dataTransfers: dataTransfers.length,
      ...(dsarOn ? { dsarIntakeForms: dsarIntakeForms?.length ?? 0, dsarRequests: dsarRequests?.length ?? 0 } : {}),
      assessmentTemplates: assessmentTemplates.length,
      assessments: assessments.length,
      incidents: incidents.length,
      vendors: vendors.length,
      aiSystems: aiSystems.length,
    };
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: membership.userId,
        entityType: "Organization",
        entityId: organizationId,
        action: "EXPORT_ORGANIZATION_DATA",
        changes: { format: "json", rightsRequests: dsarOn, sections },
      },
    });

    const body = {
      exportedAt: new Date().toISOString(),
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        domain: org.domain,
        settings: exportableOrganizationSettings(org.settings),
        createdAt: org.createdAt,
      },
      members,
      jurisdictions,
      dataAssets,
      processingActivities,
      dataFlows,
      dataTransfers,
      ...(dsarOn ? { dsarIntakeForms, dsarRequests } : {}),
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
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "organization-data");
  }
}
