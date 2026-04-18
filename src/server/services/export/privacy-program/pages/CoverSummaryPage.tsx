import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  CoverFrame,
  StatTile,
  StatTileRow,
  KeyFinding,
  MiniCoverageBar,
  CategoryChip,
  CategoryChipRow,
  ConfidentialPill,
  tokens,
} from "../../design-system";
import {
  computeCoverageBars,
  computeHeroStats,
  computeKeyFindings,
  computeVendorCategoryChips,
  type ProgramInput,
  type PdfT,
} from "../data-mapping";

const s = StyleSheet.create({
  titleBlock: {
    marginBottom: tokens.space[7],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: tokens.typography.size.display,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.color.brand.navyDeep,
    letterSpacing: tokens.typography.letterSpacing.tight,
    lineHeight: tokens.typography.lineHeight.tight,
    marginBottom: tokens.space[3],
  },
  clientName: {
    fontSize: tokens.typography.size.h2,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.color.text.secondary,
    marginBottom: tokens.space[2],
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontSize: tokens.typography.size.body,
    color: tokens.color.text.muted,
    fontWeight: tokens.typography.weight.medium,
    marginRight: tokens.space[5],
  },
  sectionLabel: {
    fontSize: tokens.typography.size.micro,
    fontFamily: tokens.typography.family.sans,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.color.text.muted,
    textTransform: "uppercase",
    letterSpacing: tokens.typography.letterSpacing.caps,
    marginTop: tokens.space[8],
    marginBottom: tokens.space[4],
  },
  twoCol: {
    flexDirection: "row",
    gap: tokens.space[8],
  },
  colLeft: {
    flex: 1,
  },
  colRight: {
    flex: 1,
  },
});

export function CoverSummaryPage({
  orgName,
  date,
  input,
  t,
  tCommon,
}: {
  orgName: string;
  date: string;
  input: ProgramInput;
  t: PdfT;
  tCommon: PdfT;
}) {
  const hero = computeHeroStats(input);
  const coverage = computeCoverageBars(input, t);
  const findings = computeKeyFindings(input, t);
  const categoryChips = computeVendorCategoryChips(input);

  return (
    <CoverFrame rightEyebrow={t("wordmarkRight")}>
      <View style={s.titleBlock}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t("title")}</Text>
            <Text style={s.clientName}>{orgName}</Text>
            <View style={s.dateRow}>
              <Text style={s.dateText}>{date}</Text>
              <ConfidentialPill label={tCommon("confidential")} />
            </View>
          </View>
        </View>
      </View>

      <StatTileRow>
        <StatTile value={hero.assetCount} label={t("cover.stats.dataAssets")} />
        <StatTile value={hero.activityCount} label={t("cover.stats.processingActivities")} />
        <StatTile value={hero.vendorCount} label={t("cover.stats.vendors")} />
        <StatTile
          value={hero.dsarOnTimePct ?? "—"}
          suffix={hero.dsarOnTimePct !== null ? "%" : undefined}
          label={t("cover.stats.dsarsOnTime")}
          tone={
            hero.dsarOnTimePct === null
              ? "neutral"
              : hero.dsarOnTimePct >= 90
                ? "success"
                : hero.dsarOnTimePct >= 70
                  ? "warning"
                  : "danger"
          }
        />
      </StatTileRow>

      <View style={s.twoCol}>
        <View style={s.colLeft}>
          <Text style={s.sectionLabel}>{t("cover.keyFindings")}</Text>
          {findings.length === 0 ? (
            <Text style={{ fontSize: tokens.typography.size.body, color: tokens.color.text.muted }}>
              {t("cover.noFindings")}
            </Text>
          ) : (
            findings.slice(0, 5).map((f, i) => (
              <KeyFinding key={i} tone={f.tone} text={f.text} />
            ))
          )}
        </View>

        <View style={s.colRight}>
          <Text style={s.sectionLabel}>{t("cover.dataEnrichmentCoverage")}</Text>
          {coverage.map((c, i) => (
            <MiniCoverageBar
              key={i}
              label={c.label}
              value={c.value}
              total={c.total}
            />
          ))}

          {categoryChips.length > 0 && (
            <>
              <Text style={s.sectionLabel}>{t("cover.vendorCategories")}</Text>
              <CategoryChipRow>
                {categoryChips.slice(0, 10).map((c, i) => (
                  <CategoryChip key={i} label={c.label} count={c.count} />
                ))}
              </CategoryChipRow>
            </>
          )}
        </View>
      </View>
    </CoverFrame>
  );
}
