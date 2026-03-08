import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { DataInventoryReport, dataInventoryToCSV } from "@/server/services/export/data-inventory-report";
import type { DataInventoryExportData } from "@/server/services/export/data-inventory-report";
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

  const [assets, flows, transfers] = await Promise.all([
    prisma.dataAsset.findMany({
      where: { organizationId },
      include: { dataElements: true },
      orderBy: { name: "asc" },
    }),
    prisma.dataFlow.findMany({
      where: { organizationId },
      include: {
        sourceAsset: { select: { name: true } },
        destinationAsset: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.dataTransfer.findMany({
      where: { organizationId },
      include: {
        processingActivity: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const data: DataInventoryExportData = {
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      owner: a.owner,
      location: a.location,
      hostingType: a.hostingType,
      description: a.description,
      isProduction: a.isProduction,
      dataElements: a.dataElements.map((e) => ({
        name: e.name,
        category: e.category,
        sensitivity: e.sensitivity,
        isPersonalData: e.isPersonalData,
        isSpecialCategory: e.isSpecialCategory,
        retentionDays: e.retentionDays,
      })),
    })),
    flows: flows.map((f) => ({
      name: f.name,
      description: f.description,
      sourceAsset: f.sourceAsset,
      destinationAsset: f.destinationAsset,
      dataCategories: f.dataCategories,
      frequency: f.frequency,
      encryptionMethod: f.encryptionMethod,
      isAutomated: f.isAutomated,
    })),
    transfers: transfers.map((t) => ({
      name: t.name,
      destinationCountry: t.destinationCountry,
      destinationOrg: t.destinationOrg,
      mechanism: t.mechanism,
      safeguards: t.safeguards,
      tiaCompleted: t.tiaCompleted,
      tiaDate: t.tiaDate,
      isActive: t.isActive,
      processingActivity: t.processingActivity,
    })),
  };

  const orgName = membership.organization.name;
  const dateStr = fmtDate(new Date());

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: membership.userId,
      entityType: "DataAsset",
      entityId: organizationId,
      action: "EXPORT_DATA_INVENTORY",
      changes: { format, assetCount: assets.length, flowCount: flows.length, transferCount: transfers.length },
    },
  });

  if (format === "csv") {
    const csv = dataInventoryToCSV(data);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Data-Inventory-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.csv"`,
      },
    });
  }

  const buffer = await renderToBuffer(
    DataInventoryReport({ data, orgName })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Data-Inventory-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
    },
  });
}
