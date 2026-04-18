import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { BreachRegisterReport, incidentsToCSV } from "@/server/services/export/breach-register";
import type { IncidentExportData } from "@/server/services/export/breach-register";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { locales, defaultLocale } from "@/i18n/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const format = searchParams.get("format") || "pdf";

  if (!organizationId) {
    return Response.json({ error: "organizationId is required" }, { status: 400 });
  }

  const token = await getToken({ req: request as unknown as NextRequest });
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

  // Locale resolution: ?locale=es → NEXT_LOCALE cookie → default
  const requestedLocale = searchParams.get("locale");
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const resolvedLocale = [requestedLocale, cookieLocale, defaultLocale].find(
    (l): l is string => !!l && (locales as readonly string[]).includes(l)
  ) ?? defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "pdf.breachRegister" });

  const incidents = await prisma.incident.findMany({
    where: { organizationId },
    include: {
      notifications: {
        include: { jurisdiction: true },
      },
      timeline: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { timestamp: "asc" },
      },
    },
    orderBy: { discoveredAt: "desc" },
  });

  const data: IncidentExportData[] = incidents.map((inc) => ({
    id: inc.id,
    publicId: inc.publicId,
    title: inc.title,
    description: inc.description,
    type: inc.type,
    severity: inc.severity,
    status: inc.status,
    discoveredAt: inc.discoveredAt,
    discoveredBy: inc.discoveredBy,
    discoveryMethod: inc.discoveryMethod,
    affectedRecords: inc.affectedRecords,
    affectedSubjects: inc.affectedSubjects,
    dataCategories: inc.dataCategories,
    containedAt: inc.containedAt,
    containmentActions: inc.containmentActions,
    rootCause: inc.rootCause,
    resolvedAt: inc.resolvedAt,
    resolutionNotes: inc.resolutionNotes,
    lessonsLearned: inc.lessonsLearned,
    notificationRequired: inc.notificationRequired,
    notificationDeadline: inc.notificationDeadline,
    createdAt: inc.createdAt,
    notifications: inc.notifications.map((n) => ({
      status: n.status,
      notificationDate: n.sentAt,
      jurisdiction: { name: n.jurisdiction.name, code: n.jurisdiction.code },
    })),
    timeline: inc.timeline.map((t) => ({
      title: t.title,
      description: t.description,
      timestamp: t.timestamp,
      user: t.createdBy,
    })),
  }));

  const orgName = membership.organization.name;
  const dateStr = fmtDate(new Date());

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
      entityType: "Incident",
      entityId: organizationId,
      action: "EXPORT_BREACH_REGISTER",
      changes: { format, count: data.length },
    },
  });

  if (format === "csv") {
    const csv = incidentsToCSV(data);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Breach-Register-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.csv"`,
      },
    });
  }

    const buffer = await renderToBuffer(
      BreachRegisterReport({ incidents: data, orgName, t, locale: resolvedLocale })
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Breach-Register-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "breach-register");
  }
}
