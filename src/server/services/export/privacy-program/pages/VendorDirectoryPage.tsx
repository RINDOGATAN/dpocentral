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
  type PdfT,
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
  t,
  tEnum,
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
  t: PdfT;
  tEnum: PdfT;
}) {
  const stats = computeVendorStats(input);
  const critBars = computeCriticalityBars(input, tEnum);
  const groups = groupVendorsByCategory(input);

  return (
    <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
      <SectionHeading
        eyebrow={t("vendors.sectionNumber")}
        title={t("vendors.title")}
        lead={t("vendors.lead")}
        first
      />

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <Text style={s.subHeading}>{t("vendors.criticalityDistribution")}</Text>
          <HorizontalBarChart rows={critBars} />
        </View>
        <View style={s.colRight}>
          <Text style={s.subHeading}>{t("vendors.coverage")}</Text>
          <MiniCoverageBar
            label={t("vendors.coverageDpa")}
            value={stats.withDpa}
            total={stats.active}
          />
          <MiniCoverageBar
            label={t("vendors.coverageActive")}
            value={stats.active}
            total={stats.total}
          />
          <MiniCoverageBar
            label={t("vendors.coverageCertified")}
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
            { header: t("vendors.columns.vendor"), width: 2.4 },
            { header: t("vendors.columns.risk"), width: 1 },
            { header: t("vendors.columns.countries"), width: 1.5 },
            { header: t("vendors.columns.certifications"), width: 2 },
            { header: t("vendors.columns.dpa"), width: 0.9 },
            { header: t("vendors.columns.nextReview"), width: 1.2 },
          ]}
          rows={g.vendors.map((v) => [
            v.name,
            v.riskTier ? (
              <PillBadge key="r" tone={toneForRiskTier(v.riskTier)} uppercase>
                {tEnum(`riskTier.${v.riskTier}`).toUpperCase()}
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
                {v.dpaStatus
                  ? tEnum(`contractStatus.${v.dpaStatus.replace(/ /g, "_").toUpperCase()}`)
                  : t("vendors.dpaYes")}
              </PillBadge>
            ) : v.status === "ACTIVE" ? (
              <PillBadge key="d" tone="danger" uppercase>
                {t("vendors.dpaMissing")}
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
