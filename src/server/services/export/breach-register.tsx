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

export interface IncidentExportData {
  id: string;
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
    notificationDate: Date | null;
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
  const date = fmtDate(new Date());

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
        "subsections.description": "Description",
        "subsections.containmentActions": "Containment Actions",
        "subsections.rootCause": "Root Cause",
        "subsections.lessonsLearned": "Lessons Learned",
        "subsections.dpaNotifications": "DPA Notifications",
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

  for (const inc of incidents) {
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
    if (
      inc.notificationRequired &&
      inc.notifications.some((n) => n.status === "PENDING" || n.status === "DRAFTED")
    ) {
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
          <StatCard value={incidents.length} label={tr("stats.totalIncidents")} />
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
                status.replace(/_/g, " "),
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
            inc.publicId.slice(0, 8),
            inc.title,
            inc.type.replace(/_/g, " "),
            inc.severity,
            inc.status.replace(/_/g, " "),
            fmtDate(inc.discoveredAt),
            inc.affectedRecords != null ? String(inc.affectedRecords) : tr("unknown"),
          ])}
        />

        {/* Per-incident detail */}
        {incidents.map((inc, i) => (
          <View key={inc.id}>
            <SectionTitle>
              {i + 1}. {inc.title}
            </SectionTitle>
            <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
              <RiskBadge level={inc.severity} />
              <StatusBadge status={inc.status} />
            </View>

            <MetadataBlock
              items={[
                { label: tr("meta.incidentId"), value: inc.publicId },
                { label: tr("meta.type"), value: inc.type.replace(/_/g, " ") },
                { label: tr("meta.discovered"), value: fmtDateTime(inc.discoveredAt) },
                { label: tr("meta.discoveredBy"), value: inc.discoveredBy },
                { label: tr("meta.discoveryMethod"), value: inc.discoveryMethod },
                {
                  label: tr("meta.affectedRecords"),
                  value: inc.affectedRecords != null ? String(inc.affectedRecords) : tr("unknown"),
                },
                { label: tr("meta.affectedSubjects"), value: inc.affectedSubjects.join(", ") || undefined },
                { label: tr("meta.dataCategories"), value: inc.dataCategories.join(", ") || undefined },
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

            {inc.lessonsLearned && (
              <>
                <SectionSubtitle>{tr("subsections.lessonsLearned")}</SectionSubtitle>
                <Text style={s.paragraph}>{inc.lessonsLearned}</Text>
              </>
            )}

            {inc.notifications.length > 0 && (
              <>
                <SectionSubtitle>{tr("subsections.dpaNotifications")}</SectionSubtitle>
                <DataTable
                  headers={[
                    tr("notificationColumns.jurisdiction"),
                    tr("notificationColumns.status"),
                    tr("notificationColumns.date"),
                  ]}
                  colWidths={[2, 1.5, 1.5]}
                  rows={inc.notifications.map((n) => [
                    `${n.jurisdiction.name} (${n.jurisdiction.code})`,
                    n.status.replace(/_/g, " "),
                    fmtDate(n.notificationDate),
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
                    `${ev.title}${ev.description ? ` — ${ev.description}` : ""}`,
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

export function incidentsToCSV(incidents: IncidentExportData[]): string {
  const headers = [
    "ID",
    "Title",
    "Type",
    "Severity",
    "Status",
    "Description",
    "Discovered At",
    "Discovered By",
    "Affected Records",
    "Affected Subjects",
    "Data Categories",
    "Contained At",
    "Root Cause",
    "Resolved At",
    "Notification Required",
    "Notification Deadline",
  ];

  const rows = incidents.map((inc) => [
    inc.publicId,
    inc.title,
    inc.type,
    inc.severity,
    inc.status,
    inc.description,
    fmtDateTime(inc.discoveredAt),
    inc.discoveredBy || "",
    inc.affectedRecords != null ? String(inc.affectedRecords) : "",
    inc.affectedSubjects.join("; "),
    inc.dataCategories.join("; "),
    fmtDateTime(inc.containedAt),
    inc.rootCause || "",
    fmtDateTime(inc.resolvedAt),
    inc.notificationRequired ? "Yes" : "No",
    fmtDateTime(inc.notificationDeadline),
  ]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
