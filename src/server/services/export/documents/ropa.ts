// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The record of processing activities (GDPR Art. 30) as PDF, CSV, XLSX or
 * JSON: the controller record (Art. 30(1)) or the processor record
 * (Art. 30(2)). See ./context.ts.
 */

import { isDraftFlow } from "@/server/services/data-flows/auto-flows";
import { pdfFlowLabels } from "@/server/services/export/flow-labels-pdf";
import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { RopaDocument } from "@/server/services/export/ropa/RopaDocument";
import type { RopaRecordKind } from "@/server/services/privacy/ropaGenerator";
import type { BusinessUnitScope } from "@/server/services/business-units/scope";
import { loadRopaData } from "@/server/services/export/ropa/record-data";
import { controllerBlockRows, ropaTable, ropaText, tableToCsv } from "@/server/services/export/ropa/record-text";
import { createXlsx, XLSX } from "@/lib/xlsx";
import { evaluateRegister, registerFor } from "@/config/document-register";
import { isDsarModuleEnabled } from "@/config/features";
import { loadDocumentFacts } from "@/server/services/program/document-facts";
import {
  renderFlowGraphPng,
  type PdfFlowAsset,
  type PdfFlowEdge,
  type PdfFlowCluster,
} from "@/server/services/export/flow-graph-pdf";
import { withDraftGapsPage, type DraftNote } from "../draft-gaps-page";
import { CSV, PDF, nameForFile, fileTitle, today, type ExportArgs, type ExportFile } from "./context";
import { withPdfLocale } from "@/server/services/export/pdf-locale";
import type { Locale } from "@/i18n/config";
import type { Db } from "@/lib/prisma";

export type RopaFormat = "pdf" | "csv" | "xlsx" | "json";

export interface RopaExportArgs extends Omit<ExportArgs, "format"> {
  format?: RopaFormat;
  /** Art. 30(1) (the default) or Art. 30(2). */
  kind?: RopaRecordKind;
  /** A department-limited member's scope; the whole organisation otherwise. */
  scope?: BusinessUnitScope;
}

const JSON_TYPE = "application/json; charset=utf-8";

/**
 * The draft page of the standalone record, on the same rule as the document
 * pack: while the register calls the record a draft, its first page says so
 * and lists what is outstanding.
 */
export async function ropaDraftNote(prisma: Db, organizationId: string, locale: Locale): Promise<DraftNote | null> {
  const facts = await loadDocumentFacts(prisma, organizationId);
  const doc = evaluateRegister(registerFor({ dsarEnabled: isDsarModuleEnabled() }), facts).find(
    (d) => d.id === "ropa",
  );
  if (!doc || doc.status.state !== "draft") return null;
  const gaps = doc.status.gaps;
  const [t, tr] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.documentPack" }),
    getTranslations({ locale, namespace: "documentRegister" }),
  ]);
  return {
    mark: t("draftMark"),
    title: tr("items.ropa"),
    intro: t("draftNote.intro"),
    gapsTitle: t("draftNote.gapsTitle"),
    gaps: gaps.map((g) => tr(`gaps.${g.key}` as never, { count: g.count } as never)),
    generated: t("draftNote.generated", { date: today() }),
  };
}

export async function buildRopaExport(args: RopaExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const format = args.format ?? "pdf";
  const kind = args.kind ?? "controller";
  const [t, tCommon, tEnum, x] = await Promise.all([
    getTranslations({ locale, namespace: "pdf.ropaReport" }),
    getTranslations({ locale, namespace: "pdf.common" }),
    getTranslations({ locale, namespace: "pdf.enum" }),
    ropaText(locale),
  ]);

  const scope: BusinessUnitScope = args.scope ?? { all: true };
  const data = await loadRopaData(prisma, organizationId, { kind, scope });
  const { entries, controller } = data;
  const activities = data.activities;

  const dateStr = today();
  const base = `${fileTitle(kind === "processor" ? "ROPA-Processor" : "ROPA", locale)}-${nameForFile(orgName)}-${dateStr}`;

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "ProcessingActivity",
        entityId: organizationId,
        action: "EXPORT_ROPA",
        changes: { format, record: kind, count: entries.length, ...(scope.all ? {} : { departmentScoped: true }) },
      },
    });
  }

  if (format === "csv" || format === "xlsx") {
    const table = ropaTable(kind, entries, controller, x);
    if (format === "csv") {
      return { data: tableToCsv(table, locale), filename: `${base}.csv`, contentType: CSV };
    }
    const title = t(kind === "processor" ? "processor.coverTitle" : "coverTitle");
    const blockRows = controllerBlockRows(controller, kind, x);
    const xlsx = createXlsx(
      [
        { name: x.t(kind === "processor" ? "sheets.processorRecord" : "sheets.record"), rows: [table.headers, ...table.rows], header: true },
        {
          name: x.t(kind === "processor" ? "sheets.processor" : "sheets.controller"),
          rows: [[x.t("sheets.field"), x.t("sheets.value")], ...blockRows],
          header: true,
          widths: [36, 90],
        },
      ],
      { title: `${title} · ${orgName}`, language: locale },
    );
    return { data: xlsx, filename: `${base}.xlsx`, contentType: XLSX };
  }

  if (format === "json") {
    const body = {
      record: kind,
      generatedAt: new Date().toISOString(),
      controller,
      activities: entries,
      ...(kind === "controller" && scope.all ? { unassignedTransfers: data.unassignedTransfers } : {}),
    };
    return { data: JSON.stringify(body, null, 2), filename: `${base}.json`, contentType: JSON_TYPE };
  }

  // ─── Build the per-activity cluster flow graph ───────────────────────
  // Each activity becomes a subgraph cluster containing the assets it
  // touches. Assets shared across activities are placed in the cluster
  // of the first activity (alphabetical) that references them, so the
  // graph stays readable while inter-cluster edges still show sharing.
  // Generated flows still to confirm are drafts: left out of the report.
  const flows = (
    await prisma.dataFlow.findMany({
      where: { organizationId },
      include: {
        sourceAsset: { select: { id: true, name: true, type: true } },
        destinationAsset: { select: { id: true, name: true, type: true } },
      },
    })
  ).filter((f) => !isDraftFlow(f.metadata));
  // A department-limited reader sees only flows between its own activities' systems.
  const ownAssets = new Set(activities.flatMap((a) => a.assets.map((l) => l.dataAsset.id)));
  const visibleFlows = scope.all
    ? flows
    : flows.filter((f) => ownAssets.has(f.sourceAssetId) && ownAssets.has(f.destinationAssetId));

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
  for (const f of visibleFlows) {
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

  const flowLabels = await pdfFlowLabels(locale);
  const flowEdges: PdfFlowEdge[] = visibleFlows.map((f) => {
    const meta = f.metadata as { autoGenerated?: boolean } | null;
    return {
      sourceAssetId: f.sourceAssetId,
      destinationAssetId: f.destinationAssetId,
      label: flowLabels.edgeLabel(f.dataCategories, f.frequency),
      isAutoGenerated: meta?.autoGenerated === true,
    };
  });

  const flowGraph = await renderFlowGraphPng(
    [...assetMap.values()],
    flowEdges,
    { rankdir: "LR", clusters, fitWidth: 720, typeLabel: flowLabels.typeLabel }
  );

  const buffer = await withPdfLocale(locale, () => renderToBuffer(
    withDraftGapsPage(
      RopaDocument({
        entries,
        orgName,
        flowGraph: kind === "controller" && assetMap.size > 0 ? flowGraph : null,
        t,
        tCommon,
        tEnum,
        locale,
        kind,
        controller,
        unassignedTransfers: data.unassignedTransfers,
        x,
      }),
      args.draftNote,
    ))
  );
  return { data: new Uint8Array(buffer), filename: `${base}.pdf`, contentType: PDF };
}
