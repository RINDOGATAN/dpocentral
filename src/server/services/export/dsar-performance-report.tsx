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

const TYPE_LABELS: Record<string, string> = {
  ACCESS: "Access (Right of Access)",
  ERASURE: "Erasure (Right to be Forgotten)",
  RECTIFICATION: "Rectification",
  PORTABILITY: "Data Portability",
  OBJECTION: "Objection to Processing",
  RESTRICTION: "Restriction of Processing",
  WITHDRAW_CONSENT: "Withdraw Consent",
  AUTOMATED_DECISION: "Automated Decision Review",
  OTHER: "Other",
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

// ── Component ────────────────────────────────────────────

export function DSARPerformanceReport({
  data,
}: {
  data: DSARPerformanceData;
}) {
  const orgName = data.organization.name;
  const date = data.generatedAt;
  const { stats } = data;

  return (
    <Document>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>DSAR Performance Report</Text>
        <Text style={s.coverSubtitle}>
          Data Subject Access Request Compliance & Metrics
        </Text>
        <Text style={s.coverDate}>Generated: {date}</Text>
        <Text style={s.coverConfidential}>
          CONFIDENTIAL — This report contains aggregated performance metrics
          for data subject request handling. No individual personal data is
          included in this report.
        </Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title="DSAR Performance" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Executive Summary</Text>

        <View style={s.statsGrid}>
          <StatCard value={stats.total} label="Total Requests" />
          <StatCard value={`${stats.onTimeRate}%`} label="On-Time Rate" />
          <StatCard
            value={stats.avgResolutionDays > 0 ? `${stats.avgResolutionDays}d` : "N/A"}
            label="Avg Resolution"
          />
          <StatCard value={stats.overdue} label="Overdue" />
        </View>

        <ProgressBar percent={stats.onTimeRate} />

        <MetadataBlock
          items={[
            { label: "Organization", value: orgName },
            { label: "Report Date", value: date },
            { label: "Primary Jurisdiction", value: data.primaryJurisdiction || "Not set" },
            { label: "Default Deadline", value: `${data.primaryDeadlineDays} days` },
            { label: "Total Requests", value: String(stats.total) },
            { label: "Completed", value: String(stats.completed) },
            { label: "Currently Open", value: String(stats.open) },
            { label: "Completed (Last 30 Days)", value: String(stats.completedLast30Days) },
            { label: "Auto-Redacted", value: String(stats.redacted) },
          ]}
        />

        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>Privacy by Design</Text>
          <Text style={s.calloutText}>
            This report contains no individual personal data. All metrics are
            aggregated. Completed DSAR records are automatically redacted after
            the configured retention period to minimize data protection risk.
          </Text>
        </View>
      </ContentPage>

      {/* ── Request Volume by Type ────────────────────── */}
      <ContentPage title="DSAR Performance" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Request Analysis</Text>

        <AccentSectionHeader
          title="By Request Type"
          description="Distribution of data subject requests by type of right exercised"
        />

        <DataTable
          headers={["Request Type", "Count", "Percentage"]}
          colWidths={[4, 1, 1.5]}
          rows={data.byType
            .sort((a, b) => b.count - a.count)
            .map((t) => [
              TYPE_LABELS[t.type] || t.type,
              String(t.count),
              stats.total > 0
                ? `${Math.round((t.count / stats.total) * 100)}%`
                : "0%",
            ])}
        />

        <AccentSectionHeader
          title="By Status"
          description="Current status distribution of all requests"
        />

        <DataTable
          headers={["Status", "Count", "Percentage"]}
          colWidths={[3, 1, 1.5]}
          rows={data.byStatus
            .sort((a, b) => b.count - a.count)
            .map((s) => [
              statusLabel(s.status),
              String(s.count),
              stats.total > 0
                ? `${Math.round((s.count / stats.total) * 100)}%`
                : "0%",
            ])}
        />
      </ContentPage>

      {/* ── SLA Compliance by Jurisdiction ─────────────── */}
      {data.jurisdictionSLA.length > 0 && (
        <ContentPage title="DSAR Performance" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>SLA Compliance by Jurisdiction</Text>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>
            DSAR response deadlines vary by jurisdiction. Where multiple
            jurisdictions apply, the strictest deadline should prevail. Average
            resolution time is compared against each framework's deadline.
          </Text>

          <DataTable
            headers={["Jurisdiction", "Deadline", "Avg Resolution", "Status"]}
            colWidths={[3, 1.2, 1.5, 1.5]}
            rows={data.jurisdictionSLA.map((j) => [
              j.name,
              `${j.deadlineDays} days`,
              stats.avgResolutionDays > 0 ? `${stats.avgResolutionDays} days` : "N/A",
              j.status,
            ])}
          />
        </ContentPage>
      )}

      {/* ── Monthly Trend ─────────────────────────────── */}
      {data.monthlyTrend.length > 0 && (
        <ContentPage title="DSAR Performance" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>Monthly Trend</Text>

          <Text style={[s.paragraph, { marginBottom: 12 }]}>
            Request volume and completion rate over the last 12 months.
            Monitoring trends helps anticipate resource needs and identify
            seasonal patterns.
          </Text>

          <DataTable
            headers={["Month", "Received", "Completed", "Backlog"]}
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
        <ContentPage title="DSAR Performance" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>Open Request Aging</Text>

          <View style={s.statsGrid}>
            {data.aging.map((band) => (
              <StatCard key={band.band} value={band.count} label={band.band} />
            ))}
          </View>

          <Text style={[s.paragraph, { marginTop: 12 }]}>
            Requests aged beyond the jurisdiction's deadline require immediate
            attention. Aging analysis helps prioritize workload and identify
            bottlenecks in the fulfillment process.
          </Text>

          <DataTable
            headers={["Age Band", "Open Requests", "Risk Level"]}
            colWidths={[2, 1.5, 2]}
            rows={data.aging.map((a) => [
              a.band,
              String(a.count),
              a.band.includes("30+") || a.band.includes("45+")
                ? "Critical — likely overdue"
                : a.band.includes("14-")
                  ? "At risk"
                  : "On track",
            ])}
          />
        </ContentPage>
      )}
    </Document>
  );
}
