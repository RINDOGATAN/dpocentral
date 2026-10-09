// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report PDF (owner's decision d12). See ./context.ts. The period
 * is the one asked for, or the last full quarter (the default, and what the
 * document pack holds).
 */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { presetPeriod, type BoardPeriod } from "@/lib/board-report";
import { boardReportText } from "@/lib/board-report-text";
import { fileSlug } from "@/lib/document-pack";
import { loadBoardReport } from "@/server/services/program/board-report";
import { BoardReportDocument } from "../board-report";
import { withDraftGapsPage } from "../draft-gaps-page";
import { PDF, type ExportArgs, type ExportFile } from "./context";

export async function buildBoardReportExport(args: ExportArgs & { period?: BoardPeriod }): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const now = new Date();
  const period = args.period ?? presetPeriod("lastQuarter", now);
  const [board, guided, register, views] = await Promise.all([
    getTranslations({ locale, namespace: "boardReport" }),
    getTranslations({ locale, namespace: "guided" }),
    getTranslations({ locale, namespace: "documentRegister" }),
    getTranslations({ locale, namespace: "views" }),
  ]);
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });

  const report = await loadBoardReport(prisma, {
    organizationId,
    organizationName: orgName,
    period,
    member: { role: membership?.role ?? null, userId },
    now,
  });
  const text = boardReportText(report, { board, guided, register, views }, locale);

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "Organization",
        entityId: organizationId,
        action: "EXPORT_BOARD_REPORT",
        changes: { format: "pdf", locale, from: period.from, to: period.to },
      },
    });
  }

  const buffer = await renderToBuffer(
    withDraftGapsPage(
      BoardReportDocument({
        text,
        locale,
        pageLabel: (page, total) => board("pdf.page", { page, total }),
        preparedWith: board("pdf.preparedWith"),
      }),
      args.draftNote,
    ),
  );
  return {
    data: new Uint8Array(buffer),
    filename: `${board("pdf.fileTitle")}-${fileSlug(orgName)}-${period.from}-${period.to}.pdf`,
    contentType: PDF,
  };
}
