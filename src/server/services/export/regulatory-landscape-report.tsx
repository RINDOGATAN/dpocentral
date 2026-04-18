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
import type { PdfT } from "./privacy-program/data-mapping";

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
  // Regions are country/bloc codes — not translated, they're ISO-ish identifiers
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

function categoryLabel(cat: string, tr: PdfT): string {
  return tr(`category.${cat}`);
}

function formatHours(hours: number, tr: PdfT): string {
  if (hours === 0) return tr("noDeadline");
  if (hours < 24) return tr("hours", { hours });
  const days = hours / 24;
  return days === 1 ? tr("dayOne") : tr("days", { days });
}

// English fallback map (keys scoped to pdf.regulatoryLandscape)
const EN_FALLBACK: Record<string, string> = {
  pageTitle: "Regulatory Landscape",
  coverTitle: "Regulatory Landscape Report",
  coverSubtitle: "Privacy Program Compliance & Exposure Analysis",
  coverConfidential:
    "CONFIDENTIAL — This document provides a regulatory compliance overview for internal use by the privacy and legal teams. It should not be distributed externally without authorization.",
  executiveSummary: "Executive Summary",
  "stats.appliedFrameworks": "Applied Frameworks",
  "stats.complianceScore": "Compliance Score",
  "stats.strictestDsar": "Strictest DSAR",
  "stats.strictestBreach": "Strictest Breach",
  "stats.totalDsars": "Total DSARs",
  "stats.onTimeRate": "On-Time Rate",
  "stats.avgResolution": "Avg Resolution",
  "stats.overdue": "Overdue",
  "stats.totalTransfers": "Total Transfers",
  "stats.destinationCountries": "Destination Countries",
  "stats.nonAdequate": "Non-Adequate",
  "stats.totalVendors": "Total Vendors",
  "stats.operatingCountries": "Operating Countries",
  "stats.highRiskVendors": "High-Risk Vendors",
  "stats.notAvailable": "N/A",
  "meta.organization": "Organization",
  "meta.reportDate": "Report Date",
  "meta.dataAssets": "Data Assets",
  "meta.processingActivities": "Processing Activities",
  "meta.activeVendors": "Active Vendors",
  "meta.internationalTransfers": "International Transfers",
  "meta.primaryJurisdiction": "Primary Jurisdiction",
  "meta.primaryJurisdictionNotSet": "Not set",
  programHealth: "Program Health Indicators",
  appliedFrameworks: "Applied Regulatory Frameworks",
  "frameworkColumns.framework": "Framework",
  "frameworkColumns.region": "Region",
  "frameworkColumns.category": "Category",
  "frameworkColumns.dsar": "DSAR",
  "frameworkColumns.breach": "Breach",
  "frameworkColumns.primary": "Primary",
  penaltyExposure: "Penalty Exposure",
  penaltyDesc:
    "Summary of maximum penalties per applied regulatory framework. Actual penalties depend on the nature, gravity, and duration of the infringement, as well as cooperation with supervisory authorities.",
  deadlineCompliance: "Response Deadline Compliance",
  dsarByJurisdiction: "DSAR Deadlines by Jurisdiction",
  dsarByJurisdictionDesc:
    "Data subject access request response deadlines vary by framework",
  "dsarStatusColumns.framework": "Framework",
  "dsarStatusColumns.deadline": "Deadline",
  "dsarStatusColumns.status": "Status",
  statusMeeting: "Meeting deadline",
  statusAtRisk: "At risk",
  statusNoData: "No data yet",
  breachDeadlines: "Breach Notification Deadlines",
  breachDeadlinesDesc:
    "Maximum time to notify supervisory authorities after discovering a breach",
  "breachColumns.framework": "Framework",
  "breachColumns.deadline": "Deadline",
  "breachColumns.authority": "Authority",
  transferExposure: "International Transfer Exposure",
  transferDesc:
    "Data transfers to countries without an adequacy decision require additional safeguards such as Standard Contractual Clauses (SCCs), Binding Corporate Rules (BCRs), or approved certification mechanisms.",
  "transferColumns.country": "Country",
  "transferColumns.transfers": "Transfers",
  "transferColumns.adequacy": "Adequacy",
  "transferColumns.mechanisms": "Mechanisms",
  yes: "Yes",
  no: "No",
  vendorFootprint: "Vendor Geographic Footprint",
  vendorFootprintDesc:
    "Vendor operations across jurisdictions create regulatory obligations. High-risk vendors operating in multiple jurisdictions require enhanced due diligence and contractual protections.",
  "vendorColumns.country": "Country",
  "vendorColumns.vendors": "Vendors",
  "vendorColumns.highRisk": "High Risk",
  consolidatedRequirements: "Consolidated Compliance Requirements",
  "category.comprehensive": "Comprehensive",
  "category.sectoral": "Sectoral",
  "category.ai_governance": "AI Governance",
  "category.emerging": "Emerging",
  noDeadline: "No specific deadline",
  dayOne: "1 day",
};

function fallbackT(key: string, values?: Record<string, string | number | Date>): string {
  const templates: Record<string, string> = {
    ...EN_FALLBACK,
    coverGenerated: "Generated: {date}",
    healthDsarOnTime: "DSAR on-time completion: {rate}%",
    healthOpenIncidents: "Open incidents: {open} ({critical} critical)",
    healthOverdueDsars: "Overdue DSARs: {count}",
    healthHighRiskVendors: "High-risk vendors: {count}",
    healthAssessments: "Assessments approved: {approved} of {total}",
    appliedFrameworksDesc:
      "The following {count} regulatory frameworks have been identified as applicable to {org}. Deadlines shown represent the strictest requirements; where multiple jurisdictions overlap, the shortest deadline should prevail.",
    supervisoryAuthority: "Supervisory Authority: {name}",
    slaDays: "{days} days",
    consolidatedDesc:
      "The following requirements are aggregated from all {count} applied frameworks. Requirements that appear across multiple frameworks indicate areas of regulatory convergence and should be prioritized.",
    frameworksList: "Frameworks: {codes} ({count} frameworks)",
    hours: "{hours} hours",
    days: "{days} days",
  };
  const template = templates[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, v) => String(values[v] ?? ""));
}

// ── Component ────────────────────────────────────────────

export function RegulatoryLandscapeReport({
  data,
  t,
  locale,
}: {
  data: RegulatoryLandscapeData;
  /** Scoped to `pdf.regulatoryLandscape`. Optional — English fallback. */
  t?: PdfT;
  locale?: string;
}) {
  const tr: PdfT = t ?? fallbackT;
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

  const primaryName =
    jurisdictions.find((j) => j.isPrimary)?.name ?? tr("meta.primaryJurisdictionNotSet");

  return (
    <Document language={locale}>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>{tr("coverTitle")}</Text>
        <Text style={s.coverSubtitle}>{tr("coverSubtitle")}</Text>
        <Text style={s.coverDate}>{tr("coverGenerated", { date })}</Text>
        <Text style={s.coverConfidential}>{tr("coverConfidential")}</Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("executiveSummary")}</Text>

        <View style={s.statsGrid}>
          <StatCard value={jurisdictions.length} label={tr("stats.appliedFrameworks")} />
          <StatCard value={`${data.complianceScore}%`} label={tr("stats.complianceScore")} />
          <StatCard
            value={strictestDsar != null ? `${strictestDsar}d` : "—"}
            label={tr("stats.strictestDsar")}
          />
          <StatCard
            value={strictestBreachHours != null ? formatHours(strictestBreachHours, tr) : "—"}
            label={tr("stats.strictestBreach")}
          />
        </View>

        <ProgressBar percent={data.complianceScore} />

        <MetadataBlock
          items={[
            { label: tr("meta.organization"), value: orgName },
            { label: tr("meta.reportDate"), value: date },
            { label: tr("meta.dataAssets"), value: String(data.moduleStats.assets) },
            { label: tr("meta.processingActivities"), value: String(data.moduleStats.activities) },
            { label: tr("meta.activeVendors"), value: String(data.moduleStats.vendorTotal) },
            { label: tr("meta.internationalTransfers"), value: String(data.moduleStats.transferTotal) },
            { label: tr("meta.primaryJurisdiction"), value: primaryName },
          ]}
        />

        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>{tr("programHealth")}</Text>
          <Text style={s.calloutText}>
            {"\u2022"}  {tr("healthDsarOnTime", { rate: data.dsarOnTimeRate })}
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  {tr("healthOpenIncidents", {
              open: data.moduleStats.incidentOpen,
              critical: data.moduleStats.incidentCritical,
            })}
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  {tr("healthOverdueDsars", { count: data.moduleStats.dsarOverdue })}
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  {tr("healthHighRiskVendors", { count: data.moduleStats.vendorHighRisk })}
          </Text>
          <Text style={s.calloutText}>
            {"\u2022"}  {tr("healthAssessments", {
              approved: data.moduleStats.assessmentApproved,
              total: data.moduleStats.assessmentTotal,
            })}
          </Text>
        </View>
      </ContentPage>

      {/* ── Applied Jurisdictions ─────────────────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("appliedFrameworks")}</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          {tr("appliedFrameworksDesc", { count: jurisdictions.length, org: orgName })}
        </Text>

        <DataTable
          headers={[
            tr("frameworkColumns.framework"),
            tr("frameworkColumns.region"),
            tr("frameworkColumns.category"),
            tr("frameworkColumns.dsar"),
            tr("frameworkColumns.breach"),
            tr("frameworkColumns.primary"),
          ]}
          colWidths={[3, 1.5, 1.5, 1, 1.2, 0.8]}
          rows={jurisdictions.map((j) => [
            j.name,
            regionLabel(j.region),
            categoryLabel(j.category, tr),
            `${j.dsarDeadlineDays}d`,
            j.breachNotificationHours > 0
              ? `${j.breachNotificationHours}h`
              : tr("stats.notAvailable"),
            j.isPrimary ? tr("yes") : "",
          ])}
        />
      </ContentPage>

      {/* ── Penalty Exposure ──────────────────────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("penaltyExposure")}</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("penaltyDesc")}</Text>

        {jurisdictions.map((j) => (
          <View key={j.code} style={s.questionCard} wrap={false}>
            <View style={[s.row, { marginBottom: 4 }]}>
              <Text style={s.questionNumber}>{j.code}</Text>
              <Text style={s.questionText}>{j.name}</Text>
            </View>
            <Text style={s.answerText}>{j.penalties}</Text>
            {j.dpaName && (
              <Text style={s.notesText}>
                {tr("supervisoryAuthority", { name: j.dpaName })}
                {j.dpaUrl ? ` (${j.dpaUrl})` : ""}
              </Text>
            )}
          </View>
        ))}
      </ContentPage>

      {/* ── DSAR & Breach Deadline Compliance ─────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("deadlineCompliance")}</Text>

        <View style={s.statsGrid}>
          <StatCard value={data.moduleStats.dsarTotal} label={tr("stats.totalDsars")} />
          <StatCard value={`${data.dsarOnTimeRate}%`} label={tr("stats.onTimeRate")} />
          <StatCard
            value={
              data.moduleStats.dsarAvgDays > 0
                ? `${data.moduleStats.dsarAvgDays}d`
                : tr("stats.notAvailable")
            }
            label={tr("stats.avgResolution")}
          />
          <StatCard value={data.moduleStats.dsarOverdue} label={tr("stats.overdue")} />
        </View>

        <AccentSectionHeader
          title={tr("dsarByJurisdiction")}
          description={tr("dsarByJurisdictionDesc")}
        />

        <DataTable
          headers={[
            tr("dsarStatusColumns.framework"),
            tr("dsarStatusColumns.deadline"),
            tr("dsarStatusColumns.status"),
          ]}
          colWidths={[3, 1.5, 2]}
          rows={jurisdictions.map((j) => [
            j.name,
            tr("slaDays", { days: j.dsarDeadlineDays }),
            data.moduleStats.dsarAvgDays > 0 && data.moduleStats.dsarAvgDays <= j.dsarDeadlineDays
              ? tr("statusMeeting")
              : data.moduleStats.dsarAvgDays > j.dsarDeadlineDays
                ? tr("statusAtRisk")
                : tr("statusNoData"),
          ])}
        />

        <View style={s.divider} />

        <AccentSectionHeader
          title={tr("breachDeadlines")}
          description={tr("breachDeadlinesDesc")}
        />

        <DataTable
          headers={[
            tr("breachColumns.framework"),
            tr("breachColumns.deadline"),
            tr("breachColumns.authority"),
          ]}
          colWidths={[3, 1.5, 3]}
          rows={jurisdictions
            .filter((j) => j.breachNotificationHours > 0)
            .map((j) => [
              j.name,
              formatHours(j.breachNotificationHours, tr),
              j.dpaName || "—",
            ])}
        />
      </ContentPage>

      {/* ── International Transfer Exposure ────────────── */}
      {data.transfersByCountry.length > 0 && (
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("transferExposure")}</Text>

          <View style={s.statsGrid}>
            <StatCard value={data.moduleStats.transferTotal} label={tr("stats.totalTransfers")} />
            <StatCard
              value={data.transfersByCountry.length}
              label={tr("stats.destinationCountries")}
            />
            <StatCard
              value={data.transfersByCountry.filter((t) => !t.hasAdequacy).length}
              label={tr("stats.nonAdequate")}
            />
          </View>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("transferDesc")}</Text>

          <DataTable
            headers={[
              tr("transferColumns.country"),
              tr("transferColumns.transfers"),
              tr("transferColumns.adequacy"),
              tr("transferColumns.mechanisms"),
            ]}
            colWidths={[1.5, 1, 1.2, 4]}
            rows={data.transfersByCountry
              .sort((a, b) => b.count - a.count)
              .map((tr2) => [
                tr2.country,
                String(tr2.count),
                tr2.hasAdequacy ? tr("yes") : tr("no"),
                tr2.mechanisms.join(", ") || "—",
              ])}
          />
        </ContentPage>
      )}

      {/* ── Vendor Geographic Footprint ───────────────── */}
      {data.vendorsByCountry.length > 0 && (
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("vendorFootprint")}</Text>

          <View style={s.statsGrid}>
            <StatCard value={data.moduleStats.vendorTotal} label={tr("stats.totalVendors")} />
            <StatCard
              value={data.vendorsByCountry.length}
              label={tr("stats.operatingCountries")}
            />
            <StatCard
              value={data.moduleStats.vendorHighRisk}
              label={tr("stats.highRiskVendors")}
            />
          </View>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("vendorFootprintDesc")}</Text>

          <DataTable
            headers={[
              tr("vendorColumns.country"),
              tr("vendorColumns.vendors"),
              tr("vendorColumns.highRisk"),
            ]}
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
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("consolidatedRequirements")}</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          {tr("consolidatedDesc", { count: jurisdictions.length })}
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
                {tr("frameworksList", { codes: codes.join(", "), count: codes.length })}
              </Text>
            </View>
          ))}
      </ContentPage>
    </Document>
  );
}
