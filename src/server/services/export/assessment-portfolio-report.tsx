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
import type { PdfT } from "./privacy-program/data-mapping";

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

// Compact fallback — values mirror the en.json entries so unmigrated callers still render English.
function fallbackT(key: string, values?: Record<string, string | number | Date>): string {
  const t: Record<string, string> = {
    coverTitle: "Impact Assessment Portfolio",
    coverSubtitle: "DPIA, LIA & Privacy Assessment Status Report",
    coverGenerated: "Generated: {date}",
    coverConfidential:
      "CONFIDENTIAL — This document summarises the organisation's privacy impact assessment program. It is intended for DPOs, privacy officers, and supervisory authorities upon request.",
    pageTitle: "Assessment Portfolio",
    executiveSummary: "Executive Summary",
    "stats.total": "Total Assessments",
    "stats.approved": "Approved",
    "stats.highCriticalRisk": "High / Critical Risk",
    "stats.avgCompletion": "Avg Completion",
    "meta.organization": "Organization",
    "meta.reportDate": "Report Date",
    "meta.typesUsed": "Assessment Types Used",
    "meta.typesUsedNone": "None",
    "meta.totalMitigations": "Total Mitigations",
    "meta.mitigationsCompleted": "Mitigations Completed",
    "meta.mitigationsCompletedValue": "{done} of {total}",
    "meta.overdueAssessments": "Overdue Assessments",
    "meta.overdueNone": "None",
    gdprCalloutTitle: "GDPR Article 35 — Impact Assessment Obligations",
    gdprCalloutBody:
      "Controllers must carry out a DPIA before processing that is likely to result in a high risk to the rights and freedoms of natural persons. The assessment must be reviewed and updated when processing operations change.",
    overview: "Assessment Overview",
    byStatus: "By Status",
    byStatusDesc: "Current status of all assessments across the organisation",
    "statusColumns.status": "Status",
    "statusColumns.count": "Count",
    "statusColumns.percentage": "Percentage",
    byType: "By Type",
    byTypeDesc: "Distribution across assessment types",
    "typeColumns.type": "Assessment Type",
    "typeColumns.count": "Count",
    "typeColumns.approved": "Approved",
    "typeColumns.highRisk": "High Risk",
    byRiskLevel: "By Risk Level",
    byRiskLevelDesc: "Risk classification across all assessed activities",
    "riskStats.low": "Low Risk",
    "riskStats.medium": "Medium Risk",
    "riskStats.high": "High Risk",
    "riskStats.critical": "Critical",
    register: "Assessment Register",
    registerDesc:
      "Complete inventory of {count} assessments with current status, risk level, completion, and linked processing activities or vendors.",
    "registerColumns.name": "Name",
    "registerColumns.type": "Type",
    "registerColumns.status": "Status",
    "registerColumns.risk": "Risk",
    "registerColumns.completion": "Completion",
    "registerColumns.due": "Due",
    highRiskTitle: "High & Critical Risk Assessments",
    highRiskDesc:
      "The following assessments have been classified as high or critical risk and require priority attention, mitigation measures, and regular review.",
    "highRiskMeta.type": "Type",
    "highRiskMeta.riskScore": "Risk Score",
    "highRiskMeta.completion": "Completion",
    "highRiskMeta.linkedActivity": "Linked Activity",
    "highRiskMeta.linkedVendor": "Linked Vendor",
    "highRiskMeta.mitigations": "Mitigations",
    "highRiskMeta.mitigationsValue": "{done}/{total} completed",
    "highRiskMeta.dueDate": "Due Date",
    overdueTitle: "Overdue Assessments",
    "overdueColumns.name": "Name",
    "overdueColumns.type": "Type",
    "overdueColumns.status": "Status",
    "overdueColumns.dueDate": "Due Date",
    "overdueColumns.daysOverdue": "Days Overdue",
    mitigationOverview: "Mitigation Measures Overview",
    "mitigationStats.total": "Total Mitigations",
    "mitigationStats.completed": "Completed",
    "mitigationStats.outstanding": "Outstanding",
    "mitigationStats.completionRate": "Completion Rate",
    "mitigationStats.notAvailable": "N/A",
    mitigationDesc:
      'Mitigation measures are tracked across all assessments to ensure identified risks are addressed with appropriate safeguards. Measures with status "Implemented" or "Verified" are counted as completed.',
    "mitigationColumns.assessment": "Assessment",
    "mitigationColumns.type": "Type",
    "mitigationColumns.total": "Total",
    "mitigationColumns.completed": "Completed",
    "mitigationColumns.rate": "Rate",
    perTypeCount: "{type} ({count})",
    "assessmentMeta.completion": "Completion:",
    "assessmentMeta.completionValue": "{pct}% ({answered}/{total} questions)",
    "assessmentMeta.activity": "Activity:",
    "assessmentMeta.vendor": "Vendor:",
    "assessmentMeta.mitigations": "Mitigations:",
    "assessmentMeta.mitigationsValue": "{done}/{total} completed",
    "assessmentMeta.started": "Started:",
    "assessmentMeta.completed": "Completed:",
    "assessmentTypes.DPIA": "Data Protection Impact Assessment",
    "assessmentTypes.PIA": "Privacy Impact Assessment",
    "assessmentTypes.TIA": "Transfer Impact Assessment",
    "assessmentTypes.LIA": "Legitimate Interest Assessment",
    "assessmentTypes.VENDOR": "Vendor Risk Assessment",
    "assessmentTypes.CUSTOM": "Custom Assessment",
  };
  const template = t[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, v) => String(values[v] ?? ""));
}

// ── Component ────────────────────────────────────────────

export function AssessmentPortfolioReport({
  data,
  t,
  locale,
}: {
  data: AssessmentPortfolioData;
  /** Scoped to `pdf.assessmentPortfolio`. Optional — English fallback. */
  t?: PdfT;
  locale?: string;
}) {
  const tr: PdfT = t ?? fallbackT;
  const orgName = data.organization.name;
  const date = data.generatedAt;
  const { stats, assessments } = data;
  const typeLabel = (type: string) => tr(`assessmentTypes.${type}`);

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
          <StatCard value={stats.total} label={tr("stats.total")} />
          <StatCard value={stats.approved} label={tr("stats.approved")} />
          <StatCard value={highRisk.length} label={tr("stats.highCriticalRisk")} />
          <StatCard value={`${stats.avgCompletion}%`} label={tr("stats.avgCompletion")} />
        </View>

        <ProgressBar percent={stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0} />

        <MetadataBlock
          items={[
            { label: tr("meta.organization"), value: orgName },
            { label: tr("meta.reportDate"), value: date },
            {
              label: tr("meta.typesUsed"),
              value:
                Object.keys(stats.byType).filter((k) => stats.byType[k] > 0).join(", ") ||
                tr("meta.typesUsedNone"),
            },
            { label: tr("meta.totalMitigations"), value: String(stats.totalMitigations) },
            {
              label: tr("meta.mitigationsCompleted"),
              value: tr("meta.mitigationsCompletedValue", {
                done: stats.mitigationsCompleted,
                total: stats.totalMitigations,
              }),
            },
            {
              label: tr("meta.overdueAssessments"),
              value: overdue.length > 0 ? String(overdue.length) : tr("meta.overdueNone"),
            },
          ]}
        />

        <View style={s.calloutBox}>
          <Text style={s.calloutTitle}>{tr("gdprCalloutTitle")}</Text>
          <Text style={s.calloutText}>{tr("gdprCalloutBody")}</Text>
        </View>
      </ContentPage>

      {/* ── Status Distribution ───────────────────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("overview")}</Text>

        <AccentSectionHeader
          title={tr("byStatus")}
          description={tr("byStatusDesc")}
        />

        <DataTable
          headers={[
            tr("statusColumns.status"),
            tr("statusColumns.count"),
            tr("statusColumns.percentage"),
          ]}
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
          title={tr("byType")}
          description={tr("byTypeDesc")}
        />

        <DataTable
          headers={[
            tr("typeColumns.type"),
            tr("typeColumns.count"),
            tr("typeColumns.approved"),
            tr("typeColumns.highRisk"),
          ]}
          colWidths={[3.5, 1, 1, 1.5]}
          rows={Array.from(byType.entries()).map(([type, items]) => [
            typeLabel(type),
            String(items.length),
            String(items.filter((a) => a.status === "APPROVED").length),
            String(items.filter((a) => a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL").length),
          ])}
        />

        {/* Risk distribution */}
        {Object.values(stats.byRiskLevel).some((v) => v > 0) && (
          <>
            <AccentSectionHeader
              title={tr("byRiskLevel")}
              description={tr("byRiskLevelDesc")}
            />

            <View style={s.statsGrid}>
              <StatCard value={stats.byRiskLevel["LOW"] ?? 0} label={tr("riskStats.low")} />
              <StatCard value={stats.byRiskLevel["MEDIUM"] ?? 0} label={tr("riskStats.medium")} />
              <StatCard value={stats.byRiskLevel["HIGH"] ?? 0} label={tr("riskStats.high")} />
              <StatCard value={stats.byRiskLevel["CRITICAL"] ?? 0} label={tr("riskStats.critical")} />
            </View>
          </>
        )}
      </ContentPage>

      {/* ── Full Assessment Register ──────────────────── */}
      <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("register")}</Text>

        <Text style={[s.paragraph, { marginBottom: 12 }]}>
          {tr("registerDesc", { count: stats.total })}
        </Text>

        <DataTable
          headers={[
            tr("registerColumns.name"),
            tr("registerColumns.type"),
            tr("registerColumns.status"),
            tr("registerColumns.risk"),
            tr("registerColumns.completion"),
            tr("registerColumns.due"),
          ]}
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
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          {highRisk.length > 0 && (
            <>
              <Text style={s.sectionTitle}>{tr("highRiskTitle")}</Text>

              <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("highRiskDesc")}</Text>

              {highRisk.map((a) => (
                <View key={a.id} style={s.questionCard} wrap={false}>
                  <View style={[s.row, { marginBottom: 4, gap: 8 }]}>
                    <Text style={s.questionText}>{a.name}</Text>
                    <RiskBadge level={a.riskLevel} />
                    <StatusBadge status={a.status} />
                  </View>
                  <MetadataBlock
                    items={[
                      { label: tr("highRiskMeta.type"), value: typeLabel(a.templateType) },
                      { label: tr("highRiskMeta.riskScore"), value: a.riskScore != null ? a.riskScore.toFixed(1) : null },
                      { label: tr("highRiskMeta.completion"), value: `${a.completionPercentage}%` },
                      { label: tr("highRiskMeta.linkedActivity"), value: a.linkedActivity },
                      { label: tr("highRiskMeta.linkedVendor"), value: a.linkedVendor },
                      {
                        label: tr("highRiskMeta.mitigations"),
                        value: tr("highRiskMeta.mitigationsValue", {
                          done: a.mitigationsCompleted,
                          total: a.mitigationCount,
                        }),
                      },
                      { label: tr("highRiskMeta.dueDate"), value: fmtDate(a.dueDate) },
                    ]}
                  />
                </View>
              ))}
            </>
          )}

          {overdue.length > 0 && (
            <>
              <Text style={s.sectionTitle}>{tr("overdueTitle")}</Text>

              <DataTable
                headers={[
                  tr("overdueColumns.name"),
                  tr("overdueColumns.type"),
                  tr("overdueColumns.status"),
                  tr("overdueColumns.dueDate"),
                  tr("overdueColumns.daysOverdue"),
                ]}
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
        <ContentPage title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("mitigationOverview")}</Text>

          <View style={s.statsGrid}>
            <StatCard value={stats.totalMitigations} label={tr("mitigationStats.total")} />
            <StatCard value={stats.mitigationsCompleted} label={tr("mitigationStats.completed")} />
            <StatCard
              value={stats.totalMitigations - stats.mitigationsCompleted}
              label={tr("mitigationStats.outstanding")}
            />
            <StatCard
              value={
                stats.totalMitigations > 0
                  ? `${Math.round((stats.mitigationsCompleted / stats.totalMitigations) * 100)}%`
                  : tr("mitigationStats.notAvailable")
              }
              label={tr("mitigationStats.completionRate")}
            />
          </View>

          <ProgressBar
            percent={
              stats.totalMitigations > 0
                ? Math.round((stats.mitigationsCompleted / stats.totalMitigations) * 100)
                : 0
            }
          />

          <Text style={[s.paragraph, { marginBottom: 12 }]}>{tr("mitigationDesc")}</Text>

          {/* Per-assessment mitigation breakdown */}
          <DataTable
            headers={[
              tr("mitigationColumns.assessment"),
              tr("mitigationColumns.type"),
              tr("mitigationColumns.total"),
              tr("mitigationColumns.completed"),
              tr("mitigationColumns.rate"),
            ]}
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
        <ContentPage key={type} title={tr("pageTitle")} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>
            {tr("perTypeCount", { type: typeLabel(type), count: items.length })}
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
                  <Text style={[s.metaLabel, { width: 100 }]}>{tr("assessmentMeta.completion")}</Text>
                  <Text style={s.metaValue}>
                    {tr("assessmentMeta.completionValue", {
                      pct: a.completionPercentage,
                      answered: a.responseCount,
                      total: a.totalQuestions,
                    })}
                  </Text>
                </View>
                {a.linkedActivity && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>{tr("assessmentMeta.activity")}</Text>
                    <Text style={s.metaValue}>{a.linkedActivity}</Text>
                  </View>
                )}
                {a.linkedVendor && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>{tr("assessmentMeta.vendor")}</Text>
                    <Text style={s.metaValue}>{a.linkedVendor}</Text>
                  </View>
                )}
                {a.mitigationCount > 0 && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>{tr("assessmentMeta.mitigations")}</Text>
                    <Text style={s.metaValue}>
                      {tr("assessmentMeta.mitigationsValue", {
                        done: a.mitigationsCompleted,
                        total: a.mitigationCount,
                      })}
                    </Text>
                  </View>
                )}
                <View style={s.row}>
                  <Text style={[s.metaLabel, { width: 100 }]}>{tr("assessmentMeta.started")}</Text>
                  <Text style={s.metaValue}>{fmtDate(a.startedAt)}</Text>
                </View>
                {a.completedAt && (
                  <View style={s.row}>
                    <Text style={[s.metaLabel, { width: 100 }]}>{tr("assessmentMeta.completed")}</Text>
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
