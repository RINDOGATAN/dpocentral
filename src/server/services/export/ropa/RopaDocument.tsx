import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
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
import type { PdfT } from "../privacy-program/data-mapping";
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
  t,
  tEnum,
}: {
  index: number;
  entry: ROPAEntry;
  t: PdfT;
  tEnum: PdfT;
}) {
  const validation = validateROPAEntry(entry);
  const admDetail = entry.automatedDecisionMaking
    ? t("activity.automatedYes", {
        detail: entry.automatedDecisionDetail ?? t("activity.automatedNoDetails"),
      })
    : t("activity.automatedNo");

  const legalBasisLabel = (() => {
    const translated = tEnum(`legalBasis.${entry.legalBasis}`);
    return entry.legalBasisDetail
      ? `${translated} — ${entry.legalBasisDetail}`
      : translated;
  })();

  const metaItems: Array<{ label: string; value: string | null | undefined }> = [
    { label: t("activity.purpose"), value: entry.purpose },
    { label: t("activity.legalBasis"), value: legalBasisLabel },
    { label: t("activity.dataSubjects"), value: entry.dataSubjects.join(", ") || undefined },
    {
      label: t("activity.dataCategories"),
      value:
        entry.dataCategories.map((c) => tEnum(`dataCategory.${c}`)).join(", ") || undefined,
    },
    { label: t("activity.recipients"), value: entry.recipients.join(", ") || undefined },
    { label: t("activity.retentionPeriod"), value: entry.retentionPeriod },
    { label: t("activity.automatedDecisions"), value: admDetail },
    { label: t("activity.lastReviewed"), value: fmtDate(entry.lastReviewed) },
    { label: t("activity.nextReview"), value: fmtDate(entry.nextReview) },
  ].filter((i) => i.value);

  return (
    <View style={s.activityBlock}>
      <View style={s.activityHeader} wrap={false}>
        <Text style={s.activityNumber}>#{String(index).padStart(2, "0")}</Text>
        <Text style={s.activityName}>{entry.name}</Text>
        {!validation.isValid && (
          <PillBadge tone="warning" uppercase>{t("incomplete")}</PillBadge>
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
          category={t("activity.systems")}
          columns={[
            { header: t("activity.systemsColumns.system"), width: 2 },
            { header: t("activity.systemsColumns.type"), width: 1 },
            { header: t("activity.systemsColumns.location"), width: 1.2 },
            { header: t("activity.systemsColumns.elements"), width: 3 },
          ]}
          rows={entry.systems.map((sys) => [
            sys.name,
            tEnum(`assetType.${sys.type}`),
            sys.location ?? "—",
            sys.elements.map((e) => e.name).join(", ") || "—",
          ])}
        />
      )}

      {entry.transfers.length > 0 && (
        <CategoryTable
          category={t("activity.transfers")}
          columns={[
            { header: t("activity.transfersColumns.destination"), width: 1.3 },
            { header: t("activity.transfersColumns.organization"), width: 2 },
            { header: t("activity.transfersColumns.mechanism"), width: 2 },
            { header: t("activity.transfersColumns.safeguards"), width: 2 },
          ]}
          rows={entry.transfers.map((tr) => [
            tr.destination,
            tr.organization ?? "—",
            tr.mechanism ?? "—",
            tr.safeguards ?? "—",
          ])}
        />
      )}

      {validation.warnings.length > 0 &&
        validation.warnings.map((w, wi) => (
          <Text key={wi} style={s.warningText}>
            {t("activity.warningPrefix")}
            {w}
          </Text>
        ))}
    </View>
  );
}

export function RopaDocument({
  entries,
  orgName,
  flowGraph,
  t,
  tCommon,
  tEnum,
  locale,
}: {
  entries: ROPAEntry[];
  orgName: string;
  flowGraph?: RenderedFlowGraph | null;
  /** Scoped to `pdf.ropaReport` */
  t: PdfT;
  /** Scoped to `pdf.common` */
  tCommon: PdfT;
  /** Scoped to `pdf.enum` */
  tEnum: PdfT;
  /** BCP-47 locale for PDF metadata. */
  locale?: string;
}) {
  const date = new Date().toISOString().split("T")[0]!;
  const summary = generateROPASummary(entries);

  const legalBasisBars = Object.entries(summary.byLegalBasis)
    .sort((a, b) => b[1] - a[1])
    .map(([basis, count]) => ({
      label: tEnum(`legalBasis.${basis}`),
      value: count,
    }));

  return (
    <Document language={locale}>
      <CoverFrame rightEyebrow={t("coverReference")}>
        <View style={s.coverTitleBlock}>
          <Text style={s.coverTitle}>{t("coverTitle")}</Text>
          <Text style={s.coverSub}>{t("coverSubtitle")}</Text>
          <Text style={s.coverOrg}>{orgName}</Text>
          <View style={s.dateRow}>
            <Text style={s.dateText}>{date}</Text>
            <ConfidentialPill label={tCommon("confidential")} />
          </View>
        </View>

        <StatTileRow>
          <StatTile value={summary.totalActivities} label={t("stats.processingActivities")} />
          <StatTile
            value={summary.withInternationalTransfers}
            label={t("stats.intlTransfers")}
            tone={summary.withInternationalTransfers > 0 ? "info" : "neutral"}
          />
          <StatTile
            value={summary.withAutomatedDecisions}
            label={t("stats.automatedDecisions")}
            tone={summary.withAutomatedDecisions > 0 ? "warning" : "neutral"}
          />
          <StatTile
            value={summary.needingReview}
            label={t("stats.needingReview")}
            tone={summary.needingReview > 0 ? "danger" : "success"}
          />
        </StatTileRow>

        {legalBasisBars.length > 0 && (
          <>
            <Text style={s.subHeading}>{t("byLegalBasis")}</Text>
            <HorizontalBarChart rows={legalBasisBars} labelWidth={110} />
          </>
        )}
      </CoverFrame>

      {/* Optional flow map */}
      {flowGraph && (
        <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
          <SectionHeading
            title={t("dataFlowMap")}
            lead={t("dataFlowMapLead")}
            first
          />
          <FlowGraphImage graph={flowGraph} width={500} />
        </PageFrame>
      )}

      {/* Per-activity detail */}
      <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
        <SectionHeading title={t("processingActivities")} first />
        {entries.map((entry, i) => (
          <ActivityBlock key={i} index={i + 1} entry={entry} t={t} tEnum={tEnum} />
        ))}
      </PageFrame>
    </Document>
  );
}
