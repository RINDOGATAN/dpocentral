// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { buildPrivacyProgramExport } from "@/server/services/export/documents/privacy-program";
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

    const file = await buildPrivacyProgramExport({
      prisma,
      organizationId,
      orgName: membership.organization.name,
      userId: membership.userId,
      // Locale resolution: ?locale=es  →  `locale` cookie  →  default.
      locale: await resolveExportLocale(searchParams.get("locale")),
      audit: true,
    });
    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "privacy-program");
  }
}
