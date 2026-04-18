import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  PageFrame,
  SectionHeading,
  HorizontalBarChart,
  MiniCoverageBar,
  CategoryTable,
  CategoryChip,
  PillBadge,
  tokens,
  toneForRiskTier,
} from "../../design-system";
import {
  computeCriticalityBars,
  computeVendorStats,
  groupVendorsByCategory,
  type ProgramInput,
} from "../data-mapping";

const s = StyleSheet.create({
  twoCol: {
    flexDirection: "row",
    gap: tokens.space[7],
    marginBottom: tokens.space[6],
  },
  colLeft: {
    flex: 1,
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
  },
  certRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});

export function VendorDirectoryPage({
  orgName,
  date,
  input,
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
}) {
  const stats = computeVendorStats(input);
  const critBars = computeCriticalityBars(input);
  const groups = groupVendorsByCategory(input);

  return (
    <PageFrame eyebrow="Privacy Program Report" orgName={orgName} date={date}>
      <SectionHeading
        eyebrow="Section 04"
        title="Vendors & Processors"
        lead="All processors and sub-processors subject to Article 28 obligations. Risk tiering and DPA status are summarised below; the full register follows by category."
        first
      />

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <Text style={s.subHeading}>Criticality Distribution</Text>
          <HorizontalBarChart rows={critBars} />
        </View>
        <View style={s.colRight}>
          <Text style={s.subHeading}>Coverage</Text>
          <MiniCoverageBar
            label="DPA on file"
            value={stats.withDpa}
            total={stats.active}
          />
          <MiniCoverageBar
            label="Active"
            value={stats.active}
            total={stats.total}
          />
          <MiniCoverageBar
            label="Certified"
            value={stats.withCert}
            total={stats.total}
          />
        </View>
      </View>

      {groups.map((g, i) => (
        <CategoryTable
          key={i}
          category={g.category}
          count={g.vendors.length}
          columns={[
            { header: "Vendor", width: 2.4 },
            { header: "Risk", width: 1 },
            { header: "Countries", width: 1.5 },
            { header: "Certifications", width: 2 },
            { header: "DPA", width: 0.9 },
            { header: "Next Review", width: 1.2 },
          ]}
          rows={g.vendors.map((v) => [
            v.name,
            v.riskTier ? (
              <PillBadge key="r" tone={toneForRiskTier(v.riskTier)} uppercase>
                {v.riskTier}
              </PillBadge>
            ) : "—",
            v.countries.join(", ") || "—",
            v.certifications.length > 0 ? (
              <View key="c" style={s.certRow}>
                {v.certifications.slice(0, 4).map((c, ci) => (
                  <CategoryChip key={ci} label={c} />
                ))}
              </View>
            ) : "—",
            v.hasDpa ? (
              <PillBadge key="d" tone="success" uppercase>
                {v.dpaStatus ?? "YES"}
              </PillBadge>
            ) : v.status === "ACTIVE" ? (
              <PillBadge key="d" tone="danger" uppercase>
                MISSING
              </PillBadge>
            ) : "—",
            v.nextReview
              ? new Date(v.nextReview).toISOString().split("T")[0]
              : "—",
          ])}
        />
      ))}
    </PageFrame>
  );
}
