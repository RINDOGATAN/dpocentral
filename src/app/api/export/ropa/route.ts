import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { ROPAReport } from "@/server/services/export/ropa-report";
import { ropaToCSV } from "@/server/services/privacy/ropaGenerator";
import type { ROPAEntry } from "@/server/services/privacy/ropaGenerator";
import { hasRopaExportAccess } from "@/server/services/licensing/entitlement";
import { fmtDate } from "@/server/services/export/pdf-styles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const format = searchParams.get("format") || "pdf";

  if (!organizationId) {
    return Response.json({ error: "organizationId is required" }, { status: 400 });
  }

  const token = await getToken({ req: request });
  const userEmail = token?.email as string | undefined;
  if (!userEmail) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const activities = await prisma.processingActivity.findMany({
    where: { organizationId, isActive: true },
    include: {
      assets: {
        include: {
          linkedElements: { include: { dataElement: true } },
          dataAsset: { include: { dataElements: true } },
        },
      },
      transfers: true,
    },
    orderBy: { name: "asc" },
  });

  const entries: ROPAEntry[] = activities.map((activity) => ({
    name: activity.name,
    description: activity.description,
    purpose: activity.purpose,
    legalBasis: activity.legalBasis,
    legalBasisDetail: activity.legalBasisDetail,
    dataSubjects: activity.dataSubjects,
    dataCategories: activity.categories,
    recipients: activity.recipients,
    retentionPeriod: activity.retentionPeriod,
    automatedDecisionMaking: activity.automatedDecisionMaking,
    automatedDecisionDetail: activity.automatedDecisionDetail,
    systems: activity.assets.map((a) => {
      const effectiveElements = a.linkedElements.length > 0
        ? a.linkedElements.map((le) => le.dataElement)
        : a.dataAsset.dataElements;
      return {
        name: a.dataAsset.name,
        type: a.dataAsset.type,
        location: a.dataAsset.location,
        elements: effectiveElements.map((e) => ({
          name: e.name,
          category: e.category,
          sensitivity: e.sensitivity,
        })),
      };
    }),
    transfers: activity.transfers.map((t) => ({
      destination: t.destinationCountry,
      organization: t.destinationOrg,
      mechanism: t.mechanism,
      safeguards: t.safeguards,
    })),
    lastReviewed: activity.lastReviewedAt,
    nextReview: activity.nextReviewAt,
  }));

  const orgName = membership.organization.name;
  const dateStr = fmtDate(new Date());

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
      entityType: "ProcessingActivity",
      entityId: organizationId,
      action: "EXPORT_ROPA",
      changes: { format, count: entries.length },
    },
  });

  if (format === "csv") {
    const csv = ropaToCSV(entries);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ROPA-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.csv"`,
      },
    });
  }

  const buffer = await renderToBuffer(
    ROPAReport({ entries, orgName })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ROPA-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
    },
  });
}
