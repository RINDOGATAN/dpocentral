// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The records of processing (ROPA), as PDF or CSV. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { RopaDocument } from "@/server/services/export/ropa/RopaDocument";
import { ropaToCSV } from "@/server/services/privacy/ropaGenerator";
import type { ROPAEntry } from "@/server/services/privacy/ropaGenerator";
import {
  renderFlowGraphPng,
  type PdfFlowAsset,
  type PdfFlowEdge,
  type PdfFlowCluster,
} from "@/server/services/export/flow-graph-pdf";
import { withDraftGapsPage } from "../draft-gaps-page";
import { CSV, PDF, nameForFile, today, type ExportArgs, type ExportFile } from "./context";

export async function buildRopaExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const format = args.format ?? "pdf";
  const [t, tCommon, tEnum] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.ropaReport" }),
    getTranslations({ locale, namespace: "pdf.common" }),
    getTranslations({ locale, namespace: "pdf.enum" }),
  ]);

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

  const dateStr = today();
  const base = `ROPA-${nameForFile(orgName)}-${dateStr}`;

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "ProcessingActivity",
        entityId: organizationId,
        action: "EXPORT_ROPA",
        changes: { format, count: entries.length },
      },
    });
  }

  if (format === "csv") {
    return { data: ropaToCSV(entries), filename: `${base}.csv`, contentType: CSV };
  }

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

  const buffer = await renderToBuffer(
    withDraftGapsPage(
      RopaDocument({ entries, orgName, flowGraph, t, tCommon, tEnum, locale }),
      args.draftNote,
    ),
  );
  return { data: new Uint8Array(buffer), filename: `${base}.pdf`, contentType: PDF };
}
