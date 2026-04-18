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
  type PdfT,
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
  t,
  tEnum,
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
  t: PdfT;
  tEnum: PdfT;
}) {
  const stats = computeInventoryStats(input);
  const assetTypeBars = computeAssetTypeBars(input, tEnum).map((b) => ({
    label: b.label,
    value: b.value,
    color: colorForAssetType(b.type),
  }));

  return (
    <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
      <SectionHeading
        eyebrow={t("inventory.sectionNumber")}
        title={t("inventory.title")}
        lead={t("inventory.lead")}
        first
      />

      <View style={s.donutRow}>
        <View style={s.donutCell}>
          <DonutChart
            value={stats.personal}
            max={stats.totalElements}
            label={t("inventory.donutPersonal")}
            sublabel={t("inventory.donutPersonalSub", { count: stats.personal, total: stats.totalElements })}
            color={tokens.color.brand.navy}
          />
        </View>
        <View style={s.donutCell}>
          <DonutChart
            value={stats.specialCat}
            max={stats.totalElements}
            label={t("inventory.donutSpecial")}
            sublabel={t("inventory.donutSpecialSub", { count: stats.specialCat, total: stats.totalElements })}
            color={tokens.color.semantic.danger.solid}
          />
        </View>
      </View>

      <View style={s.headingRow}>
        <Text style={s.subHeading}>{t("inventory.assetsByType")}</Text>
      </View>
      <HorizontalBarChart rows={assetTypeBars} />

      <View style={s.headingRow}>
        <Text style={s.subHeading}>{t("inventory.assetRegister")}</Text>
      </View>
      <CategoryTable
        columns={[
          { header: t("inventory.columns.name"), width: 2.6 },
          { header: t("inventory.columns.type"), width: 1.4 },
          { header: t("inventory.columns.owner"), width: 1.3 },
          { header: t("inventory.columns.location"), width: 1.3 },
          { header: t("inventory.columns.elements"), width: 0.6, align: "right" },
          { header: t("inventory.columns.personal"), width: 0.8, align: "right" },
          { header: t("inventory.columns.article9"), width: 0.7, align: "right" },
        ]}
        rows={input.assets.map((a) => [
          a.name,
          tEnum(`assetType.${a.type}`),
          a.owner ?? "—",
          a.location ?? "—",
          a.elementCount,
          a.personalCount,
          a.specialCatCount,
        ])}
        emptyText={t("inventory.empty")}
      />
    </PageFrame>
  );
}
