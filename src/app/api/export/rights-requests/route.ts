// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";

/** The roles that may take the organisation's rights-request records away. */
const RIGHTS_REQUEST_EXPORT_ROLES = ["OWNER", "ADMIN"] as const;

/**
 * GET /api/export/rights-requests?organizationId=...
 *
 * Every rights-request (DSAR) record the organisation holds, as one JSON file:
 * the requests with their tasks, messages, reminders and module audit trail,
 * the public intake forms, and the general audit entries about requests.
 * Owners and admins only.
 *
 * Available whether or not the rights-request module is part of this plan
 * (NEXT_PUBLIC_DSAR_ENABLED, src/config/features.ts): when the module is
 * switched off, this is how an organisation takes its earlier records before
 * they are deleted (scripts/purge-dsar-data.ts). A GET route, so it also works
 * for a hosted pilot organisation that has become read-only.
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
    if (
      !membership ||
      !(RIGHTS_REQUEST_EXPORT_ROLES as readonly string[]).includes(membership.role)
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const where = { organizationId };
    const [dsarIntakeForms, dsarRequests] = await Promise.all([
      prisma.dSARIntakeForm.findMany({ where }),
      prisma.dSARRequest.findMany({
        where,
        include: { tasks: true, communications: true, auditLog: true, reminders: true },
        orderBy: { receivedAt: "asc" },
      }),
    ]);
    const auditEntries = await prisma.auditLog.findMany({
      where: { organizationId, entityType: "DSARRequest" },
      orderBy: { createdAt: "asc" },
    });

    const org = membership.organization;
    const body = {
      exportedAt: new Date().toISOString(),
      organization: { id: org.id, name: org.name, slug: org.slug },
      counts: {
        dsarRequests: dsarRequests.length,
        dsarIntakeForms: dsarIntakeForms.length,
        auditEntries: auditEntries.length,
      },
      dsarIntakeForms,
      dsarRequests,
      auditEntries,
    };

    const date = new Date().toISOString().split("T")[0];
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${org.slug}-rights-requests-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "rights-requests");
  }
}
