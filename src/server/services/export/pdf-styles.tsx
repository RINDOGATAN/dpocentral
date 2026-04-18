import React from "react";
import path from "node:path";
import { Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

// ── Register Inter font family ────────────────────────────────────────
const fontsDir = path.join(process.cwd(), "src/server/services/export/fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontsDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Inter-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontsDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontsDir, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

// Disable word hyphenation for cleaner text layout
Font.registerHyphenationCallback((word) => [word]);

const PRIMARY = "#53aecc";
const DARK = "#1a1a1a";
const MUTED = "#666666";
const LIGHT_BG = "#f5f5f5";
const BORDER = "#e0e0e0";
const WHITE = "#ffffff";

/** Exported color constants for use in report files */
export const PDF_COLORS = { PRIMARY, DARK, MUTED, LIGHT_BG, BORDER, WHITE } as const;

export const s = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontSize: 9,
    fontFamily: "Inter",
    color: DARK,
  },
  // Cover page
  coverPage: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Inter",
    color: DARK,
  },
  coverOrgName: {
    fontSize: 11,
    fontFamily: "Inter", fontWeight: 500,
    color: MUTED,
    marginBottom: 36,
    textTransform: "uppercase" as const,
    letterSpacing: 3,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Inter", fontWeight: 700,
    color: DARK,
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  coverSubtitle: {
    fontSize: 13,
    fontFamily: "Inter", fontWeight: 500,
    color: PRIMARY,
    textAlign: "center",
    marginBottom: 48,
    letterSpacing: 0.5,
  },
  coverRule: {
    width: 60,
    height: 2,
    backgroundColor: PRIMARY,
    marginBottom: 24,
  },
  coverDate: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 500,
    color: MUTED,
    letterSpacing: 0.5,
  },
  coverConfidential: {
    fontSize: 8,
    color: MUTED,
    marginTop: 72,
    textAlign: "center",
    paddingHorizontal: 60,
    lineHeight: 1.6,
  },
  coverFooterBand: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: PRIMARY,
  },
  coverFooterText: {
    position: "absolute" as const,
    bottom: 18,
    left: 60,
    right: 60,
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
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
    fontFamily: "Inter", fontWeight: 700,
    color: DARK,
    marginBottom: 10,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: "Inter", fontWeight: 700,
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
    fontFamily: "Inter", fontWeight: 700,
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
    fontFamily: "Inter", fontWeight: 700,
    color: MUTED,
    width: 140,
  },
  metaValue: {
    fontSize: 9,
    color: DARK,
    flex: 1,
  },
  // Two-column metadata
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  metaCell: {
    width: "50%",
    paddingRight: 12,
    marginBottom: 6,
  },
  metaCellLabel: {
    fontSize: 7,
    fontFamily: "Inter", fontWeight: 600,
    color: MUTED,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  metaCellValue: {
    fontSize: 9,
    fontFamily: "Inter", fontWeight: 500,
    color: DARK,
  },
  // Section divider with accent label
  sectionDivider: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 24,
    marginBottom: 14,
  },
  sectionDividerNumber: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 700,
    color: WHITE,
    backgroundColor: PRIMARY,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 10,
    letterSpacing: 0.5,
  },
  sectionDividerLabel: {
    fontSize: 9,
    fontFamily: "Inter", fontWeight: 600,
    color: DARK,
    textTransform: "uppercase" as const,
    letterSpacing: 1.6,
    marginRight: 10,
  },
  sectionDividerRule: {
    height: 0.5,
    backgroundColor: BORDER,
    flex: 1,
  },
  // Badge
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: "Inter", fontWeight: 700,
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
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    overflow: "hidden" as const,
    backgroundColor: WHITE,
  },
  statCardAccent: {
    height: 3,
    backgroundColor: PRIMARY,
  },
  statCardBody: {
    padding: 10,
    alignItems: "flex-start" as const,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter", fontWeight: 700,
    color: DARK,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 7,
    fontFamily: "Inter", fontWeight: 600,
    color: MUTED,
    marginTop: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  // Attention callout
  attentionBox: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#d97706",
    padding: 12,
    marginBottom: 16,
  },
  attentionBoxDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    padding: 12,
    marginBottom: 16,
  },
  attentionTitle: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 700,
    color: "#92400e",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  attentionTitleDanger: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 700,
    color: "#991b1b",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  attentionItem: {
    fontSize: 9,
    color: DARK,
    marginBottom: 3,
    lineHeight: 1.5,
  },
  // Lead text under section titles
  leadText: {
    fontSize: 9,
    fontFamily: "Inter", fontWeight: 500,
    color: MUTED,
    lineHeight: 1.5,
    marginTop: -6,
    marginBottom: 10,
  },
  // Asset distribution bar
  distBarTrack: {
    flexDirection: "row" as const,
    height: 14,
    borderRadius: 3,
    overflow: "hidden" as const,
    marginBottom: 10,
  },
  distLegend: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    marginBottom: 14,
  },
  distLegendItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginRight: 14,
    marginBottom: 4,
  },
  distLegendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    marginRight: 5,
  },
  distLegendLabel: {
    fontSize: 7,
    fontFamily: "Inter", fontWeight: 500,
    color: DARK,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  distLegendCount: {
    fontSize: 7,
    color: MUTED,
    marginLeft: 3,
  },
  // Inline badge for table cells
  tableBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 6.5,
    fontFamily: "Inter", fontWeight: 700,
    letterSpacing: 0.4,
    alignSelf: "flex-start" as const,
  },
  // Cover stripe
  coverStripe: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: PRIMARY,
  },
  // Content-page accent stripe (thinner, for non-cover pages)
  contentStripe: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: PRIMARY,
  },
  // Table of Contents
  tocEntry: {
    flexDirection: "row" as const,
    alignItems: "baseline" as const,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tocSection: {
    fontSize: 10,
    color: DARK,
  },
  tocDots: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  // Per-asset card
  assetCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    marginBottom: 14,
  },
  assetCardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    backgroundColor: LIGHT_BG,
  },
  assetCardBody: {
    padding: 10,
  },
  assetCardTitle: {
    fontSize: 11,
    fontFamily: "Inter", fontWeight: 700,
    color: DARK,
  },
  // Type badge (colour-coded inline pill)
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: "Inter", fontWeight: 700,
  },
  // Executive summary
  executiveSummary: {
    fontSize: 9,
    lineHeight: 1.6,
    color: DARK,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  // Assessment section header with left accent
  sectionHeader: {
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
    paddingLeft: 10,
    marginBottom: 12,
    marginTop: 8,
  },
  // Question cards
  questionCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  questionCardUnanswered: {
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed" as const,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  questionNumber: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 700,
    color: PRIMARY,
    marginRight: 4,
  },
  questionText: {
    fontSize: 10,
    fontFamily: "Inter", fontWeight: 700,
    color: DARK,
    flex: 1,
  },
  answerText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: DARK,
    marginTop: 4,
  },
  notesText: {
    fontSize: 8,
    lineHeight: 1.4,
    color: MUTED,
    marginTop: 4,
  },
  requiredTag: {
    fontSize: 6,
    fontFamily: "Inter", fontWeight: 700,
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 6,
  },
  // Callout box (GDPR reference)
  calloutBox: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 4,
    padding: 12,
    marginVertical: 12,
  },
  calloutTitle: {
    fontSize: 9,
    fontFamily: "Inter", fontWeight: 700,
    color: "#0369a1",
    marginBottom: 6,
  },
  calloutText: {
    fontSize: 8,
    lineHeight: 1.5,
    color: "#0c4a6e",
  },
  // Progress bar
  progressBarOuter: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginBottom: 16,
  },
  progressBarInner: {
    height: 8,
    backgroundColor: PRIMARY,
    borderRadius: 4,
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

const ASSET_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  APPLICATION:   { bg: "#cce8f1", color: "#0c3845" },
  CLOUD_SERVICE: { bg: "#dbeafe", color: "#1e3a8a" },
  DATABASE:      { bg: "#e0e7ff", color: "#312e81" },
  FILE_SYSTEM:   { bg: "#f3f4f6", color: "#1f2937" },
  THIRD_PARTY:   { bg: "#fef3c7", color: "#78350f" },
  PHYSICAL:      { bg: "#e7e5e4", color: "#292524" },
  OTHER:         { bg: "#f1f5f9", color: "#0f172a" },
};

export { ASSET_TYPE_COLORS };

export function AssetTypeBadge({ type }: { type: string }) {
  const colors = ASSET_TYPE_COLORS[type] ?? ASSET_TYPE_COLORS.OTHER!;
  return (
    <Text style={[s.typeBadge, { backgroundColor: colors.bg, color: colors.color }]}>
      {type.replace(/_/g, " ")}
    </Text>
  );
}

export function CoverPage({
  orgName,
  title,
  subtitle,
  date,
  reference,
}: {
  orgName: string;
  title: string;
  subtitle?: string;
  date: string;
  reference?: string;
}) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverStripe} />
      <Text style={s.coverOrgName}>{orgName}</Text>
      <View style={s.coverRule} />
      <Text style={s.coverTitle}>{title}</Text>
      {subtitle && <Text style={s.coverSubtitle}>{subtitle}</Text>}
      <Text style={s.coverDate}>Generated {date}</Text>
      <Text style={s.coverConfidential}>
        CONFIDENTIAL — This document contains sensitive information about data
        protection practices. Distribution should be limited to authorized
        personnel and supervisory authorities upon request.
      </Text>
      <View style={s.coverFooterText}>
        <Text>DPO Central Privacy Suite</Text>
        {reference && <Text>{reference}</Text>}
      </View>
      <View style={s.coverFooterBand} />
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
  accentStripe = false,
}: {
  title: string;
  orgName: string;
  date: string;
  children: React.ReactNode;
  accentStripe?: boolean;
}) {
  return (
    <Page size="A4" style={s.page} wrap>
      {accentStripe && <View style={s.contentStripe} fixed />}
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

export function MetadataBlock2Col({
  items,
}: {
  items: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  const filtered = items.filter(
    (item) => item.value !== null && item.value !== undefined && item.value !== ""
  );
  return (
    <View style={s.metaGrid}>
      {filtered.map((item, i) => (
        <View key={i} style={s.metaCell}>
          <Text style={s.metaCellLabel}>{item.label}</Text>
          <Text style={s.metaCellValue}>{String(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function SectionDivider({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <View style={s.sectionDivider}>
      <Text style={s.sectionDividerNumber}>{number}</Text>
      <Text style={s.sectionDividerLabel}>{label}</Text>
      <View style={s.sectionDividerRule} />
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
          <Text style={[s.tableCell, { flex: 1, color: MUTED,  }]}>
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

export type StatTone = "default" | "warning" | "danger" | "success" | "muted";

const STAT_TONE_COLORS: Record<StatTone, { accent: string; value: string }> = {
  default: { accent: PRIMARY, value: DARK },
  warning: { accent: "#d97706", value: "#92400e" },
  danger: { accent: "#dc2626", value: "#991b1b" },
  success: { accent: "#059669", value: "#065f46" },
  muted: { accent: "#9ca3af", value: MUTED },
};

export function StatCard({
  value,
  label,
  tone = "default",
}: {
  value: string | number;
  label: string;
  tone?: StatTone;
}) {
  const colors = STAT_TONE_COLORS[tone];
  return (
    <View style={s.statCard}>
      <View style={[s.statCardAccent, { backgroundColor: colors.accent }]} />
      <View style={s.statCardBody}>
        <Text style={[s.statValue, { color: colors.value }]}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

export function AttentionCallout({
  items,
  tone = "warning",
  title,
}: {
  items: string[];
  tone?: "warning" | "danger";
  title?: string;
}) {
  if (items.length === 0) return null;
  const boxStyle = tone === "danger" ? s.attentionBoxDanger : s.attentionBox;
  const titleStyle = tone === "danger" ? s.attentionTitleDanger : s.attentionTitle;
  const defaultTitle = tone === "danger" ? "Action Required" : "Attention Required";
  return (
    <View style={boxStyle} wrap={false}>
      <Text style={titleStyle}>{title ?? defaultTitle}</Text>
      {items.map((item, i) => (
        <Text key={i} style={s.attentionItem}>• {item}</Text>
      ))}
    </View>
  );
}

export function LeadText({ children }: { children: React.ReactNode }) {
  return <Text style={s.leadText}>{children}</Text>;
}

export function DistributionBar({
  segments,
  totalLabel,
}: {
  segments: Array<{ label: string; count: number; color: string }>;
  totalLabel?: string;
}) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  if (total === 0) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={s.distBarTrack}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </View>
      <View style={s.distLegend}>
        {segments.map((seg, i) => (
          <View key={i} style={s.distLegendItem}>
            <View style={[s.distLegendSwatch, { backgroundColor: seg.color }]} />
            <Text style={s.distLegendLabel}>{seg.label}</Text>
            <Text style={s.distLegendCount}>({seg.count})</Text>
          </View>
        ))}
        {totalLabel && (
          <Text style={[s.distLegendCount, { marginLeft: "auto" }]}>
            {totalLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

const RISK_SWATCH: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
};

export function InlineRiskDot({ level }: { level: string | null | undefined }) {
  if (!level) return <Text style={{ fontSize: 8, color: MUTED }}>—</Text>;
  const color = RISK_SWATCH[level] || "#9ca3af";
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: color,
          marginRight: 5,
        }}
      />
      <Text style={{ fontSize: 8, fontFamily: "Inter", fontWeight: 600, color: DARK }}>
        {level}
      </Text>
    </View>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={s.progressBarOuter}>
      <View style={[s.progressBarInner, { width: `${clamped}%` }]} />
    </View>
  );
}

export function AccentSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={{ fontSize: 13, fontFamily: "Inter", fontWeight: 700, color: DARK }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 9, color: MUTED, marginTop: 3 }}>
          {description}
        </Text>
      )}
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
