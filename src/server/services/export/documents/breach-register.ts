// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The breach register, as PDF or CSV. See ./context.ts. */

import { getTranslations } from "next-intl/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { BREACH_CSV_KEYS, BreachRegisterReport, incidentsToCSV } from "@/server/services/export/breach-register";
import type { IncidentExportData } from "@/server/services/export/breach-register";
import { csvLabelsFor } from "@/server/services/export/csv-labels-i18n";
import { withDraftGapsPage } from "../draft-gaps-page";
import { CSV, PDF, nameForFile, fileTitle, today, type ExportArgs, type ExportFile } from "./context";
import { pdfEnumLabel, withPdfLocale } from "@/server/services/export/pdf-locale";
import { parseReportedDescription, parseSystemTimelineTitle } from "@/lib/incident-timeline";
import { localizeJurisdiction } from "@/config/jurisdiction-catalog";

export async function buildBreachRegisterExport(args: ExportArgs): Promise<ExportFile> {
  const { prisma, organizationId, orgName, userId, locale } = args;
  const format = args.format ?? "pdf";
  const t = await getTranslations({ locale, namespace: "pdf.breachRegister" });
  const tp = await getTranslations({ locale, namespace: "pages.incidentDetail" });
  const tIn = await getTranslations({ locale, namespace: "pages.newIncident" });
  const enumLabel = (kind: string, value: string) =>
    withPdfLocale(locale, () => pdfEnumLabel(kind, value));
  const recipientLabel = (type: string) =>
    tp.has(`notifications.recipient.${type}` as never) ? tp(`notifications.recipient.${type}` as never) : type;
  const systemTimelineTitle = (title: string): string => {
    const parsed = parseSystemTimelineTitle(title);
    if (!parsed) return title;
    switch (parsed.kind) {
      case "statusChanged":
        return tp("timeline.system.statusChanged", { status: enumLabel("incidentStatus", parsed.status) });
      case "notificationCreated":
        return tp("timeline.system.notificationCreated", {
          recipient: recipientLabel(parsed.recipient),
          jurisdiction: parsed.jurisdiction,
        });
      case "notificationStatus":
        return tp("timeline.system.notificationStatus", {
          recipient: recipientLabel(parsed.recipient),
          status: enumLabel("notificationStatus", parsed.status),
        });
      default:
        return tp(`timeline.system.${parsed.kind}` as never);
    }
  };
  const systemTimelineDescription = (description: string): string => {
    const reported = parseReportedDescription(description);
    return reported === null ? description : tp("timeline.system.reportedBody", { title: reported });
  };

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
    recordedInError: !!inc.recordedInErrorAt,
    publicId: inc.publicId,
    // Recorded in error: kept in the register, marked in its title.
    title: inc.recordedInErrorAt ? `${t("recordedInErrorPrefix")} ${inc.title}` : inc.title,
    description: inc.description,
    type: inc.type,
    severity: inc.severity,
    status: inc.status,
    discoveredAt: inc.discoveredAt,
    discoveredBy: inc.discoveredBy,
    discoveryMethod: inc.discoveryMethod
      ? (tIn.has(`discoveryMethodOption.${inc.discoveryMethod}` as never)
          ? tIn(`discoveryMethodOption.${inc.discoveryMethod}` as never)
          : inc.discoveryMethod.replace(/_/g, " "))
      : null,
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
      recipientType: n.recipientType,
      notificationDate: n.sentAt,
      deadline: n.deadline,
      referenceNumber: n.referenceNumber,
      jurisdiction: {
        name: localizeJurisdiction({ code: n.jurisdiction.code, region: "", name: n.jurisdiction.name }, locale).name,
        code: n.jurisdiction.code,
      },
    })),
    // Entries the app writes itself are stored in English: shown in the
    // report's language, as on the incident page.
    timeline: inc.timeline.map((e) => ({
      title: systemTimelineTitle(e.title),
      description: e.description ? systemTimelineDescription(e.description) : e.description,
      timestamp: e.timestamp,
      user: e.createdBy,
    })),
  }));

  const base = `${fileTitle("Breach-Register", locale)}-${nameForFile(orgName)}-${today()}`;

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
    return { data: incidentsToCSV(data, await csvLabelsFor("breaches", BREACH_CSV_KEYS, locale)), filename: `${base}.csv`, contentType: CSV };
  }

  const buffer = await withPdfLocale(locale, () => renderToBuffer(
    withDraftGapsPage(BreachRegisterReport({ incidents: data, orgName, t, locale }), args.draftNote))
  );
  return { data: new Uint8Array(buffer), filename: `${base}.pdf`, contentType: PDF };
}
