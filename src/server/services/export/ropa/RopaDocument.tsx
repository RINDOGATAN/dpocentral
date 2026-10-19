// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

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
import type { ROPAEntry, ROPATransfer, RopaRecordKind } from "@/server/services/privacy/ropaGenerator";
import {
  generateROPASummary,
  validateROPAEntry,
} from "@/server/services/privacy/ropaGenerator";
import type { ControllerDetails } from "./record-data";
import { controllerBlockRows, type RopaText } from "./record-text";

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
  blockText: {
    fontSize: tokens.typography.size.body,
    fontFamily: tokens.typography.family.sans,
    color: tokens.color.text.primary,
    lineHeight: tokens.typography.lineHeight.normal,
    marginBottom: tokens.space[5],
  },
  fullCell: {
    width: "100%",
    paddingRight: tokens.space[5],
    marginBottom: tokens.space[4],
  },
  controllerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: tokens.space[5],
    paddingTop: tokens.space[4],
    borderTopWidth: 0.5,
    borderTopColor: tokens.color.border.hairline,
  },
  controllerCell: {
    width: "50%",
    paddingRight: tokens.space[5],
    marginBottom: tokens.space[3],
  },
  groupHeading: {
    fontSize: tokens.typography.size.h3,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    marginTop: tokens.space[5],
    marginBottom: tokens.space[3],
  },
  warningText: {
    fontSize: tokens.typography.size.caption,
    color: tokens.color.semantic.warning.fg,
    marginTop: tokens.space[2],
  },
});

/** A table kept on one page when short, so its heading never stands alone. */
function KeepTogether({ rows, children }: { rows: number; children: React.ReactNode }) {
  return <View wrap={rows > 8}>{children}</View>;
}

function TransfersTable({ transfers, t, x }: { transfers: ROPATransfer[]; t: PdfT; x: RopaText }) {
  return (
    <KeepTogether rows={transfers.length}>
      <CategoryTable
        category={t("activity.transfers")}
        columns={[
          { header: t("activity.transfersColumns.destination"), width: 1.3 },
          { header: t("activity.transfersColumns.organization"), width: 1.7 },
          { header: t("activity.transfersColumns.mechanism"), width: 1.6 },
          { header: t("activity.transfersColumns.safeguards"), width: 2.4 },
        ]}
        rows={transfers.map((tr) => [
          x.country(tr.destination),
          tr.organization ?? "",
          x.mechanism(tr.mechanism),
          [
            tr.safeguards?.trim().replace(/\.+$/, "") || null,
            tr.tiaCompleted
              ? tr.tiaDate
                ? x.t("words.tiaOn", { date: x.date(tr.tiaDate) })
                : x.t("words.tiaDone")
              : null,
          ]
            .filter(Boolean)
            .join(". "),
        ])}
      />
    </KeepTogether>
  );
}

function ActivityBlock({
  index,
  entry,
  kind,
  t,
  tEnum,
  x,
}: {
  index: number;
  entry: ROPAEntry;
  kind: RopaRecordKind;
  t: PdfT;
  tEnum: PdfT;
  x: RopaText;
}) {
  const validation = validateROPAEntry(entry);
  const ns = x.notSpecified;
  const admDetail = entry.automatedDecisionMaking
    ? t("activity.automatedYes", {
        detail: entry.automatedDecisionDetail ?? t("activity.automatedNoDetails"),
      })
    : t("activity.automatedNo");
  const list = (v: string[]) => (v.length ? v.join(", ") : ns);

  // Every Art. 30 field is printed, saying so when it is empty.
  const metaItems: Array<{ label: string; value: string; full?: boolean }> = [
    ...(entry.description?.trim()
      ? [{ label: t("activity.description"), value: entry.description.trim(), full: true }]
      : []),
    {
      label: kind === "processor" ? t("activity.processingCategories") : t("activity.purpose"),
      value: entry.purpose || ns,
      full: true,
    },
    ...(kind === "controller"
      ? [
          { label: t("activity.legalBasis"), value: x.legalBasis(entry.legalBasis, entry.legalBasisDetail) },
          { label: t("activity.role"), value: x.role(entry.role) },
        ]
      : []),
    ...(entry.role === "JOINT_CONTROLLER"
      ? [{ label: t("activity.jointController"), value: entry.jointControllerDetails?.trim() || ns, full: true }]
      : []),
    { label: t("activity.dataSubjects"), value: list(entry.dataSubjects) },
    { label: t("activity.dataCategories"), value: list(entry.dataCategories.map(x.category)) },
    ...(kind === "controller"
      ? [
          { label: t("activity.recipients"), value: list(entry.recipients) },
          { label: t("activity.retentionPeriod"), value: x.retention(entry) ?? ns },
          { label: t("activity.automatedDecisions"), value: admDetail },
        ]
      : []),
    {
      label: t("activity.lastReviewed"),
      value: entry.lastReviewed ? x.longDate(entry.lastReviewed) : x.t("words.neverReviewed"),
    },
    ...(entry.nextReview ? [{ label: t("activity.nextReview"), value: x.longDate(entry.nextReview) }] : []),
    // Art. 30(1)(e) / 30(2)(c): say so when there is no transfer.
    ...(entry.transfers.length === 0
      ? [{ label: t("activity.transfers"), value: x.t("words.noTransfers") }]
      : []),
    {
      label: t("activity.securityMeasures"),
      value: entry.securityMeasures?.trim()
        ? entry.securityInherited
          ? t("activity.securityInherited")
          : entry.securityMeasures.trim()
        : ns,
      full: true,
    },
  ];

  return (
    <View style={s.activityBlock}>
      {/* The heading never stands alone: it keeps the first fields with it. */}
      <View wrap={false}>
        <View style={s.activityHeader}>
          <Text style={s.activityNumber}>#{String(index).padStart(2, "0")}</Text>
          <Text style={s.activityName}>{entry.name}</Text>
          {!validation.isValid && (
            <PillBadge tone="warning" uppercase>{t("incomplete")}</PillBadge>
          )}
        </View>
        <View style={s.metaGrid}>
          {metaItems.slice(0, 2).map((m, i) => (
            <View key={i} style={m.full ? s.fullCell : s.metaCell}>
              <Text style={s.metaLabel}>{m.label}</Text>
              <Text style={s.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.metaGrid}>
        {metaItems.slice(2).map((m, i) => (
          <View key={i} style={m.full ? s.fullCell : s.metaCell} wrap={false}>
            <Text style={s.metaLabel}>{m.label}</Text>
            <Text style={s.metaValue}>{m.value}</Text>
          </View>
        ))}
      </View>

      {entry.systems.length > 0 && (
        <KeepTogether rows={entry.systems.length}>
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
              sys.location ? x.country(sys.location) : "",
              sys.elements.map((e) => e.name).join(", ") || "",
            ])}
          />
        </KeepTogether>
      )}

      {entry.transfers.length > 0 && <TransfersTable transfers={entry.transfers} t={t} x={x} />}

      {validation.warnings.length > 0 &&
        validation.warnings.map((w, wi) => (
          <Text key={wi} style={s.warningText}>
            {t("activity.warningPrefix")}
            {x.warning(w)}
          </Text>
        ))}
    </View>
  );
}

function ControllerBlock({ controller, kind, x }: { controller: ControllerDetails; kind: RopaRecordKind; x: RopaText }) {
  // The cover shows identity and contacts; the measures, which can be long,
  // open the activities section.
  const rows = controllerBlockRows(controller, kind, x).slice(0, 7);
  return (
    <View style={s.controllerGrid}>
      {rows.map(([label, value], i) => (
        <View key={i} style={s.controllerCell}>
          <Text style={s.metaLabel}>{label}</Text>
          <Text style={s.metaValue}>{value}</Text>
        </View>
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
  kind = "controller",
  controller,
  unassignedTransfers = [],
  x,
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
  /** Art. 30(1) (controller) or Art. 30(2) (processor). */
  kind?: RopaRecordKind;
  controller: ControllerDetails;
  /** Active transfers not linked to an activity (controller record only). */
  unassignedTransfers?: ROPATransfer[];
  /** The record's words in the document's language. */
  x: RopaText;
}) {
  const date = x.longDate(new Date());
  const summary = generateROPASummary(entries);
  const p = kind === "processor" ? "processor." : "";

  const legalBasisBars = Object.entries(summary.byLegalBasis)
    .sort((a, b) => b[1] - a[1])
    .map(([basis, count]) => ({
      label: tEnum(`legalBasis.${basis}`),
      value: count,
    }));

  // The processor record lists the activities per controller (Art. 30(2)(a)).
  const groups: Array<{ key: string; first: ROPAEntry; items: Array<{ entry: ROPAEntry; index: number }> }> = [];
  entries.forEach((entry, i) => {
    const key = kind === "processor" ? (entry.clientControllerName?.trim() || "") : "";
    let g = groups.find((gr) => gr.key === key);
    if (!g) {
      g = { key, first: entry, items: [] };
      groups.push(g);
    }
    g.items.push({ entry, index: i + 1 });
  });

  return (
    <Document language={locale} title={t(`${p}coverTitle`)}>
      <CoverFrame rightEyebrow={t(`${p}coverReference`)}>
        <View style={s.coverTitleBlock}>
          <Text style={s.coverTitle}>{t(`${p}coverTitle`)}</Text>
          <Text style={s.coverSub}>{t(`${p}coverSubtitle`)}</Text>
          <Text style={s.coverOrg}>{orgName}</Text>
          <View style={s.dateRow}>
            <Text style={s.dateText}>{date}</Text>
            <ConfidentialPill label={tCommon("confidential")} />
          </View>
          <Text style={s.metaLabel}>{kind === "processor" ? x.t("controller.processorTitle") : x.t("controller.title")}</Text>
          <ControllerBlock controller={controller} kind={kind} x={x} />
        </View>

        <StatTileRow>
          <StatTile value={summary.totalActivities} label={t("stats.processingActivities")} />
          <StatTile
            value={summary.withInternationalTransfers}
            label={t("stats.intlTransfers")}
            tone={summary.withInternationalTransfers > 0 ? "info" : "neutral"}
          />
          <StatTile
            value={summary.incomplete}
            label={t("stats.incomplete")}
            tone={summary.incomplete > 0 ? "warning" : "success"}
          />
          <StatTile
            value={summary.needingReview}
            label={t("stats.needingReview")}
            tone={summary.needingReview > 0 ? "danger" : "success"}
          />
        </StatTileRow>

        {kind === "controller" && legalBasisBars.length > 0 && (
          <>
            <Text style={s.subHeading}>{t("byLegalBasis")}</Text>
            <HorizontalBarChart rows={legalBasisBars} labelWidth={110} />
          </>
        )}
      </CoverFrame>

      {/* Optional flow map */}
      {flowGraph && (
        <PageFrame eyebrow={t(`${p}eyebrow`)} orgName={orgName} date={date}>
          <SectionHeading
            title={t("dataFlowMap")}
            lead={t("dataFlowMapLead")}
            first
          />
          <FlowGraphImage graph={flowGraph} width={500} />
        </PageFrame>
      )}

      {/* Per-activity detail */}
      <PageFrame eyebrow={t(`${p}eyebrow`)} orgName={orgName} date={date}>
        <SectionHeading title={t("securityTitle")} lead={t("securityLead")} first />
        <Text style={s.blockText}>{controller.securityMeasures ?? x.notSpecified}</Text>

        <SectionHeading title={kind === "processor" ? t("processor.activities") : t("processingActivities")} />
        {entries.length === 0 && <Text style={s.blockText}>{t(`${p}empty`)}</Text>}
        {groups.map((g, gi) => (
          <View key={gi}>
            {kind === "processor" && (
              <View wrap={false} minPresenceAhead={120}>
                <Text style={s.groupHeading}>{g.key || x.notSpecified}</Text>
                <View style={s.metaGrid}>
                  {[
                    [x.t("columns.clientControllerContact"), g.first.clientControllerContact?.trim() || x.notSpecified],
                    [x.t("columns.clientRepresentative"), g.first.clientRepresentative?.trim() || x.t("words.notDesignated")],
                    [x.t("columns.clientDpo"), g.first.clientDpo?.trim() || x.t("words.notDesignated")],
                  ].map(([label, value], i) => (
                    <View key={i} style={s.metaCell}>
                      <Text style={s.metaLabel}>{label}</Text>
                      <Text style={s.metaValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {g.items.map(({ entry, index }) => (
              <ActivityBlock key={index} index={index} entry={entry} kind={kind} t={t} tEnum={tEnum} x={x} />
            ))}
          </View>
        ))}

        {unassignedTransfers.length > 0 && (
          <View>
            <SectionHeading title={t("unassignedTransfers")} lead={t("unassignedTransfersLead")} />
            <TransfersTable transfers={unassignedTransfers} t={t} x={x} />
          </View>
        )}
      </PageFrame>
    </Document>
  );
}

