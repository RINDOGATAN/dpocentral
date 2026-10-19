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
  MiniCoverageBar,
  CategoryTable,
  CategoryChip,
  PillBadge,
  ConfidentialPill,
  tokens,
  toneForRiskTier,
  toneForVendorStatus,
} from "../design-system";
import type { VendorCsvRow } from "./csv";
import type { PdfT } from "../privacy-program/data-mapping";
import { pdfChrome, pdfDate } from "../pdf-locale";
import { displayedDpa, dpaCoverage, dpaDisplayStatus, dpaTone, isContractInForce } from "@/lib/vendor-contracts";

const s = StyleSheet.create({
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
  twoCol: {
    flexDirection: "row",
    gap: tokens.space[7],
    marginBottom: tokens.space[6],
  },
  colHalf: { flex: 1 },
  certRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});

function toneForCrit(tier: string): string {
  switch (tier) {
    case "CRITICAL": return "#dc2626";
    case "HIGH":     return "#d97706";
    case "MEDIUM":   return "#2563eb";
    case "LOW":      return "#059669";
    default:         return "#64748b";
  }
}

export function VendorRegisterDocument({
  vendors,
  orgName,
  t,
  tCommon,
  tEnum,
  locale,
  categoryLabel = (c: string) => c,
  dataLabel = (d: string) => d,
  now: props_now,
}: {
  vendors: VendorCsvRow[];
  orgName: string;
  /** Scoped to `pdf.vendorRegister` */
  t: PdfT;
  /** Scoped to `pdf.common` */
  tCommon: PdfT;
  /** Scoped to `pdf.enum` */
  tEnum: PdfT;
  /** BCP-47 locale for PDF metadata. */
  locale?: string;
  /** A category as the report prints it (the CSV's translation); the stored value by default. */
  categoryLabel?: (category: string) => string;
  /** A data category as the report prints it (the CSV's translation); the stored value by default. */
  dataLabel?: (category: string) => string;
  /** The day the figures are read on (tests pass a fixed one). */
  now?: Date;
}) {
  const now = props_now ?? new Date();
  const date = pdfDate(now, "long");

  // Coverage as every report counts it (src/lib/vendor-contracts.ts): confirmed
  // vendors in use, with a processor contract in force.
  const coverage = dpaCoverage(vendors, now);
  const active = vendors.filter((v) => v.status === "ACTIVE").length;
  const withCert = vendors.filter((v) => v.certifications.length > 0).length;
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // Contracts in force today that end within 30 days.
  const expiringContracts = vendors.reduce((n, v) => {
    return n + v.contracts.filter(
      (c) => c.endDate && new Date(c.endDate) <= thirtyDays && isContractInForce(c, now)
    ).length;
  }, 0);

  const critOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const critCounts = new Map<string, number>();
  for (const v of vendors) {
    const tier = v.riskTier ?? "NONE";
    critCounts.set(tier, (critCounts.get(tier) ?? 0) + 1);
  }
  const critBars = critOrder.map((tier) => ({
    label: tEnum(`riskTier.${tier}`).toUpperCase(),
    value: critCounts.get(tier) ?? 0,
    color: toneForCrit(tier),
    labelColor: toneForCrit(tier),
  }));

  const certBreakdown = (() => {
    const counts = new Map<string, number>();
    for (const v of vendors) for (const c of v.certifications) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  })();

  // Group by primary category
  const groups = new Map<string, VendorCsvRow[]>();
  for (const v of vendors) {
    const cat = v.categories[0] ? categoryLabel(v.categories[0]) : t("uncategorized");
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(v);
  }
  const groupEntries = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, list]) => ({ category, vendors: list }));

  return (
    <Document language={locale}>
      <CoverFrame rightEyebrow={t("coverReference")}>
        <View style={{ marginBottom: tokens.space[7] }}>
          <Text style={s.coverTitle}>{t("coverTitle")}</Text>
          <Text style={s.coverSub}>{t("coverSubtitle")}</Text>
          <Text style={s.coverOrg}>{orgName}</Text>
          <View style={s.dateRow}>
            <Text style={s.dateText}>{date}</Text>
            <ConfidentialPill label={tCommon("confidential")} />
          </View>
        </View>

        <StatTileRow>
          <StatTile value={vendors.length} label={t("stats.totalVendors")} />
          <StatTile value={active} label={t("stats.active")} tone="success" />
          <StatTile
            value={(critCounts.get("HIGH") ?? 0) + (critCounts.get("CRITICAL") ?? 0)}
            label={t("stats.highCritical")}
            tone={(critCounts.get("HIGH") ?? 0) + (critCounts.get("CRITICAL") ?? 0) > 0 ? "warning" : "success"}
          />
          <StatTile
            value={expiringContracts}
            label={t("stats.contractsExpiring")}
            tone={expiringContracts > 0 ? "warning" : "neutral"}
          />
        </StatTileRow>

        <View style={s.twoCol}>
          <View style={s.colHalf}>
            <Text style={s.subHeading}>{t("criticality")}</Text>
            <HorizontalBarChart rows={critBars} />
          </View>
          <View style={s.colHalf}>
            <Text style={s.subHeading}>{t("coverage")}</Text>
            <MiniCoverageBar label={t("coverageDpa")} value={coverage.withDpa} total={coverage.active} />
            <MiniCoverageBar label={t("coverageCertified")} value={withCert} total={vendors.length} />
          </View>
        </View>

        {certBreakdown.length > 0 && (
          <>
            <Text style={s.subHeading}>{t("certificationsTop")}</Text>
            <HorizontalBarChart rows={certBreakdown} labelWidth={110} percentOf={vendors.length} />
          </>
        )}
      </CoverFrame>

      <PageFrame eyebrow={t("eyebrow")} orgName={orgName} date={date}>
        <SectionHeading title={t("directory")} lead={t("directoryLead")} first />
        {groupEntries.map((g, gi) => (
          <CategoryTable
            key={gi}
            category={g.category}
            count={g.vendors.length}
            columns={[
              { header: t("columns.vendor"), width: 1.8 },
              { header: t("columns.status"), width: 1.1 },
              { header: t("columns.risk"), width: 0.9 },
              { header: t("columns.countries"), width: 1.1 },
              { header: t("columns.certifications"), width: 1.8 },
              { header: t("columns.dpa"), width: 1.4 },
              { header: t("columns.nextReview"), width: 1.5 },
            ]}
            rows={g.vendors.map((v) => {
              const dpa = displayedDpa(v.contracts, now);
              const reviewPast = !!v.nextReviewAt && new Date(v.nextReviewAt).getTime() < now.getTime();
              return [
                v.name,
                (
                  <PillBadge key="s" tone={toneForVendorStatus(v.status)} uppercase>
                    {tEnum(`vendorStatus.${v.status}`).toUpperCase()}
                  </PillBadge>
                ),
                v.riskTier ? (
                  <PillBadge key="r" tone={toneForRiskTier(v.riskTier)} uppercase>
                    {tEnum(`riskTier.${v.riskTier}`).toUpperCase()}
                  </PillBadge>
                ) : "",
                v.countries.join(", ") || "",
                v.certifications.length > 0 ? (
                  <View key="c" style={s.certRow}>
                    {v.certifications.slice(0, 4).map((c, ci) => (
                      <CategoryChip key={ci} label={c} />
                    ))}
                  </View>
                ) : "",
                dpa ? (
                  <PillBadge key="d" tone={dpaTone(dpa, now)} uppercase>
                    {tEnum(`contractStatus.${dpaDisplayStatus(dpa, now)}`).toUpperCase()}
                  </PillBadge>
                ) : v.status === "ACTIVE" ? (
                  <PillBadge key="d" tone="danger" uppercase>{t("dpaMissing")}</PillBadge>
                ) : "",
                reviewPast ? (
                  <PillBadge key="n" tone="danger">{pdfDate(v.nextReviewAt)}</PillBadge>
                ) : pdfDate(v.nextReviewAt),
              ];
            })}
          />
        ))}

        {/* Art. 28 and Art. 30(1)(d)-(e): what each processor does with which data, where, under which contract. */}
        <SectionHeading title={t("details")} lead={t("detailsLead")} />
        <CategoryTable
          columns={[
            { header: t("columns.vendor"), width: 1.6 },
            { header: t("columns.service"), width: 2.6 },
            { header: t("columns.dataProcessed"), width: 2.2 },
            { header: t("columns.countries"), width: 1.1 },
            { header: t("columns.contract"), width: 1.8 },
          ]}
          rows={vendors.map((v) => {
            const dpa = displayedDpa(v.contracts, now);
            const span = dpa
              ? [pdfDate(dpa.startDate), pdfDate(dpa.endDate)].filter(Boolean).join(t("dateRangeJoin"))
              : "";
            return [
              v.name,
              v.description ?? pdfChrome().notStated,
              v.dataProcessed.length > 0 ? v.dataProcessed.map(dataLabel).join(", ") : pdfChrome().notStated,
              v.countries.join(", ") || pdfChrome().notStated,
              dpa
                ? `${tEnum(`contractStatus.${dpaDisplayStatus(dpa, now)}`)}${span ? ` (${span})` : ""}`
                : t("noDpa"),
            ];
          })}
        />
      </PageFrame>
    </Document>
  );
}
