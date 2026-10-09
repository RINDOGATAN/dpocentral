// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The privacy programme report PDF. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { PrivacyProgramDocument } from "@/server/services/export/privacy-program/PrivacyProgramDocument";
import type { ProgramInput } from "@/server/services/export/privacy-program/data-mapping";
import { buildFlowGraphInputs } from "@/server/services/export/privacy-program/flow-input";
import type { FlowPageBatch } from "@/server/services/export/privacy-program/pages/DataFlowPage";
import { renderFlowGraphPng } from "@/server/services/export/flow-graph-pdf";
import { isDsarModuleEnabled } from "@/config/features";
import { withDraftGapsPage } from "../draft-gaps-page";
import { PDF, nameForFile, type ExportArgs, type ExportFile } from "./context";

export async function buildPrivacyProgramExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const [t, tCommon, tEnum] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.privacyProgram" }),
    getTranslations({ locale, namespace: "pdf.common" }),
    getTranslations({ locale, namespace: "pdf.enum" }),
  ]);

  const now = new Date();
  const dsarOn = isDsarModuleEnabled();

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
    // No rights-request figures when the module is off.
    dsarOn
      ? prisma.dSARRequest.count({
          where: {
            organizationId,
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          },
        })
      : 0,
    dsarOn
      ? prisma.dSARRequest.count({
          where: {
            organizationId,
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
            dueDate: { lt: now },
          },
        })
      : 0,
    dsarOn
      ? prisma.dSARRequest.findMany({
          where: { organizationId, status: "COMPLETED" },
          select: { dueDate: true, updatedAt: true },
        })
      : [],
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
    dsarModule: dsarOn,
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

  const dateStr = now.toISOString().split("T")[0]!;

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
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
  }

  const buffer = await renderToBuffer(
    withDraftGapsPage(
      PrivacyProgramDocument({
        orgName,
        date: dateStr,
        input,
        t,
        tCommon,
        tEnum,
        locale,
        flowBatches: nonEmptyBatches,
        flowOriginalCount: flowResult.originalAssetCount,
        flowFilteredCount: flowResult.filteredAssetCount,
        flowOrphansDropped: flowResult.orphansDropped,
      }),
      args.draftNote,
    ),
  );

  return {
    data: new Uint8Array(buffer),
    filename: `Privacy-Program-${nameForFile(orgName)}-${dateStr}.pdf`,
    contentType: PDF,
  };
}
