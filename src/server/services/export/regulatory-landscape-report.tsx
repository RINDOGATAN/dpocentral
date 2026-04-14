import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  ContentPage,
  MetadataBlock,
  DataTable,
  StatCard,
  AccentSectionHeader,
  ProgressBar,
  RiskBadge,
  s,
  PDF_COLORS,
  fmtDate,
} from "./pdf-styles";
import { Page } from "@react-pdf/renderer";

// ── Types ────────────────────────────────────────────────

export interface AppliedJurisdiction {
  code: string;
  name: string;
  region: string;
  country: string;
  dsarDeadlineDays: number;
  breachNotificationHours: number;
  keyRequirements: string[];
  penalties: string;
  dpaName?: string;
  dpaUrl?: string;
  category: string;
  isPrimary: boolean;
}

export interface TransferExposure {
  country: string;
  count: number;
  mechanisms: string[];
  hasAdequacy: boolean;
}

export interface VendorExposure {
  country: string;
  vendorCount: number;
  highRiskCount: number;
}

export interface RegulatoryLandscapeData {
  organization: { name: string };
  generatedAt: string;

  // Applied jurisdictions
  jurisdictions: AppliedJurisdiction[];

  // Program stats
  complianceScore: number;
  moduleStats: {
    assets: number;
    activities: number;
    dsarTotal: number;
    dsarOverdue: number;
    dsarAvgDays: number;
    incidentTotal: number;
    incidentOpen: number;
    incidentCritical: number;
    assessmentTotal: number;
    assessmentApproved: number;
    vendorTotal: number;
    vendorHighRisk: number;
    transferTotal: number;
  };

  // Geographic exposure
  transfersByCountry: TransferExposure[];
  vendorsByCountry: VendorExposure[];

  // Deadline compliance
  dsarOnTimeRate: number; // 0-100
  breachNotificationCompliance: number; // 0-100
}

// ── Helpers ──────────────────────────────────────────────

function regionLabel(region: string): string {
  if (region === "EU" || region.startsWith("EU")) return "European Union";
  if (region === "UK") return "United Kingdom";
  if (region.startsWith("US")) return "United States";
  if (region === "BR") return "Brazil";
  if (region === "CA") return "Canada";
  if (region === "CN") return "China";
  if (region === "JP") return "Japan";
  if (region === "AU") return "Australia";
  if (region === "KR") return "South Korea";
  if (region === "IN") return "India";
  if (region === "SG") return "Singapore";
  return region;
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    comprehensive: "Comprehensive",
    sectoral: "Sectoral",
    ai_governance: "AI Governance",
    emerging: "Emerging",
  };
  return map[cat] || cat;
}

function formatHours(hours: number): string {
  if (hours === 0) return "No specific deadline";
  if (hours < 24) return `${hours} hours`;
  const days = hours / 24;
  return days === 1 ? "1 day" : `${days} days`;
}

// ── Component ────────────────────────────────────────────

export function RegulatoryLandscapeReport({
  data,
}: {
  data: RegulatoryLandscapeData;
}) {
  const orgName = data.organization.name;
  const date = data.generatedAt;
  const jurisdictions = data.jurisdictions;

  // Group jurisdictions by region
  const byRegion = new Map<string, AppliedJurisdiction[]>();
  for (const j of jurisdictions) {
    const region = regionLabel(j.region);
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push(j);
  }

  // Strictest deadlines — null when no frameworks are applied, so the
  // stat cards render "—" instead of a misleading hardcoded default.
  const strictestDsar = jurisdictions.length > 0
    ? Math.min(...jurisdictions.map((j) => j.dsarDeadlineDays))
    : null;
  const strictestBreach = jurisdictions.filter((j) => j.breachNotificationHours > 0);
  const strictestBreachHours = strictestBreach.length > 0
    ? Math.min(...strictestBreach.map((j) => j.breachNotificationHours))
    : null;

  // Collect all unique requirements
  const allRequirements = new Map<string, string[]>();
  for (const j of jurisdictions) {
    for (const req of j.keyRequirements) {
      if (!allRequirements.has(req)) allRequirements.set(req, []);
      allRequirements.get(req)!.push(j.code);
    }
  }

  return (
    <Document>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>Regulatory Landscape Report</Text>
        <Text style={s.coverSubtitle}>
          Privacy Program Compliance & Exposure Analysis
        </Text>
        <Text style={s.coverDate}>Generated: {date}</Text>
        <Text style={s.coverConfidential}>
          CONFIDENTIAL — This document provides a regulatory compliance overview
          for internal use by the privacy and legal teams. It should not be
          distributed externally without authorization.
        </Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Executive Summary</Text>

        <View style={s.statsGrid}>
          <StatCard
            value={jurisdictions.length}
            label="Applied Frameworks"
          />
          <StatCard
            value={`${data.complianceScore}%`}
            label="Compliance Score"
          />
          <StatCard
            value={strictestDsar != null ? `${strictestDsar}d` : "—"}
            label="Strictest DSAR"
          />
          <StatCard
            value={strictestBreachHours != null ? formatHours(strictestBreachHours) : "—"}
            label="Strictest Breach"
          />
        </View>

        <ProgressBar percent={data.complianceScore} />

        <MetadataBlock
          items={[
            { label: "Organization", value: orgName },
            { label: "Report Date", value: date },
            { label: "Data Assets", value: String(data.moduleStats.assets) },
            { label: "Processing Activities", value: String(data.moduleStats.activities) },
            { label: "Active Vendors", value: String(data.moduleStats.vendorTotal) },
            { label: "International Transfers", value: String(data.moduleStats.transferTotal) },
            { label: "Primary Jurisdiction", value: jurisdictions.find((j) => j.isPrimary)?.name || "Not set" },
          ]}
        />

        {/* Program health indicators */}
        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>Program Health Indicators</Text>
          <Text style={s.calloutText}>
            {"\u2022"}  DSAR on-time completion: {data.dsarOnTimeRate}%
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  Open incidents: {data.moduleStats.incidentOpen} ({data.moduleStats.incidentCritical} critical)
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  Overdue DSARs: {data.moduleStats.dsarOverdue}
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  High-risk vendors: {data.moduleStats.vendorHighRisk}
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  Assessments approved: {data.moduleStats.assessmentApproved} of {data.moduleStats.assessmentTotal}
          </Text>
        </View>
      </ContentPage>

      {/* ── Applied Jurisdictions ─────────────────────── */}
      <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Applied Regulatory Frameworks</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          The following {jurisdictions.length} regulatory frameworks have been
          identified as applicable to {orgName}. Deadlines shown represent the
          strictest requirements; where multiple jurisdictions overlap, the
          shortest deadline should prevail.
        </Text>

        <DataTable
          headers={["Framework", "Region", "Category", "DSAR", "Breach", "Primary"]}
          colWidths={[3, 1.5, 1.5, 1, 1.2, 0.8]}
          rows={jurisdictions.map((j) => [
            j.name,
            regionLabel(j.region),
            categoryLabel(j.category),
            `${j.dsarDeadlineDays}d`,
            j.breachNotificationHours > 0
              ? `${j.breachNotificationHours}h`
              : "N/A",
            j.isPrimary ? "Yes" : "",
          ])}
        />
      </ContentPage>

      {/* ── Penalty Exposure ──────────────────────────── */}
      <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Penalty Exposure</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          Summary of maximum penalties per applied regulatory framework.
          Actual penalties depend on the nature, gravity, and duration of the
          infringement, as well as cooperation with supervisory authorities.
        </Text>

        {jurisdictions.map((j) => (
          <View key={j.code} style={s.questionCard} wrap={false}>
            <View style={[s.row, { marginBottom: 4 }]}>
              <Text style={s.questionNumber}>{j.code}</Text>
              <Text style={s.questionText}>{j.name}</Text>
            </View>
            <Text style={s.answerText}>{j.penalties}</Text>
            {j.dpaName && (
              <Text style={s.notesText}>
                Supervisory Authority: {j.dpaName}
                {j.dpaUrl ? ` (${j.dpaUrl})` : ""}
              </Text>
            )}
          </View>
        ))}
      </ContentPage>

      {/* ── DSAR & Breach Deadline Compliance ─────────── */}
      <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>
          Response Deadline Compliance
        </Text>

        <View style={s.statsGrid}>
          <StatCard value={data.moduleStats.dsarTotal} label="Total DSARs" />
          <StatCard value={`${data.dsarOnTimeRate}%`} label="On-Time Rate" />
          <StatCard
            value={data.moduleStats.dsarAvgDays > 0 ? `${data.moduleStats.dsarAvgDays}d` : "N/A"}
            label="Avg Resolution"
          />
          <StatCard value={data.moduleStats.dsarOverdue} label="Overdue" />
        </View>

        <AccentSectionHeader
          title="DSAR Deadlines by Jurisdiction"
          description="Data subject access request response deadlines vary by framework"
        />

        <DataTable
          headers={["Framework", "Deadline", "Status"]}
          colWidths={[3, 1.5, 2]}
          rows={jurisdictions.map((j) => [
            j.name,
            `${j.dsarDeadlineDays} days`,
            data.moduleStats.dsarAvgDays > 0 && data.moduleStats.dsarAvgDays <= j.dsarDeadlineDays
              ? "Meeting deadline"
              : data.moduleStats.dsarAvgDays > j.dsarDeadlineDays
                ? "At risk"
                : "No data yet",
          ])}
        />

        <View style={s.divider} />

        <AccentSectionHeader
          title="Breach Notification Deadlines"
          description="Maximum time to notify supervisory authorities after discovering a breach"
        />

        <DataTable
          headers={["Framework", "Deadline", "Authority"]}
          colWidths={[3, 1.5, 3]}
          rows={jurisdictions
            .filter((j) => j.breachNotificationHours > 0)
            .map((j) => [
              j.name,
              formatHours(j.breachNotificationHours),
              j.dpaName || "—",
            ])}
        />
      </ContentPage>

      {/* ── International Transfer Exposure ────────────── */}
      {data.transfersByCountry.length > 0 && (
        <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>International Transfer Exposure</Text>

          <View style={s.statsGrid}>
            <StatCard value={data.moduleStats.transferTotal} label="Total Transfers" />
            <StatCard
              value={data.transfersByCountry.length}
              label="Destination Countries"
            />
            <StatCard
              value={data.transfersByCountry.filter((t) => !t.hasAdequacy).length}
              label="Non-Adequate"
            />
          </View>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>
            Data transfers to countries without an adequacy decision require
            additional safeguards such as Standard Contractual Clauses (SCCs),
            Binding Corporate Rules (BCRs), or approved certification mechanisms.
          </Text>

          <DataTable
            headers={["Country", "Transfers", "Adequacy", "Mechanisms"]}
            colWidths={[1.5, 1, 1.2, 4]}
            rows={data.transfersByCountry
              .sort((a, b) => b.count - a.count)
              .map((t) => [
                t.country,
                String(t.count),
                t.hasAdequacy ? "Yes" : "No",
                t.mechanisms.join(", ") || "—",
              ])}
          />
        </ContentPage>
      )}

      {/* ── Vendor Geographic Footprint ───────────────── */}
      {data.vendorsByCountry.length > 0 && (
        <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>Vendor Geographic Footprint</Text>

          <View style={s.statsGrid}>
            <StatCard value={data.moduleStats.vendorTotal} label="Total Vendors" />
            <StatCard
              value={data.vendorsByCountry.length}
              label="Operating Countries"
            />
            <StatCard
              value={data.moduleStats.vendorHighRisk}
              label="High-Risk Vendors"
            />
          </View>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>
            Vendor operations across jurisdictions create regulatory obligations.
            High-risk vendors operating in multiple jurisdictions require enhanced
            due diligence and contractual protections.
          </Text>

          <DataTable
            headers={["Country", "Vendors", "High Risk"]}
            colWidths={[3, 1.5, 1.5]}
            rows={data.vendorsByCountry
              .sort((a, b) => b.vendorCount - a.vendorCount)
              .map((v) => [
                v.country,
                String(v.vendorCount),
                v.highRiskCount > 0 ? String(v.highRiskCount) : "—",
              ])}
          />
        </ContentPage>
      )}

      {/* ── Consolidated Requirements ─────────────────── */}
      <ContentPage title="Regulatory Landscape" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>
          Consolidated Compliance Requirements
        </Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          The following requirements are aggregated from all {jurisdictions.length} applied
          frameworks. Requirements that appear across multiple frameworks indicate
          areas of regulatory convergence and should be prioritized.
        </Text>

        {Array.from(allRequirements.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .map(([req, codes], i) => (
            <View key={i} style={s.questionCard} wrap={false}>
              <View style={[s.row, { alignItems: "flex-start" }]}>
                <Text style={s.questionNumber}>{i + 1}.</Text>
                <Text style={s.questionText}>{req}</Text>
              </View>
              <Text style={s.notesText}>
                Frameworks: {codes.join(", ")} ({codes.length} framework{codes.length > 1 ? "s" : ""})
              </Text>
            </View>
          ))}
      </ContentPage>
    </Document>
  );
}
