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
  StatusBadge,
  s,
  PDF_COLORS,
  fmtDate,
} from "./pdf-styles";
import { Page } from "@react-pdf/renderer";

// ── Types ────────────────────────────────────────────────

export interface PortfolioAssessment {
  id: string;
  name: string;
  status: string;
  riskLevel: string | null;
  riskScore: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  dueDate: Date | null;
  completionPercentage: number;
  templateType: string;
  templateName: string;
  linkedActivity: string | null;
  linkedVendor: string | null;
  mitigationCount: number;
  mitigationsCompleted: number;
  approvalStatus: string | null; // latest approval status
  responseCount: number;
  totalQuestions: number;
}

export interface AssessmentPortfolioData {
  organization: { name: string };
  generatedAt: string;
  assessments: PortfolioAssessment[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byRiskLevel: Record<string, number>;
    approved: number;
    overdue: number;
    avgCompletion: number;
    totalMitigations: number;
    mitigationsCompleted: number;
  };
}

// ── Helpers ──────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

const STATUS_ORDER = [
  "DRAFT",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

// ── Component ────────────────────────────────────────────

export function AssessmentPortfolioReport({
  data,
}: {
  data: AssessmentPortfolioData;
}) {
  const orgName = data.organization.name;
  const date = data.generatedAt;
  const { stats, assessments } = data;

  // Group by type
  const byType = new Map<string, PortfolioAssessment[]>();
  for (const a of assessments) {
    if (!byType.has(a.templateType)) byType.set(a.templateType, []);
    byType.get(a.templateType)!.push(a);
  }

  // High risk assessments
  const highRisk = assessments.filter(
    (a) => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL"
  );

  // Overdue (due date in past, not approved/completed)
  const now = new Date();
  const overdue = assessments.filter(
    (a) =>
      a.dueDate &&
      new Date(a.dueDate) < now &&
      !["APPROVED", "ARCHIVED"].includes(a.status)
  );

  return (
    <Document>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>Impact Assessment Portfolio</Text>
        <Text style={s.coverSubtitle}>
          DPIA, LIA & Privacy Assessment Status Report
        </Text>
        <Text style={s.coverDate}>Generated: {date}</Text>
        <Text style={s.coverConfidential}>
          CONFIDENTIAL — This document summarizes the organization's privacy
          impact assessment program. It is intended for DPOs, privacy officers,
          and supervisory authorities upon request.
        </Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title="Assessment Portfolio" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Executive Summary</Text>

        <View style={s.statsGrid}>
          <StatCard value={stats.total} label="Total Assessments" />
          <StatCard value={stats.approved} label="Approved" />
          <StatCard value={highRisk.length} label="High / Critical Risk" />
          <StatCard value={`${stats.avgCompletion}%`} label="Avg Completion" />
        </View>

        <ProgressBar percent={stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0} />

        <MetadataBlock
          items={[
            { label: "Organization", value: orgName },
            { label: "Report Date", value: date },
            { label: "Assessment Types Used", value: Object.keys(stats.byType).filter((k) => stats.byType[k] > 0).map((k) => k).join(", ") || "None" },
            { label: "Total Mitigations", value: String(stats.totalMitigations) },
            { label: "Mitigations Completed", value: `${stats.mitigationsCompleted} of ${stats.totalMitigations}` },
            { label: "Overdue Assessments", value: overdue.length > 0 ? String(overdue.length) : "None" },
          ]}
        />

        {/* GDPR compliance callout */}
        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>
            GDPR Article 35 — Impact Assessment Obligations
          </Text>
          <Text style={s.calloutText}>
            Controllers must carry out a DPIA before processing that is likely
            to result in a high risk to the rights and freedoms of natural
            persons. The assessment must be reviewed and updated when processing
            operations change.
          </Text>
        </View>
      </ContentPage>

      {/* ── Status Distribution ───────────────────────── */}
      <ContentPage title="Assessment Portfolio" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Assessment Overview</Text>

        <AccentSectionHeader
          title="By Status"
          description="Current status of all assessments across the organization"
        />

        <DataTable
          headers={["Status", "Count", "Percentage"]}
          colWidths={[3, 1, 1.5]}
          rows={STATUS_ORDER
            .filter((status) => (stats.byStatus[status] ?? 0) > 0)
            .map((status) => [
              statusLabel(status),
              String(stats.byStatus[status] ?? 0),
              stats.total > 0
                ? `${Math.round(((stats.byStatus[status] ?? 0) / stats.total) * 100)}%`
                : "0%",
            ])}
        />

        <AccentSectionHeader
          title="By Type"
          description="Distribution across assessment types"
        />

        <DataTable
          headers={["Assessment Type", "Count", "Approved", "High Risk"]}
          colWidths={[3.5, 1, 1, 1.5]}
          rows={Array.from(byType.entries()).map(([type, items]) => [
            TYPE_LABELS[type] || type,
            String(items.length),
            String(items.filter((a) => a.status === "APPROVED").length),
            String(items.filter((a) => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL").length),
          ])}
        />

        {/* Risk distribution */}
        {Object.values(stats.byRiskLevel).some((v) => v > 0) && (
          <>
            <AccentSectionHeader
              title="By Risk Level"
              description="Risk classification across all assessed activities"
            />

            <View style={s.statsGrid}>
              <StatCard value={stats.byRiskLevel["LOW"] ?? 0} label="Low Risk" />
              <StatCard value={stats.byRiskLevel["MEDIUM"] ?? 0} label="Medium Risk" />
              <StatCard value={stats.byRiskLevel["HIGH"] ?? 0} label="High Risk" />
              <StatCard value={stats.byRiskLevel["CRITICAL"] ?? 0} label="Critical" />
            </View>
          </>
        )}
      </ContentPage>

      {/* ── Full Assessment Register ──────────────────── */}
      <ContentPage title="Assessment Portfolio" orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Assessment Register</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          Complete inventory of {stats.total} assessments with current status,
          risk level, completion, and linked processing activities or vendors.
        </Text>

        <DataTable
          headers={["Name", "Type", "Status", "Risk", "Completion", "Due"]}
          colWidths={[3, 1, 1.5, 1, 1, 1.2]}
          rows={assessments.map((a) => [
            a.name.length > 40 ? a.name.slice(0, 37) + "..." : a.name,
            a.templateType,
            statusLabel(a.status),
            a.riskLevel || "—",
            `${a.completionPercentage}%`,
            fmtDate(a.dueDate),
          ])}
        />
      </ContentPage>

      {/* ── High Risk & Overdue Detail ────────────────── */}
      {(highRisk.length > 0 || overdue.length > 0) && (
        <ContentPage title="Assessment Portfolio" orgName={orgName} date={date}>
          {highRisk.length > 0 && (
            <>
              <Text style={s.sectionTitle}>High & Critical Risk Assessments</Text>

              <Text style={[s.paragraph, { marginBottom: 12 }]}>
                The following assessments have been classified as high or critical
                risk and require priority attention, mitigation measures, and
                regular review.
              </Text>

              {highRisk.map((a) => (
                <View key={a.id} style={s.questionCard} wrap={false}>
                  <View style={[s.row, { marginBottom: 4, gap: 8 }]}>
                    <Text style={s.questionText}>{a.name}</Text>
                    <RiskBadge level={a.riskLevel} />
                    <StatusBadge status={a.status} />
                  </View>
                  <MetadataBlock
                    items={[
                      { label: "Type", value: TYPE_LABELS[a.templateType] || a.templateType },
                      { label: "Risk Score", value: a.riskScore != null ? a.riskScore.toFixed(1) : null },
                      { label: "Completion", value: `${a.completionPercentage}%` },
                      { label: "Linked Activity", value: a.linkedActivity },
                      { label: "Linked Vendor", value: a.linkedVendor },
                      { label: "Mitigations", value: `${a.mitigationsCompleted}/${a.mitigationCount} completed` },
                      { label: "Due Date", value: fmtDate(a.dueDate) },
                    ]}
                  />
                </View>
              ))}
            </>
          )}

          {overdue.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Overdue Assessments</Text>

              <DataTable
                headers={["Name", "Type", "Status", "Due Date", "Days Overdue"]}
                colWidths={[3, 1, 1.5, 1.5, 1.2]}
                rows={overdue.map((a) => {
                  const daysOver = a.dueDate
                    ? Math.ceil((now.getTime() - new Date(a.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return [
                    a.name.length > 35 ? a.name.slice(0, 32) + "..." : a.name,
                    a.templateType,
                    statusLabel(a.status),
                    fmtDate(a.dueDate),
                    `${daysOver}d`,
                  ];
                })}
              />
            </>
          )}
        </ContentPage>
      )}

      {/* ── Mitigations Summary ───────────────────────── */}
      {stats.totalMitigations > 0 && (
        <ContentPage title="Assessment Portfolio" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>Mitigation Measures Overview</Text>

          <View style={s.statsGrid}>
            <StatCard value={stats.totalMitigations} label="Total Mitigations" />
            <StatCard value={stats.mitigationsCompleted} label="Completed" />
            <StatCard
              value={stats.totalMitigations - stats.mitigationsCompleted}
              label="Outstanding"
            />
            <StatCard
              value={
                stats.totalMitigations > 0
                  ? `${Math.round((stats.mitigationsCompleted / stats.totalMitigations) * 100)}%`
                  : "N/A"
              }
              label="Completion Rate"
            />
          </View>

          <ProgressBar
            percent={
              stats.totalMitigations > 0
                ? Math.round((stats.mitigationsCompleted / stats.totalMitigations) * 100)
                : 0
            }
          />

          <Text style={[s.paragraph, { marginBottom: 12 }]}>
            Mitigation measures are tracked across all assessments to ensure
            identified risks are addressed with appropriate safeguards. Measures
            with status "Implemented" or "Verified" are counted as completed.
          </Text>

          {/* Per-assessment mitigation breakdown */}
          <DataTable
            headers={["Assessment", "Type", "Total", "Completed", "Rate"]}
            colWidths={[3, 1, 1, 1.2, 1]}
            rows={assessments
              .filter((a) => a.mitigationCount > 0)
              .map((a) => [
                a.name.length > 35 ? a.name.slice(0, 32) + "..." : a.name,
                a.templateType,
                String(a.mitigationCount),
                String(a.mitigationsCompleted),
                `${a.mitigationCount > 0 ? Math.round((a.mitigationsCompleted / a.mitigationCount) * 100) : 0}%`,
              ])}
          />
        </ContentPage>
      )}

      {/* ── Per-Type Detail Pages ─────────────────────── */}
      {Array.from(byType.entries()).map(([type, items]) => (
        <ContentPage key={type} title="Assessment Portfolio" orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>
            {TYPE_LABELS[type] || type} ({items.length})
          </Text>

          {items.map((a) => (
            <View key={a.id} style={s.questionCard} wrap={false}>
              <View style={[s.row, { marginBottom: 4, gap: 6 }]}>
                <Text style={s.questionNumber}>{a.templateType}</Text>
                <Text style={[s.questionText, { flex: 1 }]}>{a.name}</Text>
                {a.riskLevel && <RiskBadge level={a.riskLevel} />}
                <StatusBadge status={a.status} />
              </View>
              <View style={{ marginTop: 4 }}>
                <View style={s.row}>
                  <Text style={[s.metaLabel, { width: 100 }]}>Completion:</Text>
                  <Text style={s.metaValue}>{a.completionPercentage}% ({a.responseCount}/{a.totalQuestions} questions)</Text>
                </View>
                {a.linkedActivity && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>Activity:</Text>
                    <Text style={s.metaValue}>{a.linkedActivity}</Text>
                  </View>
                )}
                {a.linkedVendor && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>Vendor:</Text>
                    <Text style={s.metaValue}>{a.linkedVendor}</Text>
                  </View>
                )}
                {a.mitigationCount > 0 && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>Mitigations:</Text>
                    <Text style={s.metaValue}>{a.mitigationsCompleted}/{a.mitigationCount} completed</Text>
                  </View>
                )}
                <View style={s.row}>
                  <Text style={[s.metaLabel, { width: 100 }]}>Started:</Text>
                  <Text style={s.metaValue}>{fmtDate(a.startedAt)}</Text>
                </View>
                {a.completedAt && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>Completed:</Text>
                    <Text style={s.metaValue}>{fmtDate(a.completedAt)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ContentPage>
      ))}
    </Document>
  );
}
