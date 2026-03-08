import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const PRIMARY = "#53aecc";
const DARK = "#1a1a1a";
const MUTED = "#666666";
const LIGHT_BG = "#f5f5f5";
const BORDER = "#e0e0e0";
const WHITE = "#ffffff";

export const s = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: DARK,
  },
  // Cover page
  coverPage: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Helvetica",
    color: DARK,
  },
  coverOrgName: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 40,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textAlign: "center",
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 14,
    color: PRIMARY,
    textAlign: "center",
    marginBottom: 40,
  },
  coverDate: {
    fontSize: 11,
    color: MUTED,
  },
  coverConfidential: {
    fontSize: 9,
    color: MUTED,
    marginTop: 60,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  // Page header
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 8,
    marginBottom: 16,
    fontSize: 8,
    color: MUTED,
  },
  // Page footer
  pageFooter: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  // Section
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 10,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 6,
    marginTop: 12,
  },
  // Table
  table: {
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    backgroundColor: LIGHT_BG,
  },
  tableCell: {
    fontSize: 8,
    paddingHorizontal: 4,
    color: DARK,
  },
  // Metadata
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    width: 140,
  },
  metaValue: {
    fontSize: 9,
    color: DARK,
    flex: 1,
  },
  // Badge
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  // Card
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  // Misc
  paragraph: {
    fontSize: 9,
    lineHeight: 1.5,
    color: DARK,
    marginBottom: 8,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: PRIMARY,
  },
  statLabel: {
    fontSize: 7,
    color: MUTED,
    marginTop: 2,
    textTransform: "uppercase" as const,
  },
});

const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  LOW: { bg: "#dcfce7", color: "#166534" },
  MEDIUM: { bg: "#fef9c3", color: "#854d0e" },
  HIGH: { bg: "#fed7aa", color: "#9a3412" },
  CRITICAL: { bg: "#fecaca", color: "#991b1b" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  APPROVED: { bg: "#dcfce7", color: "#166534" },
  ACTIVE: { bg: "#dcfce7", color: "#166534" },
  COMPLETED: { bg: "#dcfce7", color: "#166534" },
  CLOSED: { bg: "#e5e7eb", color: "#374151" },
  IN_PROGRESS: { bg: "#dbeafe", color: "#1e40af" },
  INVESTIGATING: { bg: "#dbeafe", color: "#1e40af" },
  PENDING_REVIEW: { bg: "#fef9c3", color: "#854d0e" },
  PENDING_APPROVAL: { bg: "#fef9c3", color: "#854d0e" },
  PENDING: { bg: "#fef9c3", color: "#854d0e" },
  DRAFT: { bg: "#e5e7eb", color: "#374151" },
  REPORTED: { bg: "#fed7aa", color: "#9a3412" },
  REJECTED: { bg: "#fecaca", color: "#991b1b" },
  CONTAINED: { bg: "#dbeafe", color: "#1e40af" },
  UNDER_REVIEW: { bg: "#fef9c3", color: "#854d0e" },
  SUSPENDED: { bg: "#fecaca", color: "#991b1b" },
  TERMINATED: { bg: "#fecaca", color: "#991b1b" },
  PROSPECTIVE: { bg: "#e5e7eb", color: "#374151" },
};

export function CoverPage({
  orgName,
  title,
  subtitle,
  date,
}: {
  orgName: string;
  title: string;
  subtitle?: string;
  date: string;
}) {
  return (
    <Page size="A4" style={s.coverPage}>
      <Text style={s.coverOrgName}>{orgName}</Text>
      <Text style={s.coverTitle}>{title}</Text>
      {subtitle && <Text style={s.coverSubtitle}>{subtitle}</Text>}
      <Text style={s.coverDate}>Generated: {date}</Text>
      <Text style={s.coverConfidential}>
        CONFIDENTIAL — This document contains sensitive information about data
        protection practices. Distribution should be limited to authorized
        personnel and supervisory authorities upon request.
      </Text>
    </Page>
  );
}

export function PageHeader({
  title,
  orgName,
}: {
  title: string;
  orgName: string;
}) {
  return (
    <View style={s.pageHeader} fixed>
      <Text>{title}</Text>
      <Text>{orgName}</Text>
    </View>
  );
}

export function PageFooter({ date }: { date: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text>Generated by DPO Central</Text>
      <Text>{date}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function ContentPage({
  title,
  orgName,
  date,
  children,
}: {
  title: string;
  orgName: string;
  date: string;
  children: React.ReactNode;
}) {
  return (
    <Page size="A4" style={s.page} wrap>
      <PageHeader title={title} orgName={orgName} />
      {children}
      <PageFooter date={date} />
    </Page>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionSubtitle}>{children}</Text>;
}

export function MetadataBlock({
  items,
}: {
  items: Array<{ label: string; value: string | null | undefined }>;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      {items
        .filter((item) => item.value)
        .map((item, i) => (
          <View key={i} style={s.metaRow}>
            <Text style={s.metaLabel}>{item.label}</Text>
            <Text style={s.metaValue}>{item.value}</Text>
          </View>
        ))}
    </View>
  );
}

export function DataTable({
  headers,
  rows,
  colWidths,
}: {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  colWidths?: number[];
}) {
  const widths = colWidths || headers.map(() => 1);
  const totalFlex = widths.reduce((a, b) => a + b, 0);

  return (
    <View style={s.table}>
      <View style={s.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text
            key={i}
            style={[s.tableHeaderCell, { flex: widths[i] / totalFlex }]}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={ri % 2 === 1 ? s.tableRowAlt : s.tableRow}>
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[s.tableCell, { flex: widths[ci] / totalFlex }]}
            >
              {cell ?? "—"}
            </Text>
          ))}
        </View>
      ))}
      {rows.length === 0 && (
        <View style={s.tableRow}>
          <Text style={[s.tableCell, { flex: 1, color: MUTED, fontStyle: "italic" }]}>
            No records
          </Text>
        </View>
      )}
    </View>
  );
}

export function RiskBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <Text style={s.badge}>—</Text>;
  const colors = RISK_COLORS[level] || { bg: "#e5e7eb", color: "#374151" };
  return (
    <Text style={[s.badge, { backgroundColor: colors.bg, color: colors.color }]}>
      {level}
    </Text>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || { bg: "#e5e7eb", color: "#374151" };
  return (
    <Text style={[s.badge, { backgroundColor: colors.bg, color: colors.color }]}>
      {status.replace(/_/g, " ")}
    </Text>
  );
}

export function StatCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.toISOString().split("T")[0]} ${date.toTimeString().slice(0, 5)}`;
}
