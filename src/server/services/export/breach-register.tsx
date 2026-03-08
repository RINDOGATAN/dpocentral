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
}: {
  incidents: IncidentExportData[];
  orgName: string;
}) {
  const date = fmtDate(new Date());

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
    <Document>
      <CoverPage
        orgName={orgName}
        title="Breach / Incident Register"
        subtitle="GDPR Article 33(5)"
        date={date}
      />

      <ContentPage title="Breach Register" orgName={orgName} date={date}>
        <SectionTitle>Summary</SectionTitle>
        <View style={s.statsGrid}>
          <StatCard value={incidents.length} label="Total Incidents" />
          <StatCard value={bySeverity["CRITICAL"] || 0} label="Critical" />
          <StatCard value={bySeverity["HIGH"] || 0} label="High" />
          <StatCard value={pendingNotifications} label="Pending DPA Notifications" />
        </View>

        {Object.keys(byStatus).length > 0 && (
          <>
            <SectionSubtitle>By Status</SectionSubtitle>
            <DataTable
              headers={["Status", "Count"]}
              colWidths={[3, 1]}
              rows={Object.entries(byStatus).map(([status, count]) => [
                status.replace(/_/g, " "),
                count,
              ])}
            />
          </>
        )}

        {/* Incident Overview Table */}
        <SectionTitle>All Incidents</SectionTitle>
        <DataTable
          headers={["ID", "Title", "Type", "Severity", "Status", "Discovered", "Affected Records"]}
          colWidths={[1.5, 3, 1.5, 1, 1.2, 1.5, 1.2]}
          rows={incidents.map((inc) => [
            inc.publicId.slice(0, 8),
            inc.title,
            inc.type.replace(/_/g, " "),
            inc.severity,
            inc.status.replace(/_/g, " "),
            fmtDate(inc.discoveredAt),
            inc.affectedRecords != null ? String(inc.affectedRecords) : "Unknown",
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
                { label: "Incident ID", value: inc.publicId },
                { label: "Type", value: inc.type.replace(/_/g, " ") },
                { label: "Discovered", value: fmtDateTime(inc.discoveredAt) },
                { label: "Discovered By", value: inc.discoveredBy },
                { label: "Discovery Method", value: inc.discoveryMethod },
                { label: "Affected Records", value: inc.affectedRecords != null ? String(inc.affectedRecords) : "Unknown" },
                { label: "Affected Subjects", value: inc.affectedSubjects.join(", ") || undefined },
                { label: "Data Categories", value: inc.dataCategories.join(", ") || undefined },
                { label: "Contained At", value: fmtDateTime(inc.containedAt) },
                { label: "Resolved At", value: fmtDateTime(inc.resolvedAt) },
                { label: "DPA Notification Required", value: inc.notificationRequired ? "Yes" : "No" },
                { label: "Notification Deadline", value: fmtDateTime(inc.notificationDeadline) },
              ]}
            />

            {inc.description && (
              <>
                <SectionSubtitle>Description</SectionSubtitle>
                <Text style={s.paragraph}>{inc.description}</Text>
              </>
            )}

            {inc.containmentActions && (
              <>
                <SectionSubtitle>Containment Actions</SectionSubtitle>
                <Text style={s.paragraph}>{inc.containmentActions}</Text>
              </>
            )}

            {inc.rootCause && (
              <>
                <SectionSubtitle>Root Cause</SectionSubtitle>
                <Text style={s.paragraph}>{inc.rootCause}</Text>
              </>
            )}

            {inc.lessonsLearned && (
              <>
                <SectionSubtitle>Lessons Learned</SectionSubtitle>
                <Text style={s.paragraph}>{inc.lessonsLearned}</Text>
              </>
            )}

            {inc.notifications.length > 0 && (
              <>
                <SectionSubtitle>DPA Notifications</SectionSubtitle>
                <DataTable
                  headers={["Jurisdiction", "Status", "Date"]}
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
                <SectionSubtitle>Timeline</SectionSubtitle>
                <DataTable
                  headers={["Timestamp", "Event", "By"]}
                  colWidths={[1.5, 3, 1.5]}
                  rows={inc.timeline.map((t) => [
                    fmtDateTime(t.timestamp),
                    `${t.title}${t.description ? ` — ${t.description}` : ""}`,
                    t.user?.name || "System",
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
