// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/export/document-pack?organizationId=&drafts=1&locale=
 * Every ready document in one ZIP, and the drafts too with `drafts=1`
 * (src/server/services/export/document-pack.ts). Same authentication as the
 * other exports: the session, then membership of the organisation. A member
 * limited to departments gets no organisation-wide documents, as on the
 * dashboard (src/lib/department-limit.ts).
 */

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { canHandleDsars } from "@/lib/dsar-access";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { buildDocumentPack } from "@/server/services/export/document-pack";
import { resolveExportLocale } from "@/server/services/export/documents/context";

// Several PDFs are rendered one after the other.
export const maxDuration = 60;

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

    const { zip, filename } = await buildDocumentPack(prisma, {
      organizationId,
      orgName: membership.organization.name,
      userId: membership.userId,
      locale: await resolveExportLocale(searchParams.get("locale")),
      includeDrafts: searchParams.get("drafts") === "1",
      dsarAllowed: canHandleDsars(membership.role),
    });

    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "document-pack");
  }
}
