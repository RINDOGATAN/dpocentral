// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { hasRopaExportAccess } from "@/server/services/licensing/entitlement";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { buildRopaExport, ropaDraftNote, type RopaFormat } from "@/server/services/export/documents/ropa";
import { loadBusinessUnitScope } from "@/server/services/business-units/scope";
import { getTranslations } from "next-intl/server";
import { fileResponse, resolveExportLocale } from "@/server/services/export/documents/context";

export async function GET(request: Request) {
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

    // Premium feature gate
    const hasAccess = await hasRopaExportAccess(organizationId);
    if (!hasAccess) {
      const t = await getTranslations({ locale, namespace: "serverErrors.exact" });
      return Response.json(
        { error: t("ropaExportRequiresAPremiumSubscriptionEnableThis"), code: "ROPA_EXPORT_NOT_ENABLED" },
        { status: 403 }
      );
    }

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
      // The standalone controller record says it is a draft on the same rule
      // as the document pack (whole-organisation view only).
      draftNote:
        format === "pdf" && kind === "controller" && scope.all
          ? await ropaDraftNote(prisma, organizationId, locale)
          : null,
    });
    return fileResponse(file);
  } catch (err) {
    return pdfErrorResponse(err, "ropa");
  }
}
