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
}: {
  vendors: VendorCsvRow[];
  orgName: string;
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
    const t = v.riskTier ?? "—";
    critCounts.set(t, (critCounts.get(t) ?? 0) + 1);
  }
  const critBars = critOrder.map((t) => ({
    label: t,
    value: critCounts.get(t) ?? 0,
    color: toneForCrit(t),
    labelColor: toneForCrit(t),
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
    <Document>
      <CoverFrame rightEyebrow="GDPR · Article 28">
        <View style={{ marginBottom: tokens.space[7] }}>
          <Text style={s.coverTitle}>Vendor Register</Text>
          <Text style={s.coverSub}>Processor & Sub-processor Inventory</Text>
          <Text style={s.coverOrg}>{orgName}</Text>
          <View style={s.dateRow}>
            <Text style={s.dateText}>{date}</Text>
            <ConfidentialPill />
          </View>
        </View>

        <StatTileRow>
          <StatTile value={vendors.length} label="Total Vendors" />
          <StatTile value={active} label="Active" tone="success" />
          <StatTile
            value={(critCounts.get("HIGH") ?? 0) + (critCounts.get("CRITICAL") ?? 0)}
            label="High / Critical"
            tone={(critCounts.get("HIGH") ?? 0) + (critCounts.get("CRITICAL") ?? 0) > 0 ? "warning" : "success"}
          />
          <StatTile
            value={expiringContracts}
            label="Contracts Expiring 30d"
            tone={expiringContracts > 0 ? "warning" : "neutral"}
          />
        </StatTileRow>

        <View style={s.twoCol}>
          <View style={s.colHalf}>
            <Text style={s.subHeading}>Criticality</Text>
            <HorizontalBarChart rows={critBars} />
          </View>
          <View style={s.colHalf}>
            <Text style={s.subHeading}>Coverage</Text>
            <MiniCoverageBar label="DPA on file" value={withDpa} total={active} />
            <MiniCoverageBar label="Certified" value={withCert} total={vendors.length} />
          </View>
        </View>

        {certBreakdown.length > 0 && (
          <>
            <Text style={s.subHeading}>Certifications — Top</Text>
            <HorizontalBarChart rows={certBreakdown} labelWidth={110} />
          </>
        )}
      </CoverFrame>

      <PageFrame eyebrow="Vendor Register" orgName={orgName} date={date}>
        <SectionHeading title="Directory" lead="All vendors grouped by primary category. Risk tier and DPA status are shown inline; certifications appear as chips." first />
        {groupEntries.map((g, gi) => (
          <CategoryTable
            key={gi}
            category={g.category}
            count={g.vendors.length}
            columns={[
              { header: "Vendor", width: 2.3 },
              { header: "Status", width: 1.1 },
              { header: "Risk", width: 1 },
              { header: "Countries", width: 1.4 },
              { header: "Certifications", width: 2 },
              { header: "DPA", width: 1 },
              { header: "Next Review", width: 1.1 },
            ]}
            rows={g.vendors.map((v) => {
              const dpa = v.contracts.find((c) => c.type === "DPA");
              return [
                v.name,
                (
                  <PillBadge key="s" tone={toneForVendorStatus(v.status)} uppercase>
                    {v.status.replace(/_/g, " ")}
                  </PillBadge>
                ),
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
                dpa ? (
                  <PillBadge key="d" tone="success" uppercase>
                    {dpa.status.replace(/_/g, " ")}
                  </PillBadge>
                ) : v.status === "ACTIVE" ? (
                  <PillBadge key="d" tone="danger" uppercase>MISSING</PillBadge>
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
