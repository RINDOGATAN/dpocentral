// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The breach register, as PDF or CSV. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { BreachRegisterReport, incidentsToCSV } from "@/server/services/export/breach-register";
import type { IncidentExportData } from "@/server/services/export/breach-register";
import { withDraftGapsPage } from "../draft-gaps-page";
import { CSV, PDF, nameForFile, today, type ExportArgs, type ExportFile } from "./context";

export async function buildBreachRegisterExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const format = args.format ?? "pdf";
  const t = await getTranslations({ locale, namespace: "pdf.breachRegister" });

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

  const base = `Breach-Register-${nameForFile(orgName)}-${today()}`;

  if (args.audit) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        entityType: "Incident",
        entityId: organizationId,
        action: "EXPORT_BREACH_REGISTER",
        changes: { format, count: data.length },
      },
    });
  }

  if (format === "csv") {
    return { data: incidentsToCSV(data), filename: `${base}.csv`, contentType: CSV };
  }

  const buffer = await renderToBuffer(
    withDraftGapsPage(BreachRegisterReport({ incidents: data, orgName, t, locale }), args.draftNote),
  );
  return { data: new Uint8Array(buffer), filename: `${base}.pdf`, contentType: PDF };
}
