// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { buildRegulatoryLandscapeExport } from "@/server/services/export/documents/regulatory-landscape";
import { fileResponse, resolveExportLocale } from "@/server/services/export/documents/context";

export async function GET(request: NextRequest) {
  const token = await getSessionToken(request);
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json({ error: "Missing organizationId" }, { status: 400 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {
    // Verify membership
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

    const file = await buildRegulatoryLandscapeExport({
      prisma,
      organizationId,
      orgName: org.name,
      userId: membership.userId,
      locale: await resolveExportLocale(url.searchParams.get("locale")),
      audit: true,
    });
    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "regulatory-landscape");
  }
}
