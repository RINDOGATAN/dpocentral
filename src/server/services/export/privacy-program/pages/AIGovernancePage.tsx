import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  PageFrame,
  SectionHeading,
  HorizontalBarChart,
  DonutChart,
  StatTile,
  StatTileRow,
  CategoryTable,
  PillBadge,
  tokens,
} from "../../design-system";
import {
  computeAIRiskBars,
  computeAIRoleBars,
  computeAIStats,
  type ProgramInput,
  type PdfT,
} from "../data-mapping";

const s = StyleSheet.create({
  twoCol: {
    flexDirection: "row",
    gap: tokens.space[7],
    marginBottom: tokens.space[6],
    alignItems: "center",
  },
  colLeft: {
    flex: 1,
    alignItems: "center",
  },
  colRight: {
    flex: 1.3,
  },
  subHeading: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginBottom: tokens.space[3],
  },
});

export function AIGovernancePage({
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
  const stats = computeAIStats(input);
  const riskBars = computeAIRiskBars(input, tEnum);
  const roleBars = computeAIRoleBars(input, t("ai.roleUnclassified"));

  return (
    <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
      <SectionHeading
        eyebrow={t("ai.sectionNumber")}
        title={t("ai.title")}
        lead={t("ai.lead")}
        first
      />

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <DonutChart
            value={stats.compliant}
            max={stats.total}
            label={t("ai.donutCompliant")}
            sublabel={t("ai.donutSub", { count: stats.compliant, total: stats.total })}
            color={tokens.color.semantic.success.solid}
          />
        </View>
        <View style={s.colRight}>
          <Text style={s.subHeading}>{t("ai.riskDistribution")}</Text>
          <HorizontalBarChart rows={riskBars} labelWidth={100} />
        </View>
      </View>

      <StatTileRow>
        <StatTile value={stats.total} label={t("ai.stats.registered")} />
        <StatTile
          value={stats.highRisk}
          label={t("ai.stats.highRisk")}
          tone={stats.highRisk > 0 ? "warning" : "success"}
        />
        <StatTile
          value={stats.certified}
          label={t("ai.stats.certified")}
          tone={stats.certified > 0 ? "success" : "neutral"}
        />
      </StatTileRow>

      {roleBars.length > 0 && (
        <>
          <Text style={[s.subHeading, { marginTop: tokens.space[6] }]}>
            {t("ai.role")}
          </Text>
          <HorizontalBarChart rows={roleBars} labelWidth={110} />
        </>
      )}

      <Text style={[s.subHeading, { marginTop: tokens.space[5] }]}>{t("ai.inventory")}</Text>
      <CategoryTable
        columns={[
          { header: t("ai.columns.name"), width: 2.2 },
          { header: t("ai.columns.category"), width: 1.6 },
          { header: t("ai.columns.risk"), width: 1.2 },
          { header: t("ai.columns.role"), width: 1.1 },
          { header: t("ai.columns.provider"), width: 1.5 },
          { header: t("ai.columns.status"), width: 1.2 },
        ]}
        rows={input.aiSystems.map((sys) => [
          sys.name,
          sys.category ?? "—",
          (() => {
            const label = tEnum(`aiRisk.${sys.riskLevel}`).toUpperCase();
            switch (sys.riskLevel) {
              case "UNACCEPTABLE":
                return <PillBadge key="r" tone="danger" uppercase>{label}</PillBadge>;
              case "HIGH_RISK":
                return <PillBadge key="r" tone="warning" uppercase>{label}</PillBadge>;
              case "LIMITED":
                return <PillBadge key="r" tone="info" uppercase>{label}</PillBadge>;
              case "MINIMAL":
                return <PillBadge key="r" tone="success" uppercase>{label}</PillBadge>;
              default:
                return label;
            }
          })(),
          sys.euAiActRole ?? "—",
          sys.provider ?? "—",
          sys.euAiActCompliant === true ? (
            <PillBadge key="c" tone="success" uppercase>{t("ai.statusCompliant")}</PillBadge>
          ) : sys.euAiActCompliant === false ? (
            <PillBadge key="c" tone="danger" uppercase>{t("ai.statusNonCompliant")}</PillBadge>
          ) : (
            tEnum(`aiSystemStatus.${sys.status}`)
          ),
        ])}
        emptyText={t("ai.empty")}
      />
    </PageFrame>
  );
}
