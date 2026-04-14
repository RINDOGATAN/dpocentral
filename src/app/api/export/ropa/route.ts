import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { ROPAReport } from "@/server/services/export/ropa-report";
import { ropaToCSV } from "@/server/services/privacy/ropaGenerator";
import type { ROPAEntry } from "@/server/services/privacy/ropaGenerator";
import { hasRopaExportAccess } from "@/server/services/licensing/entitlement";
import { fmtDate } from "@/server/services/export/pdf-styles";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import {
  renderFlowGraphPng,
  type PdfFlowAsset,
  type PdfFlowEdge,
  type PdfFlowCluster,
} from "@/server/services/export/flow-graph-pdf";

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

  // ─── Build the per-activity cluster flow graph ───────────────────────
  // Each activity becomes a subgraph cluster containing the assets it
  // touches. Assets shared across activities are placed in the cluster
  // of the first activity (alphabetical) that references them, so the
  // graph stays readable while inter-cluster edges still show sharing.
  const flows = await prisma.dataFlow.findMany({
    where: { organizationId },
    include: {
      sourceAsset: { select: { id: true, name: true, type: true } },
      destinationAsset: { select: { id: true, name: true, type: true } },
    },
  });

  const assetMap = new Map<string, PdfFlowAsset>();
  for (const a of activities) {
    for (const link of a.assets) {
      assetMap.set(link.dataAsset.id, {
        id: link.dataAsset.id,
        name: link.dataAsset.name,
        type: link.dataAsset.type,
      });
    }
  }
  for (const f of flows) {
    assetMap.set(f.sourceAsset.id, f.sourceAsset);
    assetMap.set(f.destinationAsset.id, f.destinationAsset);
  }

  // Track which activity gets to "own" each asset (first wins, alphabetical)
  const assetOwner = new Map<string, string>();
  for (const activity of [...activities].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const link of activity.assets) {
      if (!assetOwner.has(link.dataAsset.id)) {
        assetOwner.set(link.dataAsset.id, activity.id);
      }
    }
  }

  const clusters: PdfFlowCluster[] = activities
    .map((a) => ({
      id: a.id,
      label: a.name,
      assetIds: a.assets
        .map((l) => l.dataAsset.id)
        .filter((id) => assetOwner.get(id) === a.id),
    }))
    .filter((c) => c.assetIds.length > 0);

  const flowEdges: PdfFlowEdge[] = flows.map((f) => {
    const meta = f.metadata as { autoGenerated?: boolean } | null;
    return {
      sourceAssetId: f.sourceAssetId,
      destinationAssetId: f.destinationAssetId,
      label: [f.dataCategories[0], f.frequency].filter(Boolean).join(" · ") || undefined,
      isAutoGenerated: meta?.autoGenerated === true,
    };
  });

  const flowGraph = await renderFlowGraphPng(
    [...assetMap.values()],
    flowEdges,
    { rankdir: "LR", clusters, fitWidth: 720 }
  );

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
    ROPAReport({ entries, orgName, flowGraph })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ROPA-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
    },
  });
  } catch (err) {
    return pdfErrorResponse(err, "ropa");
  }
}
