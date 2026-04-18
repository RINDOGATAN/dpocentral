import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { PrivacyProgramDocument } from "@/server/services/export/privacy-program/PrivacyProgramDocument";
import type { ProgramInput } from "@/server/services/export/privacy-program/data-mapping";
import { buildFlowGraphInputs } from "@/server/services/export/privacy-program/flow-input";
import type { FlowPageBatch } from "@/server/services/export/privacy-program/pages/DataFlowPage";
import { renderFlowGraphPng } from "@/server/services/export/flow-graph-pdf";
import { checkExportRateLimit, pdfErrorResponse } from "@/lib/api-export";
import { locales, defaultLocale } from "@/i18n/config";

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

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
      where: { organizationId, user: { email: userEmail } },
      include: { organization: true },
    });
    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Locale resolution: ?locale=es  →  NEXT_LOCALE cookie  →  default.
    const requestedLocale = searchParams.get("locale");
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    const resolvedLocale = [requestedLocale, cookieLocale, defaultLocale].find(
      (l): l is string => !!l && (locales as readonly string[]).includes(l)
    ) ?? defaultLocale;
    const [t, tCommon, tEnum] = await Promise.all([
      getTranslations({ locale: resolvedLocale, namespace: "pdf.privacyProgram" }),
      getTranslations({ locale: resolvedLocale, namespace: "pdf.common" }),
      getTranslations({ locale: resolvedLocale, namespace: "pdf.enum" }),
    ]);

    const now = new Date();

    const [
      assets,
      activities,
      vendors,
      aiSystems,
      flows,
      openDsars,
      overdueDsars,
      completedDsars,
      openIncidents,
      activeAssessments,
    ] = await Promise.all([
      prisma.dataAsset.findMany({
        where: { organizationId },
        include: { dataElements: true },
        orderBy: { name: "asc" },
      }),
      prisma.processingActivity.findMany({
        where: { organizationId, isActive: true },
        include: { assets: true, transfers: true },
        orderBy: { name: "asc" },
      }),
      prisma.vendor.findMany({
        where: { organizationId },
        include: { contracts: { orderBy: { createdAt: "desc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.aISystem.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.dataFlow.findMany({
        where: { organizationId },
      }),
      prisma.dSARRequest.count({
        where: {
          organizationId,
          status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
        },
      }),
      prisma.dSARRequest.count({
        where: {
          organizationId,
          status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          dueDate: { lt: now },
        },
      }),
      prisma.dSARRequest.findMany({
        where: { organizationId, status: "COMPLETED" },
        select: { dueDate: true, updatedAt: true },
      }),
      prisma.incident.count({
        where: { organizationId, status: { notIn: ["CLOSED", "FALSE_POSITIVE"] } },
      }),
      prisma.assessment.count({
        where: {
          organizationId,
          status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] },
        },
      }),
    ]);

    const completedDsarsOnTime = completedDsars.filter(
      (d) => !d.dueDate || d.updatedAt <= d.dueDate
    ).length;

    const input: ProgramInput = {
      assets: assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        owner: a.owner,
        location: a.location,
        isProduction: a.isProduction,
        elementCount: a.dataElements.length,
        personalCount: a.dataElements.filter((e) => e.isPersonalData).length,
        specialCatCount: a.dataElements.filter((e) => e.isSpecialCategory).length,
      })),
      activities: activities.map((a) => ({
        id: a.id,
        name: a.name,
        legalBasis: a.legalBasis,
        automatedDecisionMaking: a.automatedDecisionMaking,
        transferCount: a.transfers.length,
        systemCount: a.assets.length,
        nextReview: a.nextReviewAt,
      })),
      vendors: vendors.map((v) => {
        const dpa = v.contracts.find((c) => c.type === "DPA");
        return {
          id: v.id,
          name: v.name,
          status: v.status,
          riskTier: v.riskTier,
          categories: v.categories,
          countries: v.countries,
          certifications: v.certifications,
          hasDpa: !!dpa,
          dpaStatus: dpa ? dpa.status.replace(/_/g, " ") : null,
          nextReview: v.nextReviewAt,
        };
      }),
      aiSystems: aiSystems.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        riskLevel: s.riskLevel,
        status: s.status,
        euAiActRole: s.euAiActRole,
        euAiActCompliant: s.euAiActCompliant,
        iso42001Certified: s.iso42001Certified,
        provider: s.provider,
      })),
      counts: {
        openDsars,
        overdueDsars,
        completedDsarsOnTime,
        completedDsarsTotal: completedDsars.length,
        openIncidents,
        activeAssessments,
      },
    };

    // ── Build flow-map batches with production + participation filter ────────
    const flowResult = buildFlowGraphInputs(
      assets.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        isProduction: a.isProduction,
      })),
      flows.map((f) => {
        const meta = f.metadata as { autoGenerated?: boolean } | null;
        return {
          sourceAssetId: f.sourceAssetId,
          destinationAssetId: f.destinationAssetId,
          dataCategories: f.dataCategories,
          frequency: f.frequency,
          isAutoGenerated: meta?.autoGenerated === true,
        };
      }),
      activities.map((a) => ({
        id: a.id,
        name: a.name,
        assetIds: a.assets.map((l) => l.dataAssetId),
      })),
      { productionOnly: true, maxNodesPerBatch: 60 },
      {
        unassigned: t("flowMap.clusterUnassigned"),
        overview: t("flowMap.clusterOverview"),
        moreSuffix: (count) => ` ${t("flowMap.clusterMoreSuffix", { count })}`,
      }
    );

    const flowBatches: FlowPageBatch[] = await Promise.all(
      flowResult.batches.map(async (b) => {
        const graph =
          b.edges.length > 0
            ? await renderFlowGraphPng(b.assets, b.edges, {
                rankdir: "LR",
                clusters: b.clusters.length > 0 ? b.clusters : undefined,
                fitWidth: 720,
              })
            : null;
        const assetTypes = [...new Set(b.assets.map((a) => a.type))];
        return { label: b.label, graph, assetTypes };
      })
    );
    // Drop batches with no rendered graph
    const nonEmptyBatches = flowBatches.filter((b) => b.graph !== null);

    const orgName = membership.organization.name;
    const dateStr = fmtDate(now);

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: membership.userId,
        entityType: "Organization",
        entityId: organizationId,
        action: "EXPORT_PRIVACY_PROGRAM",
        changes: {
          assetCount: input.assets.length,
          activityCount: input.activities.length,
          vendorCount: input.vendors.length,
          aiSystemCount: input.aiSystems.length,
        },
      },
    });

    const buffer = await renderToBuffer(
      PrivacyProgramDocument({
        orgName,
        date: dateStr,
        input,
        t,
        tCommon,
        tEnum,
        locale: resolvedLocale,
        flowBatches: nonEmptyBatches,
        flowOriginalCount: flowResult.originalAssetCount,
        flowFilteredCount: flowResult.filteredAssetCount,
        flowOrphansDropped: flowResult.orphansDropped,
      })
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Privacy-Program-${orgName.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}.pdf"`,
      },
    });
  } catch (err) {
    return pdfErrorResponse(err, "privacy-program");
  }
}
