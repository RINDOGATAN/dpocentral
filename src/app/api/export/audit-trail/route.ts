// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/export/audit-trail?organizationId=...[&entityType=&action=&userId=&from=&to=&locale=]
 *
 * The organisation's audit trail as CSV, newest first, with the same filters
 * as the page (src/server/services/audit/trail.ts) and the same rule for
 * entries about rights requests (reference and action only). Owners, admins
 * and privacy officers only (src/lib/audit-access.ts). A GET route, so it
 * also works for a hosted pilot organisation that has become read-only.
 *
 * The export is itself recorded in the trail (EXPORT_AUDIT_TRAIL).
 */

import { getSessionToken } from "@/lib/session-cookie";
import prisma from "@/lib/prisma";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { canReadAuditTrail } from "@/lib/audit-access";
import { AUDIT_ROW_SELECT, auditWhere, toAuditViews, type AuditFilters } from "@/server/services/audit/trail";
import { AUDIT_CSV_MAX_ROWS, auditTrailCsv } from "@/server/services/audit/csv";
import { exportStamp } from "@/server/services/export/integrity";
import { CSV, fileResponse, nameForFile, resolveExportLocale, today } from "@/server/services/export/documents/context";

function dateParam(raw: string | null): Date | undefined | null {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

  const from = dateParam(searchParams.get("from"));
  const to = dateParam(searchParams.get("to"));
  if (from === null || to === null) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }
  const text = (name: string) => {
    const v = searchParams.get(name);
    return v ? v.slice(0, 100) : undefined;
  };
  const filters: AuditFilters = {
    entityType: text("entityType"),
    action: text("action"),
    userId: text("userId"),
    from,
    to,
  };

  try {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, user: { email: userEmail } },
      include: { organization: true },
    });
    if (!membership || !canReadAuditTrail(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.auditLog.findMany({
      where: auditWhere(organizationId, filters),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: AUDIT_CSV_MAX_ROWS,
      select: AUDIT_ROW_SELECT,
    });
    const entries = await toAuditViews(prisma, organizationId, rows);
    const locale = (await resolveExportLocale(searchParams.get("locale"))) === "es" ? "es" : "en";
    const csv = auditTrailCsv({
      entries,
      stamp: exportStamp(),
      orgName: membership.organization.name,
      filters,
      locale,
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: membership.userId,
        entityType: "AuditLog",
        entityId: organizationId,
        action: "EXPORT_AUDIT_TRAIL",
        changes: {
          format: "csv",
          rows: entries.length,
          truncated: entries.length >= AUDIT_CSV_MAX_ROWS,
          entityType: filters.entityType ?? null,
          action: filters.action ?? null,
          actor: filters.userId ?? null,
          from: filters.from?.toISOString() ?? null,
          to: filters.to?.toISOString() ?? null,
        },
      },
    });

    return fileResponse({
      data: csv,
      filename: `Audit-Trail-${nameForFile(membership.organization.name)}-${today()}.csv`,
      contentType: CSV,
    });
  } catch (err) {
    return pdfErrorResponse(err, "audit-trail");
  }
}
