import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  PageFrame,
  SectionHeading,
  DonutChart,
  HorizontalBarChart,
  CategoryTable,
  tokens,
  colorForAssetType,
} from "../../design-system";
import {
  computeAssetTypeBars,
  computeInventoryStats,
  type ProgramInput,
} from "../data-mapping";

const s = StyleSheet.create({
  donutRow: {
    flexDirection: "row",
    gap: tokens.space[9],
    justifyContent: "center",
    marginBottom: tokens.space[7],
  },
  donutCell: {
    flex: 1,
    alignItems: "center",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: tokens.space[6],
    marginBottom: tokens.space[4],
  },
  subHeading: {
    fontSize: tokens.typography.size.h4,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.text.primary,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
  },
});

export function InventoryPage({
  orgName,
  date,
  input,
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
}) {
  const stats = computeInventoryStats(input);
  const assetTypeBars = computeAssetTypeBars(input).map((b) => ({
    label: b.label,
    value: b.value,
    color: colorForAssetType(b.type),
  }));

  return (
    <PageFrame eyebrow="Privacy Program Report" orgName={orgName} date={date}>
      <SectionHeading
        eyebrow="Section 02"
        title="Data Inventory"
        lead="Overview of registered data assets, their classification density, and the share of personal and special-category data catalogued across the estate."
        first
      />

      <View style={s.donutRow}>
        <View style={s.donutCell}>
          <DonutChart
            value={stats.personal}
            max={stats.totalElements}
            label="Personal Data"
            sublabel={`${stats.personal} of ${stats.totalElements} elements`}
            color={tokens.color.brand.navy}
          />
        </View>
        <View style={s.donutCell}>
          <DonutChart
            value={stats.specialCat}
            max={stats.totalElements}
            label="Special Category"
            sublabel={`${stats.specialCat} of ${stats.totalElements} elements · Art. 9`}
            color={tokens.color.semantic.danger.solid}
          />
        </View>
      </View>

      <View style={s.headingRow}>
        <Text style={s.subHeading}>Assets by Type</Text>
      </View>
      <HorizontalBarChart rows={assetTypeBars} />

      <View style={s.headingRow}>
        <Text style={s.subHeading}>Asset Register</Text>
      </View>
      <CategoryTable
        columns={[
          { header: "Name", width: 2.6 },
          { header: "Type", width: 1.4 },
          { header: "Owner", width: 1.3 },
          { header: "Location", width: 1.3 },
          { header: "Elts", width: 0.6, align: "right" },
          { header: "Personal", width: 0.8, align: "right" },
          { header: "Art. 9", width: 0.7, align: "right" },
        ]}
        rows={input.assets.map((a) => [
          a.name,
          a.type.replace(/_/g, " "),
          a.owner ?? "—",
          a.location ?? "—",
          a.elementCount,
          a.personalCount,
          a.specialCatCount,
        ])}
        emptyText="No data assets have been registered."
      />
    </PageFrame>
  );
}
