// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  CoverPage,
  ContentPage,
  SectionTitle,
  SectionSubtitle,
  MetadataBlock,
  DataTable,
  StatCard,
  StatusBadge,
  RiskBadge,
  s,
  fmtDate,
  fmtDateTime,
} from "./pdf-styles";
import type { PdfT } from "./privacy-program/data-mapping";
import { CSV_WORDS_EN, rawCode, type CsvLabels } from "@/server/services/export/csv-labels";
import { pdfEnumLabel } from "./pdf-locale";
import { breachWindowEnd } from "@/lib/breach-window";

/** Notification statuses that mean the authority has been told. */
const NOTIFIED = ["SENT", "ACKNOWLEDGED"];

/**
 * Notification to the authority is still owed: the incident is flagged and
 * no notification to the supervisory authority (recipient DPA) has been
 * sent or acknowledged, whether or not a notification row exists yet.
 */
export function authorityNotificationOwed(inc: Pick<IncidentExportData, "notificationRequired" | "notifications">): boolean {
  return (
    inc.notificationRequired &&
    !inc.notifications.some((n) => (n.recipientType ?? "DPA") === "DPA" && NOTIFIED.includes(n.status))
  );
}

/** Owed, and the deadline (the jurisdiction's, or 72 hours from discovery) has passed. */
export function authorityNotificationOverdue(
  inc: Pick<IncidentExportData, "notificationRequired" | "notifications" | "discoveredAt" | "notificationDeadline" | "status">,
  now: Date,
): boolean {
  if (inc.status === "CLOSED" || inc.status === "FALSE_POSITIVE") return false;
  return authorityNotificationOwed(inc) && breachWindowEnd(inc).getTime() < now.getTime();
}

export interface IncidentExportData {
  id: string;
  /** Recorded in error: listed (marked in the title) but left out of the figures. */
  recordedInError?: boolean;
  publicId: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  discoveredAt: Date;
  discoveredBy: string | null;
  discoveryMethod: string | null;
  affectedRecords: number | null;
  affectedSubjects: string[];
  dataCategories: string[];
  containedAt: Date | null;
  containmentActions: string | null;
  rootCause: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  lessonsLearned: string | null;
  notificationRequired: boolean;
  notificationDeadline: Date | null;
  createdAt: Date;
  notifications: Array<{
    status: string;
    /** DPA (the supervisory authority), DATA_SUBJECT, LAW_ENFORCEMENT, INTERNAL. */
    recipientType?: string;
    notificationDate: Date | null;
    deadline?: Date | null;
    referenceNumber?: string | null;
    jurisdiction: { name: string; code: string };
  }>;
  timeline: Array<{
    title: string;
    description: string | null;
    timestamp: Date;
    user: { name: string | null } | null;
  }>;
}

export function BreachRegisterReport({
  incidents,
  orgName,
  t,
  locale,
}: {
  incidents: IncidentExportData[];
  orgName: string;
  /** Scoped to `pdf.breachRegister`. Optional — falls back to English via the default bundle. */
  t?: PdfT;
  /** BCP-47 locale code applied as PDF metadata. */
  locale?: string;
}) {
  const now = new Date();
  const date = fmtDate(now);
  const num = (n: number) => n.toLocaleString(locale?.startsWith("es") ? "es-ES" : "en-US");
  const recipient = (type: string | undefined) => {
    const key = `notificationColumns.recipientType.${type ?? "DPA"}`;
    const label = tr(key);
    return label === key ? (type ?? "DPA").replace(/_/g, " ") : label;
  };

  // English fallback so routes that haven't been migrated still render cleanly.
  const tr: PdfT =
    t ??
    ((key: string) => {
      const fallbacks: Record<string, string> = {
        "pageTitle": "Breach Register",
        "coverTitle": "Breach / Incident Register",
        "coverSubtitle": "GDPR Article 33(5)",
        "summary": "Summary",
        "stats.totalIncidents": "Total Incidents",
        "stats.critical": "Critical",
        "stats.high": "High",
        "stats.pendingNotifications": "Pending DPA Notifications",
        "byStatus": "By Status",
        "allIncidents": "All Incidents",
        "unknown": "Unknown",
        "overviewColumns.id": "ID",
        "overviewColumns.title": "Title",
        "overviewColumns.type": "Type",
        "overviewColumns.severity": "Severity",
        "overviewColumns.status": "Status",
        "overviewColumns.discovered": "Discovered",
        "overviewColumns.affectedRecords": "Affected Records",
        "statusColumns.status": "Status",
        "statusColumns.count": "Count",
        "meta.incidentId": "Incident ID",
        "meta.type": "Type",
        "meta.discovered": "Discovered",
        "meta.discoveredBy": "Discovered By",
        "meta.discoveryMethod": "Discovery Method",
        "meta.affectedRecords": "Affected Records",
        "meta.affectedSubjects": "Affected Subjects",
        "meta.dataCategories": "Data Categories",
        "meta.containedAt": "Contained At",
        "meta.resolvedAt": "Resolved At",
        "meta.notificationRequired": "DPA Notification Required",
        "meta.notificationDeadline": "Notification Deadline",
        "meta.yes": "Yes",
        "meta.no": "No",
        "overdue": "Notification deadline passed and the authority has not been notified",
        "subsections.description": "Description",
        "subsections.containmentActions": "Containment Actions",
        "subsections.rootCause": "Root Cause",
        "subsections.lessonsLearned": "Lessons Learned",
        "subsections.dpaNotifications": "DPA Notifications",
        "subsections.notifications": "Notifications",
        "subsections.resolutionNotes": "Resolution notes",
        "notificationColumns.recipient": "Recipient",
        "notificationColumns.deadline": "Deadline",
        "notificationColumns.reference": "Reference",
        "subsections.timeline": "Timeline",
        "notificationColumns.jurisdiction": "Jurisdiction",
        "notificationColumns.status": "Status",
        "notificationColumns.date": "Date",
        "timelineColumns.timestamp": "Timestamp",
        "timelineColumns.event": "Event",
        "timelineColumns.by": "By",
        "timelineSystem": "System",
      };
      return fallbacks[key] ?? key;
    });

  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let pendingNotifications = 0;

  const counted = incidents.filter((inc) => !inc.recordedInError);
  for (const inc of counted) {
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
    // Pending: flagged, and the authority not yet notified (no row yet, a
    // row still pending or drafted, or one awaiting follow-up).
    if (authorityNotificationOwed(inc)) {
      pendingNotifications++;
    }
  }

  return (
    <Document language={locale}>
      <CoverPage
        orgName={orgName}
        title={tr("coverTitle")}
        subtitle={tr("coverSubtitle")}
        date={date}
      />

      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <SectionTitle>{tr("summary")}</SectionTitle>
        <View style={s.statsGrid}>
          <StatCard value={counted.length} label={tr("stats.totalIncidents")} />
          <StatCard value={bySeverity["CRITICAL"] || 0} label={tr("stats.critical")} />
          <StatCard value={bySeverity["HIGH"] || 0} label={tr("stats.high")} />
          <StatCard value={pendingNotifications} label={tr("stats.pendingNotifications")} />
        </View>

        {Object.keys(byStatus).length > 0 && (
          <>
            <SectionSubtitle>{tr("byStatus")}</SectionSubtitle>
            <DataTable
              headers={[tr("statusColumns.status"), tr("statusColumns.count")]}
              colWidths={[3, 1]}
              rows={Object.entries(byStatus).map(([status, count]) => [
                pdfEnumLabel("incidentStatus", status),
                count,
              ])}
            />
          </>
        )}

        {/* Incident Overview Table */}
        <SectionTitle>{tr("allIncidents")}</SectionTitle>
        <DataTable
          headers={[
            tr("overviewColumns.id"),
            tr("overviewColumns.title"),
            tr("overviewColumns.type"),
            tr("overviewColumns.severity"),
            tr("overviewColumns.status"),
            tr("overviewColumns.discovered"),
            tr("overviewColumns.affectedRecords"),
          ]}
          colWidths={[1.5, 3, 1.5, 1, 1.2, 1.5, 1.2]}
          rows={incidents.map((inc) => [
            // The full reference: a cut one ("INC-2026") no longer tells incidents apart.
            inc.publicId,
            inc.title,
            pdfEnumLabel("incidentType", inc.type),
            pdfEnumLabel("incidentSeverity", inc.severity),
            pdfEnumLabel("incidentStatus", inc.status),
            fmtDate(inc.discoveredAt),
            inc.affectedRecords != null ? num(inc.affectedRecords) : tr("unknown"),
          ])}
        />

        {/* Per-incident detail */}
        {incidents.map((inc, i) => (
          <View key={inc.id}>
            <SectionTitle>
              {i + 1}. {inc.title}
            </SectionTitle>
            <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
              <RiskBadge level={inc.severity} kind="incidentSeverity" />
              <StatusBadge status={inc.status} kind="incidentStatus" />
            </View>
            {!inc.recordedInError && authorityNotificationOverdue(inc, now) && (
              <Text style={[s.paragraph, { color: "#B91C1C", fontWeight: 700 }]}>{tr("overdue")}</Text>
            )}

            <MetadataBlock
              items={[
                { label: tr("meta.incidentId"), value: inc.publicId },
                { label: tr("meta.type"), value: pdfEnumLabel("incidentType", inc.type) },
                { label: tr("meta.discovered"), value: fmtDateTime(inc.discoveredAt) },
                { label: tr("meta.discoveredBy"), value: inc.discoveredBy },
                { label: tr("meta.discoveryMethod"), value: inc.discoveryMethod },
                {
                  label: tr("meta.affectedRecords"),
                  value: inc.affectedRecords != null ? num(inc.affectedRecords) : tr("unknown"),
                },
                { label: tr("meta.affectedSubjects"), value: inc.affectedSubjects.join(", ") || undefined },
                {
                  label: tr("meta.dataCategories"),
                  value: inc.dataCategories.map((c) => pdfEnumLabel("dataCategory", c)).join(", ") || undefined,
                },
                { label: tr("meta.containedAt"), value: fmtDateTime(inc.containedAt) },
                { label: tr("meta.resolvedAt"), value: fmtDateTime(inc.resolvedAt) },
                {
                  label: tr("meta.notificationRequired"),
                  value: inc.notificationRequired ? tr("meta.yes") : tr("meta.no"),
                },
                { label: tr("meta.notificationDeadline"), value: fmtDateTime(inc.notificationDeadline) },
              ]}
            />

            {inc.description && (
              <>
                <SectionSubtitle>{tr("subsections.description")}</SectionSubtitle>
                <Text style={s.paragraph}>{inc.description}</Text>
              </>
            )}

            {inc.containmentActions && (
              <>
                <SectionSubtitle>{tr("subsections.containmentActions")}</SectionSubtitle>
                <Text style={s.paragraph}>{inc.containmentActions}</Text>
              </>
            )}

            {inc.rootCause && (
              <>
                <SectionSubtitle>{tr("subsections.rootCause")}</SectionSubtitle>
                <Text style={s.paragraph}>{inc.rootCause}</Text>
              </>
            )}

            {inc.resolutionNotes && (
              <>
                <SectionSubtitle>{tr("subsections.resolutionNotes")}</SectionSubtitle>
                <Text style={s.paragraph}>{inc.resolutionNotes}</Text>
              </>
            )}

            {inc.lessonsLearned && (
              <>
                <SectionSubtitle>{tr("subsections.lessonsLearned")}</SectionSubtitle>
                <Text style={s.paragraph}>{inc.lessonsLearned}</Text>
              </>
            )}

            {inc.notifications.length > 0 && (
              <>
                {/* Authority and data-subject notifications together, each row
                    saying who it is addressed to. */}
                <SectionSubtitle>{tr("subsections.notifications")}</SectionSubtitle>
                <DataTable
                  headers={[
                    tr("notificationColumns.recipient"),
                    tr("notificationColumns.jurisdiction"),
                    tr("notificationColumns.status"),
                    tr("notificationColumns.deadline"),
                    tr("notificationColumns.date"),
                    tr("notificationColumns.reference"),
                  ]}
                  colWidths={[1.6, 2, 1.2, 1.4, 1.2, 1.2]}
                  rows={inc.notifications.map((n) => [
                    recipient(n.recipientType),
                    `${n.jurisdiction.name} (${n.jurisdiction.code})`,
                    pdfEnumLabel("notificationStatus", n.status),
                    fmtDateTime(n.deadline ?? null),
                    fmtDate(n.notificationDate),
                    n.referenceNumber ?? "",
                  ])}
                />
              </>
            )}

            {inc.timeline.length > 0 && (
              <>
                <SectionSubtitle>{tr("subsections.timeline")}</SectionSubtitle>
                <DataTable
                  headers={[
                    tr("timelineColumns.timestamp"),
                    tr("timelineColumns.event"),
                    tr("timelineColumns.by"),
                  ]}
                  colWidths={[1.5, 3, 1.5]}
                  rows={inc.timeline.map((ev) => [
                    fmtDateTime(ev.timestamp),
                    `${ev.title}${ev.description ? `: ${ev.description}` : ""}`,
                    ev.user?.name || tr("timelineSystem"),
                  ])}
                />
              </>
            )}

            <View style={s.divider} />
          </View>
        ))}
      </ContentPage>
    </Document>
  );
}

export const BREACH_CSV_KEYS = [
  "id",
  "title",
  "type",
  "severity",
  "status",
  "description",
  "discoveredAt",
  "discoveredBy",
  "affectedRecords",
  "affectedSubjects",
  "dataCategories",
  "containedAt",
  "rootCause",
  "resolvedAt",
  "notificationRequired",
  "notificationDeadline",
] as const;
export type BreachCsvKey = (typeof BREACH_CSV_KEYS)[number];

/** The English CSV: column names as they have always been, raw codes. */
export const BREACH_CSV_EN: CsvLabels<BreachCsvKey> = {
  headers: {
    id: "ID",
    title: "Title",
    type: "Type",
    severity: "Severity",
    status: "Status",
    description: "Description",
    discoveredAt: "Discovered At",
    discoveredBy: "Discovered By",
    affectedRecords: "Affected Records",
    affectedSubjects: "Affected Subjects",
    dataCategories: "Data Categories",
    containedAt: "Contained At",
    rootCause: "Root Cause",
    resolvedAt: "Resolved At",
    notificationRequired: "Notification Required",
    notificationDeadline: "Notification Deadline",
  },
  words: CSV_WORDS_EN,
  code: rawCode,
};

/** A cell a spreadsheet would read as a formula is prefixed with a quote (as in the audit CSV). */
function guardFormula(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function incidentsToCSV(
  incidents: IncidentExportData[],
  labels: CsvLabels<BreachCsvKey> = BREACH_CSV_EN,
): string {
  const { headers: h, words: w, code } = labels;
  const headers = BREACH_CSV_KEYS.map((k) => h[k]);

  const rows = incidents.map((inc) => [
    inc.publicId,
    inc.title,
    code("incidentType", inc.type),
    code("incidentSeverity", inc.severity),
    code("incidentStatus", inc.status),
    inc.description,
    fmtDateTime(inc.discoveredAt),
    inc.discoveredBy || "",
    inc.affectedRecords != null ? String(inc.affectedRecords) : "",
    inc.affectedSubjects.join("; "),
    inc.dataCategories.map((c) => code("dataCategory", c)).join("; "),
    fmtDateTime(inc.containedAt),
    inc.rootCause || "",
    fmtDateTime(inc.resolvedAt),
    inc.notificationRequired ? w.yes : w.no,
    fmtDateTime(inc.notificationDeadline),
  ]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${guardFormula(String(cell)).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
