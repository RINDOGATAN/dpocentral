import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import "../design-system/fonts";
import {
  CoverFrame,
  PageFrame,
  SectionHeading,
  StatTile,
  StatTileRow,
  HorizontalBarChart,
  CategoryTable,
  PillBadge,
  ConfidentialPill,
  tokens,
} from "../design-system";
import { FlowGraphImage, type RenderedFlowGraph } from "../flow-graph-pdf";
import type { ROPAEntry } from "@/server/services/privacy/ropaGenerator";
import {
  generateROPASummary,
  validateROPAEntry,
} from "@/server/services/privacy/ropaGenerator";

const s = StyleSheet.create({
  coverTitleBlock: {
    marginBottom: tokens.space[7],
  },
  coverTitle: {
    fontSize: tokens.typography.size.display,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    letterSpacing: tokens.typography.letterSpacing.tight,
    lineHeight: tokens.typography.lineHeight.tight,
    marginBottom: tokens.space[3],
  },
  coverSub: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.brand.tealAccent,
    marginBottom: tokens.space[4],
  },
  coverOrg: {
    fontSize: tokens.typography.size.h2,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.secondary,
    marginBottom: tokens.space[3],
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.space[7],
  },
  dateText: {
    fontSize: tokens.typography.size.body,
    color: tokens.color.text.muted,
    fontWeight: tokens.typography.weight.medium,
    marginRight: tokens.space[5],
  },
  subHeading: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: tokens.space[3],
    marginTop: tokens.space[6],
  },
  activityBlock: {
    marginBottom: tokens.space[7],
    paddingBottom: tokens.space[5],
    borderBottomWidth: 0.5,
    borderBottomColor: tokens.color.border.hairline,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: tokens.space[4],
  },
  activityNumber: {
    fontSize: tokens.typography.size.caption,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    marginRight: tokens.space[3],
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
  activityName: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    flex: 1,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: tokens.space[5],
  },
  metaCell: {
    width: "50%",
    paddingRight: tokens.space[5],
    marginBottom: tokens.space[4],
  },
  metaLabel: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.primary,
    lineHeight: tokens.typography.lineHeight.normal,
  },
  warningText: {
    fontSize: tokens.typography.size.caption,
    color: tokens.color.semantic.warning.fg,
    marginTop: tokens.space[2],
  },
});

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().split("T")[0]!;
}

function ActivityBlock({
  index,
  entry,
}: {
  index: number;
  entry: ROPAEntry;
}) {
  const validation = validateROPAEntry(entry);
  const metaItems: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Purpose", value: entry.purpose },
    {
      label: "Legal Basis",
      value: `${entry.legalBasis.replace(/_/g, " ")}${entry.legalBasisDetail ? ` — ${entry.legalBasisDetail}` : ""}`,
    },
    { label: "Data Subjects", value: entry.dataSubjects.join(", ") || undefined },
    { label: "Data Categories", value: entry.dataCategories.join(", ") || undefined },
    { label: "Recipients", value: entry.recipients.join(", ") || undefined },
    { label: "Retention Period", value: entry.retentionPeriod },
    {
      label: "Automated Decisions",
      value: entry.automatedDecisionMaking
        ? `Yes — ${entry.automatedDecisionDetail || "No details"}`
        : "No",
    },
    { label: "Last Reviewed", value: fmtDate(entry.lastReviewed) },
    { label: "Next Review", value: fmtDate(entry.nextReview) },
  ].filter((i) => i.value);

  return (
    <View style={s.activityBlock}>
      <View style={s.activityHeader} wrap={false}>
        <Text style={s.activityNumber}>#{String(index).padStart(2, "0")}</Text>
        <Text style={s.activityName}>{entry.name}</Text>
        {!validation.isValid && (
          <PillBadge tone="warning" uppercase>INCOMPLETE</PillBadge>
        )}
      </View>

      <View style={s.metaGrid}>
        {metaItems.map((m, i) => (
          <View key={i} style={s.metaCell}>
            <Text style={s.metaLabel}>{m.label}</Text>
            <Text style={s.metaValue}>{m.value}</Text>
          </View>
        ))}
      </View>

      {entry.systems.length > 0 && (
        <CategoryTable
          category="Systems / Assets"
          columns={[
            { header: "System", width: 2 },
            { header: "Type", width: 1 },
            { header: "Location", width: 1.2 },
            { header: "Elements", width: 3 },
          ]}
          rows={entry.systems.map((sys) => [
            sys.name,
            sys.type.replace(/_/g, " "),
            sys.location ?? "—",
            sys.elements.map((e) => e.name).join(", ") || "—",
          ])}
        />
      )}

      {entry.transfers.length > 0 && (
        <CategoryTable
          category="International Transfers"
          columns={[
            { header: "Destination", width: 1.3 },
            { header: "Organization", width: 2 },
            { header: "Mechanism", width: 2 },
            { header: "Safeguards", width: 2 },
          ]}
          rows={entry.transfers.map((t) => [
            t.destination,
            t.organization ?? "—",
            t.mechanism ?? "—",
            t.safeguards ?? "—",
          ])}
        />
      )}

      {validation.warnings.length > 0 &&
        validation.warnings.map((w, wi) => (
          <Text key={wi} style={s.warningText}>
            Warning: {w}
          </Text>
        ))}
    </View>
  );
}

export function RopaDocument({
  entries,
  orgName,
  flowGraph,
}: {
  entries: ROPAEntry[];
  orgName: string;
  flowGraph?: RenderedFlowGraph | null;
}) {
  const date = new Date().toISOString().split("T")[0]!;
  const summary = generateROPASummary(entries);

  const legalBasisBars = Object.entries(summary.byLegalBasis)
    .sort((a, b) => b[1] - a[1])
    .map(([basis, count]) => ({
      label: basis.replace(/_/g, " "),
      value: count,
    }));

  return (
    <Document>
      <CoverFrame rightEyebrow="GDPR · Article 30">
        <View style={s.coverTitleBlock}>
          <Text style={s.coverTitle}>Record of Processing</Text>
          <Text style={s.coverSub}>Article 30 Register</Text>
          <Text style={s.coverOrg}>{orgName}</Text>
          <View style={s.dateRow}>
            <Text style={s.dateText}>{date}</Text>
            <ConfidentialPill />
          </View>
        </View>

        <StatTileRow>
          <StatTile value={summary.totalActivities} label="Processing Activities" />
          <StatTile
            value={summary.withInternationalTransfers}
            label="Int'l Transfers"
            tone={summary.withInternationalTransfers > 0 ? "info" : "neutral"}
          />
          <StatTile
            value={summary.withAutomatedDecisions}
            label="Automated Decisions"
            tone={summary.withAutomatedDecisions > 0 ? "warning" : "neutral"}
          />
          <StatTile
            value={summary.needingReview}
            label="Needing Review"
            tone={summary.needingReview > 0 ? "danger" : "success"}
          />
        </StatTileRow>

        {legalBasisBars.length > 0 && (
          <>
            <Text style={s.subHeading}>By Legal Basis</Text>
            <HorizontalBarChart rows={legalBasisBars} labelWidth={110} />
          </>
        )}
      </CoverFrame>

      {/* Optional flow map */}
      {flowGraph && (
        <PageFrame eyebrow="Record of Processing" orgName={orgName} date={date}>
          <SectionHeading
            title="Data Flow Map"
            lead="Each processing activity is shown as a bordered cluster containing the assets it touches. Dashed edges were auto-generated from activity-asset links; solid edges are explicit."
            first
          />
          <FlowGraphImage graph={flowGraph} width={500} />
        </PageFrame>
      )}

      {/* Per-activity detail */}
      <PageFrame eyebrow="Record of Processing" orgName={orgName} date={date}>
        <SectionHeading title="Processing Activities" first />
        {entries.map((entry, i) => (
          <ActivityBlock key={i} index={i + 1} entry={entry} />
        ))}
      </PageFrame>
    </Document>
  );
}
