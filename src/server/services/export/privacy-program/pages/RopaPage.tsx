import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  PageFrame,
  SectionHeading,
  HorizontalBarChart,
  StatTile,
  StatTileRow,
  CategoryTable,
  PillBadge,
  tokens,
} from "../../design-system";
import {
  computeLegalBasisBars,
  computeRopaStats,
  type ProgramInput,
  type PdfT,
} from "../data-mapping";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().split("T")[0]!;
}

const s = StyleSheet.create({
  twoCol: {
    flexDirection: "row",
    gap: tokens.space[7],
    marginBottom: tokens.space[6],
  },
  colLeft: {
    flex: 1.4,
  },
  colRight: {
    flex: 1,
  },
  subHeading: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: tokens.space[3],
    marginTop: tokens.space[2],
  },
});

export function RopaPage({
  orgName,
  date,
  input,
  t,
  tEnum,
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
  t: PdfT;
  tEnum: PdfT;
}) {
  const stats = computeRopaStats(input);
  const bars = computeLegalBasisBars(input, tEnum);

  return (
    <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
      <SectionHeading
        eyebrow={t("ropa.sectionNumber")}
        title={t("ropa.title")}
        lead={t("ropa.lead")}
        first
      />

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <Text style={s.subHeading}>{t("ropa.byLegalBasis")}</Text>
          <HorizontalBarChart rows={bars} labelWidth={110} />
        </View>
        <View style={s.colRight}>
          <Text style={s.subHeading}>{t("ropa.signals")}</Text>
          <View style={{ marginBottom: tokens.space[4] }}>
            <StatTileRow>
              <StatTile
                value={stats.withAdm}
                label={t("ropa.autoDecisions")}
                tone={stats.withAdm > 0 ? "warning" : "neutral"}
              />
            </StatTileRow>
            <StatTileRow>
              <StatTile
                value={stats.withTransfers}
                label={t("ropa.intlTransfers")}
                tone={stats.withTransfers > 0 ? "info" : "neutral"}
              />
            </StatTileRow>
            <StatTileRow>
              <StatTile
                value={stats.overdueReview}
                label={t("ropa.overdueReview")}
                tone={stats.overdueReview > 0 ? "danger" : "success"}
              />
            </StatTileRow>
          </View>
        </View>
      </View>

      <Text style={s.subHeading}>{t("ropa.allActivities")}</Text>
      <CategoryTable
        columns={[
          { header: t("ropa.columns.activity"), width: 2.5 },
          { header: t("ropa.columns.legalBasis"), width: 1.6 },
          { header: t("ropa.columns.systems"), width: 0.8, align: "right" },
          { header: t("ropa.columns.transfers"), width: 0.8, align: "right" },
          { header: t("ropa.columns.adm"), width: 0.8 },
          { header: t("ropa.columns.nextReview"), width: 1.2 },
        ]}
        rows={input.activities.map((a) => {
          const overdue = a.nextReview && new Date(a.nextReview).getTime() < Date.now();
          return [
            a.name,
            tEnum(`legalBasis.${a.legalBasis}`),
            a.systemCount,
            a.transferCount || "—",
            a.automatedDecisionMaking ? (
              <PillBadge tone="warning" uppercase key="adm">{t("ropa.admYes")}</PillBadge>
            ) : "—",
            overdue ? (
              <PillBadge tone="danger" uppercase key="due">{fmtDate(a.nextReview)}</PillBadge>
            ) : fmtDate(a.nextReview),
          ];
        })}
        emptyText={t("ropa.empty")}
      />
    </PageFrame>
  );
}
