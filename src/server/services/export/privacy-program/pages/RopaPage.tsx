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
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
}) {
  const stats = computeRopaStats(input);
  const bars = computeLegalBasisBars(input);

  return (
    <PageFrame eyebrow="Privacy Program Report" orgName={orgName} date={date}>
      <SectionHeading
        eyebrow="Section 03"
        title="Record of Processing"
        lead="Article 30 summary. For auditor-grade detail (systems, data elements, transfer safeguards), export the standalone ROPA report."
        first
      />

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <Text style={s.subHeading}>By Legal Basis</Text>
          <HorizontalBarChart rows={bars} labelWidth={110} />
        </View>
        <View style={s.colRight}>
          <Text style={s.subHeading}>Signals</Text>
          <View style={{ marginBottom: tokens.space[4] }}>
            <StatTileRow>
              <StatTile
                value={stats.withAdm}
                label="Auto. Decisions"
                tone={stats.withAdm > 0 ? "warning" : "neutral"}
              />
            </StatTileRow>
            <StatTileRow>
              <StatTile
                value={stats.withTransfers}
                label="Intl. Transfers"
                tone={stats.withTransfers > 0 ? "info" : "neutral"}
              />
            </StatTileRow>
            <StatTileRow>
              <StatTile
                value={stats.overdueReview}
                label="Overdue Review"
                tone={stats.overdueReview > 0 ? "danger" : "success"}
              />
            </StatTileRow>
          </View>
        </View>
      </View>

      <Text style={s.subHeading}>All Activities</Text>
      <CategoryTable
        columns={[
          { header: "Activity", width: 2.5 },
          { header: "Legal Basis", width: 1.6 },
          { header: "Systems", width: 0.8, align: "right" },
          { header: "Transfers", width: 0.8, align: "right" },
          { header: "ADM", width: 0.8 },
          { header: "Next Review", width: 1.2 },
        ]}
        rows={input.activities.map((a) => {
          const overdue = a.nextReview && new Date(a.nextReview).getTime() < Date.now();
          return [
            a.name,
            a.legalBasis.replace(/_/g, " "),
            a.systemCount,
            a.transferCount || "—",
            a.automatedDecisionMaking ? (
              <PillBadge tone="warning" uppercase key="adm">YES</PillBadge>
            ) : "—",
            overdue ? (
              <PillBadge tone="danger" uppercase key="due">{fmtDate(a.nextReview)}</PillBadge>
            ) : fmtDate(a.nextReview),
          ];
        })}
        emptyText="No processing activities recorded."
      />
    </PageFrame>
  );
}
