// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { buildRopaExport, type RopaFormat } from "@/server/services/export/documents/ropa";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { fileResponse, resolveExportLocale, withExportLanguage } from "@/server/services/export/documents/context";

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const requested = searchParams.get("format");
  const format: RopaFormat =
    requested === "csv" || requested === "xlsx" || requested === "json" ? requested : "pdf";
  // ?record=processor gives the processor record (Art. 30(2)).
  const kind = searchParams.get("record") === "processor" ? "processor" : "controller";

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
      where: {
        organizationId,
        user: { email: userEmail },
      },
      include: { organization: true },
    });
    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const locale = await resolveExportLocale(searchParams.get("locale"));

    // A member limited to departments gets the activities of those departments.
    const scope = await loadBusinessUnitScope(prisma, membership.id);

    const file = await buildRopaExport({
      prisma,
      organizationId,
      orgName: membership.organization.name,
      userId: membership.userId,
      locale,
      format,
      kind,
      scope,
      audit: true,
    });
    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "ropa");
  }
}

export const GET = withExportLanguage(handleGET);
