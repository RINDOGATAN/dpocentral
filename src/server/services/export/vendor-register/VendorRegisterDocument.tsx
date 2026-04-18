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

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().split("T")[0]!;
}

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
}) {
  const date = new Date().toISOString().split("T")[0]!;

  const active = vendors.filter((v) => v.status === "ACTIVE").length;
  const withDpa = vendors.filter((v) => v.status === "ACTIVE" && v.contracts.some((c) => c.type === "DPA")).length;
  const withCert = vendors.filter((v) => v.certifications.length > 0).length;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringContracts = vendors.reduce((n, v) => {
    return n + v.contracts.filter(
      (c) => c.endDate && new Date(c.endDate) <= thirtyDays && c.status === "ACTIVE"
    ).length;
  }, 0);

  const critOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const critCounts = new Map<string, number>();
  for (const v of vendors) {
    const tier = v.riskTier ?? "—";
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
    const cat = v.categories[0] ?? "Uncategorized";
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
            <MiniCoverageBar label={t("coverageDpa")} value={withDpa} total={active} />
            <MiniCoverageBar label={t("coverageCertified")} value={withCert} total={vendors.length} />
          </View>
        </View>

        {certBreakdown.length > 0 && (
          <>
            <Text style={s.subHeading}>{t("certificationsTop")}</Text>
            <HorizontalBarChart rows={certBreakdown} labelWidth={110} />
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
              { header: t("columns.vendor"), width: 2.3 },
              { header: t("columns.status"), width: 1.1 },
              { header: t("columns.risk"), width: 1 },
              { header: t("columns.countries"), width: 1.4 },
              { header: t("columns.certifications"), width: 2 },
              { header: t("columns.dpa"), width: 1 },
              { header: t("columns.nextReview"), width: 1.1 },
            ]}
            rows={g.vendors.map((v) => {
              const dpa = v.contracts.find((c) => c.type === "DPA");
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
                ) : "—",
                v.countries.join(", ") || "—",
                v.certifications.length > 0 ? (
                  <View key="c" style={s.certRow}>
                    {v.certifications.slice(0, 4).map((c, ci) => (
                      <CategoryChip key={ci} label={c} />
                    ))}
                  </View>
                ) : "—",
                dpa ? (
                  <PillBadge key="d" tone="success" uppercase>
                    {tEnum(`contractStatus.${dpa.status}`).toUpperCase()}
                  </PillBadge>
                ) : v.status === "ACTIVE" ? (
                  <PillBadge key="d" tone="danger" uppercase>{t("dpaMissing")}</PillBadge>
                ) : "—",
                fmtDate(v.nextReviewAt),
              ];
            })}
          />
        ))}
      </PageFrame>
    </Document>
  );
}
