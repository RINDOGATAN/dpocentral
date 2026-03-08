import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { BreachRegisterReport, incidentsToCSV } from "@/server/services/export/breach-register";
import type { IncidentExportData } from "@/server/services/export/breach-register";
import { fmtDate } from "@/server/services/export/pdf-styles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const format = searchParams.get("format") || "pdf";

  if (!organizationId) {
    return Response.json({ error: "organizationId is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      user: { email: session.user.email },
    },
    include: { organization: true },
  });
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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
    BreachRegisterReport({ incidents: data, orgName })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Breach-Register-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
    },
  });
}
