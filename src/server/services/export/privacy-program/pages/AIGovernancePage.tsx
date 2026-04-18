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
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
}) {
  const stats = computeAIStats(input);
  const riskBars = computeAIRiskBars(input);
  const roleBars = computeAIRoleBars(input);
  const compliantPct = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;

  return (
    <PageFrame eyebrow="Privacy Program Report" orgName={orgName} date={date}>
      <SectionHeading
        eyebrow="Section 05"
        title="AI Governance"
        lead="EU AI Act posture across the organisation's registered AI systems. Coverage reflects only systems explicitly catalogued — inferred or shadow AI is out of scope."
        first
      />

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <DonutChart
            value={stats.compliant}
            max={stats.total}
            label="EU AI Act Compliant"
            sublabel={`${stats.compliant} of ${stats.total} systems`}
            color={tokens.color.semantic.success.solid}
          />
        </View>
        <View style={s.colRight}>
          <Text style={s.subHeading}>Risk Distribution</Text>
          <HorizontalBarChart rows={riskBars} labelWidth={100} />
        </View>
      </View>

      <StatTileRow>
        <StatTile value={stats.total} label="AI Systems Registered" />
        <StatTile
          value={stats.highRisk}
          label="High / Unacceptable Risk"
          tone={stats.highRisk > 0 ? "warning" : "success"}
        />
        <StatTile
          value={stats.certified}
          label="ISO 42001 Certified"
          tone={stats.certified > 0 ? "success" : "neutral"}
        />
      </StatTileRow>

      {roleBars.length > 0 && (
        <>
          <Text style={[s.subHeading, { marginTop: tokens.space[6] }]}>
            Role Under EU AI Act
          </Text>
          <HorizontalBarChart rows={roleBars} labelWidth={110} />
        </>
      )}

      <Text style={[s.subHeading, { marginTop: tokens.space[5] }]}>AI Systems Inventory</Text>
      <CategoryTable
        columns={[
          { header: "Name", width: 2.2 },
          { header: "Category", width: 1.6 },
          { header: "Risk", width: 1.2 },
          { header: "Role", width: 1.1 },
          { header: "Provider", width: 1.5 },
          { header: "Status", width: 1.2 },
        ]}
        rows={input.aiSystems.map((s) => [
          s.name,
          s.category ?? "—",
          (() => {
            switch (s.riskLevel) {
              case "UNACCEPTABLE":
                return <PillBadge key="r" tone="danger" uppercase>UNACCEPTABLE</PillBadge>;
              case "HIGH_RISK":
                return <PillBadge key="r" tone="warning" uppercase>HIGH</PillBadge>;
              case "LIMITED":
                return <PillBadge key="r" tone="info" uppercase>LIMITED</PillBadge>;
              case "MINIMAL":
                return <PillBadge key="r" tone="success" uppercase>MINIMAL</PillBadge>;
              default:
                return s.riskLevel;
            }
          })(),
          s.euAiActRole ?? "—",
          s.provider ?? "—",
          s.euAiActCompliant === true ? (
            <PillBadge key="c" tone="success" uppercase>COMPLIANT</PillBadge>
          ) : s.euAiActCompliant === false ? (
            <PillBadge key="c" tone="danger" uppercase>NON-COMPLIANT</PillBadge>
          ) : (
            s.status.replace(/_/g, " ")
          ),
        ])}
        emptyText="No AI systems registered."
      />
    </PageFrame>
  );
}
