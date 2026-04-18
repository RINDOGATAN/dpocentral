import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  ContentPage,
  MetadataBlock,
  DataTable,
  StatCard,
  AccentSectionHeader,
  ProgressBar,
  s,
  PDF_COLORS,
  fmtDate,
} from "./pdf-styles";
import { Page } from "@react-pdf/renderer";
import type { PdfT } from "./privacy-program/data-mapping";

// ── Types ────────────────────────────────────────────────

export interface DSARPerformanceData {
  organization: { name: string };
  generatedAt: string;
  primaryJurisdiction: string | null;
  primaryDeadlineDays: number;

  stats: {
    total: number;
    completed: number;
    overdue: number;
    open: number;
    onTimeRate: number; // 0-100
    avgResolutionDays: number;
    completedLast30Days: number;
    redacted: number;
  };

  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];

  // SLA by jurisdiction
  jurisdictionSLA: {
    name: string;
    deadlineDays: number;
    status: string; // "Meeting" | "At risk" | "No data"
  }[];

  // Monthly trend (last 12 months)
  monthlyTrend: {
    month: string; // YYYY-MM
    received: number;
    completed: number;
  }[];

  // Aging of open requests
  aging: {
    band: string;
    count: number;
  }[];
}

// ── Helpers ──────────────────────────────────────────────

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

// English fallback map — used when no `t` prop is supplied.
const EN_FALLBACK: Record<string, string> = {
  pageTitle: "DSAR Performance",
  coverTitle: "DSAR Performance Report",
  coverSubtitle: "Data Subject Access Request Compliance & Metrics",
  coverConfidential:
    "CONFIDENTIAL — This report contains aggregated performance metrics for data subject request handling. No individual personal data is included in this report.",
  executiveSummary: "Executive Summary",
  "stats.totalRequests": "Total Requests",
  "stats.onTimeRate": "On-Time Rate",
  "stats.avgResolution": "Avg Resolution",
  "stats.overdue": "Overdue",
  "stats.notAvailable": "N/A",
  "meta.organization": "Organization",
  "meta.reportDate": "Report Date",
  "meta.primaryJurisdiction": "Primary Jurisdiction",
  "meta.primaryJurisdictionNotSet": "Not set",
  "meta.defaultDeadline": "Default Deadline",
  "meta.totalRequests": "Total Requests",
  "meta.completed": "Completed",
  "meta.currentlyOpen": "Currently Open",
  "meta.completedLast30Days": "Completed (Last 30 Days)",
  "meta.autoRedacted": "Auto-Redacted",
  privacyByDesign: "Privacy by Design",
  privacyByDesignBody:
    "This report contains no individual personal data. All metrics are aggregated. Completed DSAR records are automatically redacted after the configured retention period to minimize data protection risk.",
  requestAnalysis: "Request Analysis",
  byType: "By Request Type",
  byTypeDesc: "Distribution of data subject requests by type of right exercised",
  "typeColumns.type": "Request Type",
  "typeColumns.count": "Count",
  "typeColumns.percentage": "Percentage",
  byStatus: "By Status",
  byStatusDesc: "Current status distribution of all requests",
  "statusColumns.status": "Status",
  "statusColumns.count": "Count",
  "statusColumns.percentage": "Percentage",
  slaCompliance: "SLA Compliance by Jurisdiction",
  slaDesc:
    "DSAR response deadlines vary by jurisdiction. Where multiple jurisdictions apply, the strictest deadline should prevail. Average resolution time is compared against each framework's deadline.",
  "slaColumns.jurisdiction": "Jurisdiction",
  "slaColumns.deadline": "Deadline",
  "slaColumns.avgResolution": "Avg Resolution",
  "slaColumns.status": "Status",
  monthlyTrend: "Monthly Trend",
  monthlyTrendDesc:
    "Request volume and completion rate over the last 12 months. Monitoring trends helps anticipate resource needs and identify seasonal patterns.",
  "monthlyColumns.month": "Month",
  "monthlyColumns.received": "Received",
  "monthlyColumns.completed": "Completed",
  "monthlyColumns.backlog": "Backlog",
  openRequestAging: "Open Request Aging",
  agingDesc:
    "Requests aged beyond the jurisdiction's deadline require immediate attention. Aging analysis helps prioritize workload and identify bottlenecks in the fulfillment process.",
  "agingColumns.band": "Age Band",
  "agingColumns.open": "Open Requests",
  "agingColumns.risk": "Risk Level",
  riskCritical: "Critical — likely overdue",
  riskAtRisk: "At risk",
  riskOnTrack: "On track",
  "dsarTypes.ACCESS": "Access (Right of Access)",
  "dsarTypes.ERASURE": "Erasure (Right to be Forgotten)",
  "dsarTypes.RECTIFICATION": "Rectification",
  "dsarTypes.PORTABILITY": "Data Portability",
  "dsarTypes.OBJECTION": "Objection to Processing",
  "dsarTypes.RESTRICTION": "Restriction of Processing",
  "dsarTypes.WITHDRAW_CONSENT": "Withdraw Consent",
  "dsarTypes.AUTOMATED_DECISION": "Automated Decision Review",
  "dsarTypes.OTHER": "Other",
};

function fallbackT(key: string, values?: Record<string, string | number | Date>): string {
  const template = EN_FALLBACK[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, v) => String(values[v] ?? ""));
}

// ── Component ────────────────────────────────────────────

export function DSARPerformanceReport({
  data,
  t,
  locale,
}: {
  data: DSARPerformanceData;
  /** Scoped to `pdf.dsarPerformance`. Optional — falls back to English. */
  t?: PdfT;
  /** BCP-47 locale for PDF metadata. */
  locale?: string;
}) {
  const tr: PdfT = t ?? fallbackT;
  const orgName = data.organization.name;
  const date = data.generatedAt;
  const { stats } = data;
  const pct = (n: number) =>
    stats.total > 0 ? `${Math.round((n / stats.total) * 100)}%` : "0%";
  const riskFor = (band: string) =>
    band.includes("30+") || band.includes("45+")
      ? tr("riskCritical")
      : band.includes("14-")
        ? tr("riskAtRisk")
        : tr("riskOnTrack");

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
          <StatCard value={stats.total} label={tr("stats.totalRequests")} />
          <StatCard value={`${stats.onTimeRate}%`} label={tr("stats.onTimeRate")} />
          <StatCard
            value={
              stats.avgResolutionDays > 0
                ? `${stats.avgResolutionDays}d`
                : tr("stats.notAvailable")
            }
            label={tr("stats.avgResolution")}
          />
          <StatCard value={stats.overdue} label={tr("stats.overdue")} />
        </View>

        <ProgressBar percent={stats.onTimeRate} />

        <MetadataBlock
          items={[
            { label: tr("meta.organization"), value: orgName },
            { label: tr("meta.reportDate"), value: date },
            {
              label: tr("meta.primaryJurisdiction"),
              value: data.primaryJurisdiction || tr("meta.primaryJurisdictionNotSet"),
            },
            {
              label: tr("meta.defaultDeadline"),
              value: tr("defaultDeadlineDays", { count: data.primaryDeadlineDays }),
            },
            { label: tr("meta.totalRequests"), value: String(stats.total) },
            { label: tr("meta.completed"), value: String(stats.completed) },
            { label: tr("meta.currentlyOpen"), value: String(stats.open) },
            {
              label: tr("meta.completedLast30Days"),
              value: String(stats.completedLast30Days),
            },
            { label: tr("meta.autoRedacted"), value: String(stats.redacted) },
          ]}
        />

        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>{tr("privacyByDesign")}</Text>
          <Text style={s.calloutText}>{tr("privacyByDesignBody")}</Text>
        </View>
      </ContentPage>

      {/* ── Request Volume by Type ────────────────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("requestAnalysis")}</Text>

        <AccentSectionHeader title={tr("byType")} description={tr("byTypeDesc")} />

        <DataTable
          headers={[
            tr("typeColumns.type"),
            tr("typeColumns.count"),
            tr("typeColumns.percentage"),
          ]}
          colWidths={[4, 1, 1.5]}
          rows={data.byType
            .sort((a, b) => b.count - a.count)
            .map((typ) => [tr(`dsarTypes.${typ.type}`), String(typ.count), pct(typ.count)])}
        />

        <AccentSectionHeader title={tr("byStatus")} description={tr("byStatusDesc")} />

        <DataTable
          headers={[
            tr("statusColumns.status"),
            tr("statusColumns.count"),
            tr("statusColumns.percentage"),
          ]}
          colWidths={[3, 1, 1.5]}
          rows={data.byStatus
            .sort((a, b) => b.count - a.count)
            .map((st) => [statusLabel(st.status), String(st.count), pct(st.count)])}
        />
      </ContentPage>

      {/* ── SLA Compliance by Jurisdiction ─────────────── */}
      {data.jurisdictionSLA.length > 0 && (
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("slaCompliance")}</Text>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("slaDesc")}</Text>

          <DataTable
            headers={[
              tr("slaColumns.jurisdiction"),
              tr("slaColumns.deadline"),
              tr("slaColumns.avgResolution"),
              tr("slaColumns.status"),
            ]}
            colWidths={[3, 1.2, 1.5, 1.5]}
            rows={data.jurisdictionSLA.map((j) => [
              j.name,
              tr("slaDays", { days: j.deadlineDays }),
              stats.avgResolutionDays > 0
                ? tr("slaDays", { days: stats.avgResolutionDays })
                : tr("stats.notAvailable"),
              j.status,
            ])}
          />
        </ContentPage>
      )}

      {/* ── Monthly Trend ─────────────────────────────── */}
      {data.monthlyTrend.length > 0 && (
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("monthlyTrend")}</Text>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("monthlyTrendDesc")}</Text>

          <DataTable
            headers={[
              tr("monthlyColumns.month"),
              tr("monthlyColumns.received"),
              tr("monthlyColumns.completed"),
              tr("monthlyColumns.backlog"),
            ]}
            colWidths={[2, 1.5, 1.5, 1.5]}
            rows={data.monthlyTrend.map((m) => [
              m.month,
              String(m.received),
              String(m.completed),
              String(Math.max(0, m.received - m.completed)),
            ])}
          />
        </ContentPage>
      )}

      {/* ── Aging Analysis ────────────────────────────── */}
      {data.aging.some((a) => a.count > 0) && (
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("openRequestAging")}</Text>

          <View style={s.statsGrid}>
            {data.aging.map((band) => (
              <StatCard key={band.band} value={band.count} label={band.band} />
            ))}
          </View>

          <Text style={[s.paragraph, { marginTop: 12 }]}>{tr("agingDesc")}</Text>

          <DataTable
            headers={[
              tr("agingColumns.band"),
              tr("agingColumns.open"),
              tr("agingColumns.risk"),
            ]}
            colWidths={[2, 1.5, 2]}
            rows={data.aging.map((a) => [a.band, String(a.count), riskFor(a.band)])}
          />
        </ContentPage>
      )}
    </Document>
  );
}
