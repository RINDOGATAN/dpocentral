// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { hasRopaExportAccess } from "@/server/services/licensing/entitlement";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { buildRopaExport } from "@/server/services/export/documents/ropa";
import { fileResponse, resolveExportLocale } from "@/server/services/export/documents/context";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const format = searchParams.get("format") === "csv" ? "csv" : "pdf";

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

    // Premium feature gate
    const hasAccess = await hasRopaExportAccess(organizationId);
    if (!hasAccess) {
      return Response.json(
        { error: "ROPA Export requires a premium subscription" },
        { status: 403 }
      );
    }

    const file = await buildRopaExport({
      prisma,
      organizationId,
      orgName: membership.organization.name,
      userId: membership.userId,
      locale: await resolveExportLocale(searchParams.get("locale")),
      format,
      audit: true,
    });
    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "ropa");
  }
}
