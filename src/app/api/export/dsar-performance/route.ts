import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  DSARPerformanceReport,
  type DSARPerformanceData,
} from "@/server/services/export/dsar-performance-report";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { locales, defaultLocale } from "@/i18n/config";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json({ error: "Missing organizationId" }, { status: 400 });
  }

  const limited = checkExportRateLimit(request, userEmail);
  if (limited) return limited;

  try {

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

  // Locale resolution: ?locale=es → NEXT_LOCALE cookie → default
  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const resolvedLocale = [requestedLocale, cookieLocale, defaultLocale].find(
    (l): l is string => !!l && (locales as readonly string[]).includes(l)
  ) ?? defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "pdf.dsarPerformance" });

  // ── Primary jurisdiction ───────────────────────────────
  const primaryJurisdiction = await prisma.organizationJurisdiction.findFirst({
    where: { organizationId, isPrimary: true },
    include: { jurisdiction: { select: { name: true, dsarDeadlineDays: true } } },
  });
  const primaryName = primaryJurisdiction?.jurisdiction.name ?? null;
  const primaryDeadlineDays = primaryJurisdiction?.jurisdiction.dsarDeadlineDays ?? 30;

  // ── All DSARs (no PII — only status, type, dates) ─────
  const allDsars = await prisma.dSARRequest.findMany({
    where: { organizationId },
    select: {
      status: true,
      type: true,
      receivedAt: true,
      completedAt: true,
      dueDate: true,
      redactedAt: true,
    },
  });

  const now = new Date();
  const total = allDsars.length;
  const completed = allDsars.filter((d) => d.status === "COMPLETED").length;
  const open = allDsars.filter(
    (d) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(d.status)
  ).length;
  const overdue = allDsars.filter(
    (d) =>
      d.dueDate &&
      new Date(d.dueDate) < now &&
      !["COMPLETED", "CANCELLED", "REJECTED"].includes(d.status)
  ).length;
  const redacted = allDsars.filter((d) => d.redactedAt != null).length;

  // Avg resolution days
  const completedWithDates = allDsars.filter(
    (d) => d.status === "COMPLETED" && d.completedAt
  );
  const avgResolutionDays =
    completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce((sum, d) => {
            return (
              sum +
              (d.completedAt!.getTime() - d.receivedAt.getTime()) /
                (1000 * 60 * 60 * 24)
            );
          }, 0) / completedWithDates.length
        )
      : 0;

  // On-time rate (completed within deadline)
  const completedOnTime = completedWithDates.filter(
    (d) => d.dueDate && d.completedAt! <= d.dueDate
  ).length;
  const onTimeRate =
    completedWithDates.length > 0
      ? Math.round((completedOnTime / completedWithDates.length) * 100)
      : 100;

  // Last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const completedLast30Days = allDsars.filter(
    (d) => d.status === "COMPLETED" && d.completedAt && d.completedAt >= thirtyDaysAgo
  ).length;

  // ── By Type ────────────────────────────────────────────
  const typeMap = new Map<string, number>();
  for (const d of allDsars) {
    typeMap.set(d.type, (typeMap.get(d.type) ?? 0) + 1);
  }
  const byType = Array.from(typeMap.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  // ── By Status ──────────────────────────────────────────
  const statusMap = new Map<string, number>();
  for (const d of allDsars) {
    statusMap.set(d.status, (statusMap.get(d.status) ?? 0) + 1);
  }
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  // ── Jurisdiction SLA ───────────────────────────────────
  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    include: { jurisdiction: { select: { name: true, dsarDeadlineDays: true } } },
  });
  const jurisdictionSLA = orgJurisdictions.map((oj) => ({
    name: oj.jurisdiction.name,
    deadlineDays: oj.jurisdiction.dsarDeadlineDays ?? 30,
    status:
      avgResolutionDays > 0 && avgResolutionDays <= (oj.jurisdiction.dsarDeadlineDays ?? 30)
        ? "Meeting"
        : avgResolutionDays > (oj.jurisdiction.dsarDeadlineDays ?? 30)
          ? "At risk"
          : "No data",
  }));

  // ── Monthly Trend (last 12 months) ─────────────────────
  const monthlyTrend: { month: string; received: number; completed: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    const received = allDsars.filter(
      (d) => d.receivedAt >= monthStart && d.receivedAt <= monthEnd
    ).length;
    const monthCompleted = allDsars.filter(
      (d) =>
        d.completedAt &&
        d.completedAt >= monthStart &&
        d.completedAt <= monthEnd
    ).length;

    monthlyTrend.push({ month: monthLabel, received, completed: monthCompleted });
  }

  // ── Aging Analysis ─────────────────────────────────────
  const openDsars = allDsars.filter(
    (d) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(d.status)
  );
  const ageBands = [
    { band: "0-7 days", min: 0, max: 7 },
    { band: "7-14 days", min: 7, max: 14 },
    { band: "14-30 days", min: 14, max: 30 },
    { band: "30+ days", min: 30, max: Infinity },
  ];
  const aging = ageBands.map((band) => ({
    band: band.band,
    count: openDsars.filter((d) => {
      const age = (now.getTime() - d.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
      return age >= band.min && age < band.max;
    }).length,
  }));

  // ── Build Report ───────────────────────────────────────
  const reportData: DSARPerformanceData = {
    organization: { name: org.name },
    generatedAt: fmtDate(new Date()),
    primaryJurisdiction: primaryName,
    primaryDeadlineDays,
    stats: {
      total,
      completed,
      overdue,
      open,
      onTimeRate,
      avgResolutionDays,
      completedLast30Days,
      redacted,
    },
    byType,
    byStatus,
    jurisdictionSLA,
    monthlyTrend,
    aging,
  };

  const buffer = await renderToBuffer(
    DSARPerformanceReport({ data: reportData, t, locale: resolvedLocale })
  );

  const dateStr = fmtDate(new Date());
  const filename = `DSAR-Performance-${org.name.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf`;

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
      entityType: "Report",
      entityId: "dsar-performance",
      action: "EXPORT_PDF",
      changes: {
        format: "pdf",
        reportType: "dsar-performance",
        requestCount: total,
      },
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  } catch (err) {
    return pdfErrorResponse(err, "dsar-performance");
  }
}
