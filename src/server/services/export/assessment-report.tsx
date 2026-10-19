// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import {
  ContentPage,
  PageHeader,
  PageFooter,
  MetadataBlock,
  DataTable,
  RiskBadge,
  StatCard,
  ProgressBar,
  AccentSectionHeader,
  s,
  PDF_COLORS,
  fmtDate,
} from "./pdf-styles";
import type { PdfT } from "./privacy-program/data-mapping";
import { pdfEnumLabel } from "./pdf-locale";
import { RISK_GRADES, RISK_MATRIX } from "@/lib/assessment-risk-register";
import { HealthAdtechPages } from "./health-adtech-report";
import type { HealthAdtechResult } from "@/lib/health-adtech/results";

// English fallback map (keys scoped to pdf.assessmentReport)
const EN_FALLBACK: Record<string, string> = {
  executiveSummary: "Executive Summary",
  "stats.riskLevel": "Risk Level",
  "stats.completion": "Completion",
  "stats.questionsAnswered": "Questions Answered",
  "stats.mitigations": "Mitigations",
  "stats.notAvailable": "N/A",
  "meta.assessmentType": "Assessment Type",
  "meta.template": "Template",
  "meta.status": "Status",
  "meta.riskScore": "Risk Score",
  "meta.started": "Started",
  "meta.submitted": "Submitted",
  "meta.completed": "Completed",
  "meta.dueDate": "Due Date",
  "meta.linkedActivity": "Linked Activity",
  "meta.linkedVendor": "Linked Vendor",
  description: "Description",
  draftMark: "Draft",
  draftTitle: "This document is a draft",
  draftIntro:
    "The items below are still outstanding, so every page of this document is marked a draft. Answer them in the app and export again for a final version.",
  draftQuestions: "Questions not yet answered",
  draftRequirements: "Requirements not yet covered",
  conformanceTitle: "Framework conformance",
  conformanceIntro:
    "One row per requirement of the frameworks chosen for this assessment, with the step of the assessment that answers it. A requirement nothing answers is marked outstanding.",
  "conformanceColumns.requirement": "Requirement",
  "conformanceColumns.citation": "Source",
  "conformanceColumns.status": "Status",
  "conformanceColumns.step": "Answered in",
  conformanceCovered: "Covered",
  conformanceOutstanding: "Outstanding",
  conformanceNotAnswered: "Not asked in this assessment",
  conformanceCaliforniaNotRequired:
    "No triggering activity applies, so 11 CCR 7150(b) does not require a California risk assessment for this processing.",
  conformanceDisclaimer:
    "This table records which requirements the answers cover.",
  sectionComplete: "Complete",
  questionRequired: "REQUIRED",
  notAnswered: "Not yet answered",
  riskScoreLabel: "Risk Score:",
  noteLabel: "Note:",
  riskAssessmentSummary: "Risk Assessment Summary",
  "stats2.overallRiskLevel": "Overall Risk Level",
  "stats2.riskScore": "Risk Score",
  "stats2.scoredQuestions": "Scored Questions",
  questionRiskScores: "Question Risk Scores",
  "riskColumns.section": "Section",
  "riskColumns.question": "Question",
  "riskColumns.score": "Score",
  "riskColumns.level": "Level",
  mitigationsTitle: "Risk Mitigations",
  "mitigationStats.total": "Total",
  "mitigationStats.completed": "Completed",
  "mitigationStats.outstanding": "Outstanding",
  "mitigationColumns.title": "Title",
  "mitigationColumns.status": "Status",
  "mitigationColumns.priority": "Priority",
  "mitigationColumns.owner": "Owner",
  "mitigationColumns.dueDate": "Due Date",
  "mitigationColumns.evidence": "Evidence",
  yes: "Yes",
  no: "No",
  mitigationDetails: "Mitigation Details",
  approvalHistory: "Approval History",
  "approvalColumns.level": "Level",
  "approvalColumns.approver": "Approver",
  "approvalColumns.status": "Status",
  "approvalColumns.date": "Date",
  "approvalColumns.comments": "Comments",
  "assessmentTypes.DPIA": "Data Protection Impact Assessment",
  "assessmentTypes.PIA": "Privacy Impact Assessment",
  "assessmentTypes.TIA": "Transfer Impact Assessment",
  "assessmentTypes.LIA": "Legitimate Interest Assessment",
  "assessmentTypes.VENDOR": "Vendor Risk Assessment",
  "assessmentTypes.CUSTOM": "Custom Assessment",
  "articleRefs.DPIA": "GDPR Article 35(7)",
  "articleRefs.LIA": "GDPR Article 6(1)(f)",
  "articleRefs.TIA": "GDPR Chapter V (Articles 44 to 49)",
  "articleRefs.VENDOR": "GDPR Article 28",
  "articleRefs.PIA": "",
  "articleRefs.CUSTOM": "",
  approvedIntro: "This document records the assessment as it was approved.",
  approvedLaterRequirements: "Added to the template after this approval, to be answered in a new revision:",
  conformanceRuleNotMet: "Answered, not met",
  "stats.notAssessed": "Not assessed",
  "stats2.inherentRisk": "Inherent risk (before measures)",
  "stats2.residualRisk": "Residual risk (after measures)",
  registerTitle: "Risk register",
  registerIntro:
    "One row per risk to the rights and freedoms of data subjects, graded for likelihood (L) and severity (S) before the measures (inherent) and after them (residual). Scale: 1 negligible, 2 limited, 3 significant, 4 maximum.",
  registerEmpty: "No risk has been entered in the risk register.",
  registerNotGraded: "Not graded",
  "registerColumns.risk": "Risk",
  "registerColumns.rights": "Rights affected",
  "registerColumns.inherent": "Inherent",
  "registerColumns.measures": "Measures",
  "registerColumns.residual": "Residual",
  "registerColumns.status": "Status",
  matrixTitle: "Risk matrix",
  matrixIntro: "Each cell shows how many risks sit there before the measures and, after the slash, after them.",
  matrixLikelihood: "Likelihood",
  matrixSeverity: "Severity",
  "grades.1": "Negligible",
  "grades.2": "Limited",
  "grades.3": "Significant",
  "grades.4": "Maximum",
  signOffTitle: "Conclusion and sign-off",
  notRecorded: "Not recorded",
  "signOff.templateVersion": "Template version",
  "signOff.approvedVersion": "Approved version",
  "signOff.preparedBy": "Prepared by",
  "signOff.dpoAdvice": "Advice of the data protection officer (Art. 35(2) GDPR)",
  "signOff.consultation": "Prior consultation (Art. 36 GDPR)",
  "signOff.consultationRecord": "Consultation: date and outcome",
  "signOff.review": "Review (Art. 35(11) GDPR)",
  "signOff.decision": "Decision",
  "signOff.decidedOn": "Decided on",
  "signOff.signatures": "Signatures",
  "signOff.forController": "For the controller",
  "signOff.dpo": "Data protection officer",
  "signOff.nameAndPosition": "Name and position",
  "signOff.signature": "Signature",
  "signOff.date": "Date",
};

function fallbackT(key: string, values?: Record<string, string | number | Date>): string {
  const templates: Record<string, string> = {
    ...EN_FALLBACK,
    coverGenerated: "Generated: {date}",
    coverConfidential:
      "CONFIDENTIAL. This document contains sensitive information about data protection practices. Distribution should be limited to authorized personnel and supervisory authorities upon request.",
    sectionProgress: "{answered} of {total} questions answered",
    questionNumber: "Q{n}.",
    priorityCode: "P{n}",
    approvalLevel: "Level {n}",
    draftMore: "and {count} more",
    approvedTitle: "Approved on {date}",
    registerPair: "{level} (L{likelihood} × S{severity})",
    registerUnsupported: "Residual risk lowered by two or more levels with no implemented measure: {risks}.",
  };
  const template = templates[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, v) => String(values[v] ?? ""));
}

export interface AssessmentExportData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  riskLevel: string | null;
  riskScore: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  dueDate: Date | null;
  template: {
    type: string;
    name: string;
    version: string;
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      questions: Array<{
        id: string;
        text: string;
        type: string;
        required?: boolean;
        options?: string[];
      }>;
    }>;
  };
  processingActivity: { name: string } | null;
  vendor: { name: string } | null;
  responses: Array<{
    sectionId: string;
    questionId: string;
    response: string;
    riskScore: number | null;
    notes: string | null;
    responder: { name: string | null; email: string } | null;
    respondedAt: Date;
  }>;
  mitigations: Array<{
    title: string;
    description: string | null;
    status: string;
    owner: string | null;
    priority: number;
    dueDate: Date | null;
    completedAt: Date | null;
    evidence: string | null;
  }>;
  approvals: Array<{
    level: number;
    status: string;
    comments: string | null;
    decidedAt: Date | null;
    approver: { name: string | null; email: string };
  }>;
  organization: { name: string };
  completionPercentage: number;
  totalQuestions: number;
  /**
   * Set while anything is outstanding. The export never refuses: it succeeds,
   * marks every page a draft and lists what is missing on the first page.
   */
  draft?: {
    outstandingQuestions: Array<{ sectionTitle: string; text: string }>;
    outstandingRequirements: Array<{ citation: string; label: string }>;
  };
  /**
   * Set when the assessment is approved: it is never marked a draft. Lists
   * what the template asks for that was added after the approval.
   */
  approved?: { date: string; laterRequirements: string[] };
  /** Inherent risk (before measures) and residual risk (after measures), kept apart. */
  inherentRiskLevel?: string | null;
  inherentRiskScore?: number | null;
  residualRiskLevel?: string | null;
  /** The risk register (one row per risk), for DPIAs or wherever it holds rows. */
  register?: {
    rows: Array<{
      title: string;
      description: string | null;
      rightsAffected: string | null;
      likelihood: number;
      severity: number;
      inherent: string | null;
      residualLikelihood: number | null;
      residualSeverity: number | null;
      residual: string | null;
      status: string;
      measures: string[];
    }>;
    /** Titles of risks lowered two levels or more with no implemented measure. */
    unsupported: string[];
  };
  /** The DPIA's conclusion and sign-off page. */
  signOff?: {
    templateVersion: string;
    approvedVersion: number | null;
    preparedBy: string[];
    dpoAdvice: string | null;
    consultation: string | null;
    consultationRecord: string | null;
    review: string | null;
    decision: string;
    decidedAt: Date | null;
  };
  /** The legal source on the cover, from the frameworks chosen (DPIA). */
  citation?: string | null;
  /**
   * The conformance table, already resolved into the report's language.
   * Absent for a template that has no requirement table.
   */
  conformance?: {
    rows: Array<{
      id: string;
      citation: string;
      label: string;
      covered: boolean;
      /** Answered, but the answers do not meet the requirement. */
      ruleNotMet?: boolean;
      /** Section of the assessment that answers it, null when nothing does. */
      step: string | null;
    }>;
    /** One line per framework, already worded (complete or partial). */
    verdicts: string[];
    /** Set when 11 CCR 7150(b) is answered "none of these". */
    californiaNotRequired: boolean;
  };
}

/** How many outstanding items the first page lists before summarising. */
const FIRST_PAGE_OUTSTANDING = 8;

/** A short list of outstanding items; the tail is counted rather than listed. */
function OutstandingList({
  title,
  items,
  more,
}: {
  title: string;
  items: string[];
  more: (count: number) => string;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, FIRST_PAGE_OUTSTANDING);
  const rest = items.length - shown.length;
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[s.calloutText, { fontFamily: "Inter", fontWeight: 700 }]}>{title}</Text>
      {shown.map((item, i) => (
        <Text key={i} style={s.calloutText}>
          {"•"}  {item}
        </Text>
      ))}
      {rest > 0 && <Text style={s.calloutText}>{more(rest)}</Text>}
    </View>
  );
}

/** The 4 x 4 matrix with the number of risks in each cell: before / after measures. */
function RiskMatrix({
  rows,
  tr,
}: {
  rows: NonNullable<AssessmentExportData["register"]>["rows"];
  tr: PdfT;
}) {
  const fill: Record<string, string> = {
    LOW: "#dcfce7",
    MEDIUM: "#fef9c3",
    HIGH: "#fed7aa",
    CRITICAL: "#fecaca",
  };
  const cell = { flex: 1, borderWidth: 0.5, borderColor: "#cbd5e1", padding: 4, minHeight: 26 } as const;
  const likelihoods = [...RISK_GRADES].reverse();
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: "row" }}>
        <Text style={{ width: 90, fontSize: 7, color: PDF_COLORS.MUTED }}>
          {tr("matrixLikelihood")} / {tr("matrixSeverity")}
        </Text>
        {RISK_GRADES.map((sev) => (
          <Text key={sev} style={[cell, { fontSize: 7, fontFamily: "Inter", fontWeight: 700 }]}>
            {sev}. {tr(`grades.${sev}`)}
          </Text>
        ))}
      </View>
      {likelihoods.map((lik) => (
        <View key={lik} style={{ flexDirection: "row" }}>
          <Text style={{ width: 90, fontSize: 7, fontFamily: "Inter", fontWeight: 700, paddingTop: 4 }}>
            {lik}. {tr(`grades.${lik}`)}
          </Text>
          {RISK_GRADES.map((sev) => {
            const before = rows.filter((r) => r.likelihood === lik && r.severity === sev).length;
            const after = rows.filter(
              (r) => (r.residualLikelihood ?? r.likelihood) === lik && (r.residualSeverity ?? r.severity) === sev
            ).length;
            return (
              <Text
                key={sev}
                style={[cell, { fontSize: 9, textAlign: "center", backgroundColor: fill[RISK_MATRIX[lik - 1][sev - 1]] }]}
              >
                {before || after ? `${before} / ${after}` : ""}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function AssessmentReport({
  data,
  t,
  locale,
  healthAdtech,
}: {
  data: AssessmentExportData;
  /** Scoped to `pdf.assessmentReport`. Optional — English fallback. */
  t?: PdfT;
  locale?: string;
  /** Result pages of the health-data advertising template, when it applies. */
  healthAdtech?: { result: HealthAdtechResult; t: PdfT };
}) {
  const tr: PdfT = t ?? fallbackT;
  const draftLabel = data.draft && !data.approved ? tr("draftMark") : undefined;
  const lang = locale === "es" ? "es" : "en";
  /** Dates in the report's language: dd/mm/yyyy in Spanish. */
  const fmt = (d: Date | string | null | undefined): string => {
    const iso = fmtDate(d);
    if (!iso || lang !== "es") return iso;
    const [y, m, day] = iso.split("-");
    return `${day}/${m}/${y}`;
  };
  const date = fmt(new Date());
  const levelLabel = (level: string | null | undefined) =>
    level ? pdfEnumLabel("riskLevel", level) : tr("stats.notAssessed");
  const scoreLabel = (score: number | null | undefined) =>
    score != null ? `${Math.round(score)} / 100` : null;
  const orgName = data.organization.name;
  const type = data.template.type;
  const sections = data.template.sections || [];
  const responseMap = new Map(
    data.responses.map((r) => [`${r.sectionId}:${r.questionId}`, r])
  );

  const completedMitigations = data.mitigations.filter(
    (m) => m.status === "IMPLEMENTED" || m.status === "VERIFIED"
  ).length;
  const typeLabel = tr(`assessmentTypes.${type}`);
  const articleRef = (() => {
    // A DPIA cites the frameworks chosen for it (the GDPR, the Californian
    // rules or both); other types cite their own article, where they have one.
    if (data.citation) return data.citation;
    const ref = tr(`articleRefs.${type}`);
    // An unresolved key comes back as the key itself; an empty one means none.
    return !ref || ref.includes("articleRefs.") ? null : ref;
  })();

  return (
    <Document language={locale}>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        {draftLabel && <Text style={s.draftMark}>{draftLabel}</Text>}
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>{data.name}</Text>
        <Text style={s.coverSubtitle}>{typeLabel}</Text>
        {articleRef && articleRef !== typeLabel && (
          <Text style={{ fontSize: 11, color: PDF_COLORS.MUTED, marginBottom: 40 }}>
            {articleRef}
          </Text>
        )}
        <Text style={s.coverDate}>{tr("coverGenerated", { date })}</Text>

        {/* An approved assessment: the approval date, and anything the
            template gained after it, for the next revision. */}
        {data.approved && (
          <View style={[s.calloutBox, { alignSelf: "stretch", marginTop: 16 }]}>
            <Text style={s.calloutTitle}>{tr("approvedTitle", { date: data.approved.date })}</Text>
            <Text style={s.calloutText}>{tr("approvedIntro")}</Text>
            <OutstandingList
              title={tr("approvedLaterRequirements")}
              items={data.approved.laterRequirements}
              more={(count) => tr("draftMore", { count })}
            />
          </View>
        )}

        {/* What is outstanding, on the first page, so nobody has to hunt. */}
        {data.draft && (
          <View style={[s.calloutBox, { alignSelf: "stretch", marginTop: 16 }]}>
            <Text style={s.calloutTitle}>{tr("draftTitle")}</Text>
            <Text style={s.calloutText}>{tr("draftIntro")}</Text>
            <OutstandingList
              title={tr("draftQuestions")}
              items={data.draft.outstandingQuestions.map((q) => `${q.sectionTitle}: ${q.text}`)}
              more={(count) => tr("draftMore", { count })}
            />
            <OutstandingList
              title={tr("draftRequirements")}
              items={data.draft.outstandingRequirements.map((r) => `${r.citation} ${r.label}`)}
              more={(count) => tr("draftMore", { count })}
            />
          </View>
        )}

        <Text style={s.coverConfidential}>{tr("coverConfidential")}</Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title={data.name} orgName={orgName} date={date} draftLabel={draftLabel}>
        <Text style={s.sectionTitle}>{tr("executiveSummary")}</Text>

        {/* Stat cards */}
        <View style={s.statsGrid}>
          <StatCard value={levelLabel(data.riskLevel)} label={tr("stats.riskLevel")} />
          <StatCard
            value={`${data.completionPercentage}%`}
            label={tr("stats.completion")}
          />
          <StatCard
            value={`${data.responses.length} / ${data.totalQuestions}`}
            label={tr("stats.questionsAnswered")}
          />
          <StatCard value={data.mitigations.length} label={tr("stats.mitigations")} />
        </View>

        {/* Progress bar */}
        <ProgressBar percent={data.completionPercentage} />

        {/* Metadata */}
        <MetadataBlock
          items={[
            { label: tr("meta.assessmentType"), value: typeLabel },
            { label: tr("meta.template"), value: `${data.template.name} v${data.template.version}` },
            { label: tr("meta.status"), value: pdfEnumLabel("assessmentStatus", data.status) },
            { label: tr("meta.riskScore"), value: scoreLabel(data.riskScore) },
            ...(data.inherentRiskLevel || data.residualRiskLevel
              ? [
                  {
                    label: tr("stats2.inherentRisk"),
                    value: data.inherentRiskLevel
                      ? `${levelLabel(data.inherentRiskLevel)}${data.inherentRiskScore != null ? ` (${scoreLabel(data.inherentRiskScore)})` : ""}`
                      : tr("stats.notAssessed"),
                  },
                  { label: tr("stats2.residualRisk"), value: levelLabel(data.residualRiskLevel) },
                ]
              : []),
            { label: tr("meta.started"), value: fmt(data.startedAt) },
            { label: tr("meta.submitted"), value: fmt(data.submittedAt) },
            { label: tr("meta.completed"), value: fmt(data.completedAt) },
            { label: tr("meta.dueDate"), value: fmt(data.dueDate) },
            { label: tr("meta.linkedActivity"), value: data.processingActivity?.name },
            { label: tr("meta.linkedVendor"), value: data.vendor?.name },
          ]}
        />

        {/* Description */}
        {data.description && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.sectionSubtitle}>{tr("description")}</Text>
            <Text style={s.paragraph}>{data.description}</Text>
          </View>
        )}

      </ContentPage>

      {/* \u2500\u2500 Framework conformance \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      {data.conformance && (
        <ContentPage title={data.name} orgName={orgName} date={date} draftLabel={draftLabel}>
          <Text style={s.sectionTitle}>{tr("conformanceTitle")}</Text>
          <Text style={s.paragraph}>{tr("conformanceIntro")}</Text>

          <View style={s.calloutBox}>
            {data.conformance.verdicts.map((line, i) => (
              <Text key={i} style={s.calloutText}>
                {line}
              </Text>
            ))}
            {data.conformance.californiaNotRequired && (
              <Text style={s.calloutText}>{tr("conformanceCaliforniaNotRequired")}</Text>
            )}
          </View>

          <DataTable
            headers={[
              tr("conformanceColumns.citation"),
              tr("conformanceColumns.requirement"),
              tr("conformanceColumns.status"),
              tr("conformanceColumns.step"),
            ]}
            colWidths={[1.4, 4.6, 1.2, 2]}
            rows={data.conformance.rows.map((row) => [
              row.citation,
              row.label,
              row.covered
                ? tr("conformanceCovered")
                : row.ruleNotMet
                  ? tr("conformanceRuleNotMet")
                  : tr("conformanceOutstanding"),
              row.step ?? tr("conformanceNotAnswered"),
            ])}
          />

          <Text style={[s.notesText, { marginTop: 10 }]}>{tr("conformanceDisclaimer")}</Text>
        </ContentPage>
      )}

      {/* ── Question Sections (one ContentPage per section) ── */}
      {sections.map((section, sectionIndex) => {
        const sectionQuestions = section.questions || [];
        const answeredCount = sectionQuestions.filter(
          (q) => responseMap.has(`${section.id}:${q.id}`)
        ).length;

        return (
          <ContentPage
            key={section.id}
            title={data.name}
            orgName={orgName}
            date={date}
            draftLabel={draftLabel}
          >
            {/* Section header with accent */}
            <AccentSectionHeader
              title={`${sectionIndex + 1}. ${section.title}`}
              description={section.description}
            />

            {/* Section progress indicator */}
            <View style={[s.row, { marginBottom: 12, gap: 8 }]}>
              <Text style={{ fontSize: 8, color: PDF_COLORS.MUTED }}>
                {tr("sectionProgress", {
                  answered: answeredCount,
                  total: sectionQuestions.length,
                })}
              </Text>
              {answeredCount === sectionQuestions.length && (
                <Text
                  style={[
                    s.badge,
                    { backgroundColor: "#dcfce7", color: "#166534" },
                  ]}
                >
                  {tr("sectionComplete")}
                </Text>
              )}
            </View>

            {/* Questions — cards flow across pages naturally */}
            {sectionQuestions.map((q, qi) => {
              const resp = responseMap.get(`${section.id}:${q.id}`);
              const isLongAnswer = (resp?.response?.length ?? 0) > 500;

              return (
                <View
                  key={q.id}
                  style={resp ? s.questionCard : s.questionCardUnanswered}
                  wrap={isLongAnswer}
                >
                  {/* Question header */}
                  <View style={[s.row, { alignItems: "flex-start" }]}>
                    <Text style={s.questionNumber}>{tr("questionNumber", { n: qi + 1 })}</Text>
                    <Text style={s.questionText}>{q.text}</Text>
                    {q.required && (
                      <Text style={s.requiredTag}>{tr("questionRequired")}</Text>
                    )}
                  </View>

                  {/* Answer */}
                  {resp ? (
                    <View style={{ marginTop: 6 }}>
                      <Text style={s.answerText}>{resp.response}</Text>

                      {/* Risk score inline */}
                      {resp.riskScore != null && (
                        <View style={[s.row, { marginTop: 6, gap: 6 }]}>
                          <Text
                            style={{
                              fontSize: 8,
                              fontFamily: "Inter", fontWeight: 700,
                              color: PDF_COLORS.MUTED,
                            }}
                          >
                            {tr("riskScoreLabel")}
                          </Text>
                          <RiskBadge
                            level={
                              resp.riskScore <= 1
                                ? "LOW"
                                : resp.riskScore <= 2.5
                                  ? "MEDIUM"
                                  : resp.riskScore <= 3.5
                                    ? "HIGH"
                                    : "CRITICAL"
                            }
                          />
                          <Text style={{ fontSize: 8, color: PDF_COLORS.MUTED }}>
                            ({resp.riskScore.toFixed(1)})
                          </Text>
                        </View>
                      )}

                      {/* Notes */}
                      {resp.notes && (
                        <Text style={s.notesText}>{tr("noteLabel")} {resp.notes}</Text>
                      )}
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 8,
                        color: "#999",
                        marginTop: 6,
                      }}
                    >
                      {tr("notAnswered")}
                    </Text>
                  )}
                </View>
              );
            })}
          </ContentPage>
        );
      })}

      {/* ── Health-data advertising result ────────────── */}
      {healthAdtech && (
        <HealthAdtechPages
          result={healthAdtech.result}
          t={healthAdtech.t}
          lang={locale === "es" ? "es" : "en"}
          title={data.name}
          orgName={orgName}
          date={date}
          draftLabel={draftLabel}
        />
      )}

      {/* ── Risk Assessment Summary ───────────────────── */}
      {(data.riskLevel || data.register) && (
        <ContentPage title={data.name} orgName={orgName} date={date} draftLabel={draftLabel}>
          <Text style={s.sectionTitle}>{tr("riskAssessmentSummary")}</Text>

          <View style={s.statsGrid}>
            <StatCard value={levelLabel(data.riskLevel)} label={tr("stats2.overallRiskLevel")} />
            <StatCard
              value={scoreLabel(data.riskScore) ?? tr("stats.notAssessed")}
              label={tr("stats2.riskScore")}
            />
            {(data.inherentRiskLevel !== undefined || data.residualRiskLevel !== undefined) && (
              <StatCard value={levelLabel(data.inherentRiskLevel)} label={tr("stats2.inherentRisk")} />
            )}
            {(data.inherentRiskLevel !== undefined || data.residualRiskLevel !== undefined) && (
              <StatCard value={levelLabel(data.residualRiskLevel)} label={tr("stats2.residualRisk")} />
            )}
          </View>

          {/* The risk register: one row per risk, before and after measures. */}
          {data.register && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.sectionSubtitle}>{tr("registerTitle")}</Text>
              <Text style={s.paragraph}>{tr("registerIntro")}</Text>
              {data.register.rows.length === 0 ? (
                <Text style={s.notesText}>{tr("registerEmpty")}</Text>
              ) : (
                <DataTable
                  headers={[
                    tr("registerColumns.risk"),
                    tr("registerColumns.rights"),
                    tr("registerColumns.inherent"),
                    tr("registerColumns.measures"),
                    tr("registerColumns.residual"),
                    tr("registerColumns.status"),
                  ]}
                  colWidths={[2.6, 1.8, 1.5, 2.4, 1.5, 1]}
                  rows={data.register.rows.map((r) => [
                    r.description ? `${r.title}: ${r.description}` : r.title,
                    r.rightsAffected,
                    tr("registerPair", {
                      level: levelLabel(r.inherent),
                      likelihood: r.likelihood,
                      severity: r.severity,
                    }),
                    r.measures.join("; "),
                    r.residual
                      ? tr("registerPair", {
                          level: levelLabel(r.residual),
                          likelihood: r.residualLikelihood ?? "",
                          severity: r.residualSeverity ?? "",
                        })
                      : tr("registerNotGraded"),
                    pdfEnumLabel("assessmentRiskStatus", r.status),
                  ])}
                />
              )}
              {data.register.unsupported.length > 0 && (
                <View style={[s.calloutBox, { marginTop: 8 }]}>
                  <Text style={s.calloutText}>
                    {tr("registerUnsupported", { risks: data.register.unsupported.join("; ") })}
                  </Text>
                </View>
              )}

              {data.register.rows.length > 0 && (
                <View style={{ marginTop: 12 }} wrap={false}>
                  <Text style={s.sectionSubtitle}>{tr("matrixTitle")}</Text>
                  <Text style={s.notesText}>{tr("matrixIntro")}</Text>
                  <RiskMatrix rows={data.register.rows} tr={tr} />
                </View>
              )}
            </View>
          )}
        </ContentPage>
      )}

      {/* ── Mitigations ───────────────────────────────── */}
      {data.mitigations.length > 0 && (
        <ContentPage title={data.name} orgName={orgName} date={date} draftLabel={draftLabel}>
          <Text style={s.sectionTitle}>{tr("mitigationsTitle")}</Text>

          <View style={s.statsGrid}>
            <StatCard value={data.mitigations.length} label={tr("mitigationStats.total")} />
            <StatCard value={completedMitigations} label={tr("mitigationStats.completed")} />
            <StatCard
              value={data.mitigations.length - completedMitigations}
              label={tr("mitigationStats.outstanding")}
            />
          </View>

          <DataTable
            headers={[
              tr("mitigationColumns.title"),
              tr("mitigationColumns.status"),
              tr("mitigationColumns.priority"),
              tr("mitigationColumns.owner"),
              tr("mitigationColumns.dueDate"),
              tr("mitigationColumns.evidence"),
            ]}
            colWidths={[3, 1.5, 0.8, 1.5, 1.5, 1]}
            rows={data.mitigations.map((m) => [
              m.title,
              pdfEnumLabel("mitigationStatus", m.status),
              tr("priorityCode", { n: m.priority }),
              m.owner,
              fmt(m.dueDate),
              m.evidence ? tr("yes") : tr("no"),
            ])}
          />

          {/* Mitigation details for items with descriptions */}
          {data.mitigations.some((m) => m.description) && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.sectionSubtitle}>{tr("mitigationDetails")}</Text>
              {data.mitigations
                .filter((m) => m.description)
                .map((m, i) => (
                  <View key={i} style={s.questionCard} wrap={false}>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: "Inter", fontWeight: 700,
                        color: PDF_COLORS.DARK,
                        marginBottom: 4,
                      }}
                    >
                      {m.title}
                    </Text>
                    <Text style={s.answerText}>{m.description}</Text>
                  </View>
                ))}
            </View>
          )}
        </ContentPage>
      )}

      {/* ── Approval History ──────────────────────────── */}
      {data.approvals.length > 0 && (
        <ContentPage title={data.name} orgName={orgName} date={date} draftLabel={draftLabel}>
          <Text style={s.sectionTitle}>{tr("approvalHistory")}</Text>
          <DataTable
            headers={[
              tr("approvalColumns.level"),
              tr("approvalColumns.approver"),
              tr("approvalColumns.status"),
              tr("approvalColumns.date"),
              tr("approvalColumns.comments"),
            ]}
            colWidths={[0.8, 2, 1.2, 1.5, 3]}
            rows={data.approvals.map((a) => [
              tr("approvalLevel", { n: a.level }),
              a.approver.name || a.approver.email,
              pdfEnumLabel("approvalStatus", a.status),
              fmt(a.decidedAt),
              a.comments,
            ])}
          />
        </ContentPage>
      )}

      {/* ── Conclusion and sign-off (DPIA) ────────────── */}
      {data.signOff && (
        <ContentPage title={data.name} orgName={orgName} date={date} draftLabel={draftLabel}>
          <Text style={s.sectionTitle}>{tr("signOffTitle")}</Text>
          <MetadataBlock
            items={[
              { label: tr("signOff.templateVersion"), value: data.signOff.templateVersion },
              {
                label: tr("signOff.approvedVersion"),
                value: data.signOff.approvedVersion != null ? String(data.signOff.approvedVersion) : tr("notRecorded"),
              },
              {
                label: tr("signOff.preparedBy"),
                value: data.signOff.preparedBy.length > 0 ? data.signOff.preparedBy.join(", ") : tr("notRecorded"),
              },
              { label: tr("signOff.decision"), value: pdfEnumLabel("assessmentStatus", data.signOff.decision) },
              { label: tr("signOff.decidedOn"), value: fmt(data.signOff.decidedAt) || tr("notRecorded") },
            ]}
          />
          {(
            [
              ["signOff.dpoAdvice", data.signOff.dpoAdvice],
              ["signOff.consultation", data.signOff.consultation],
              ["signOff.consultationRecord", data.signOff.consultationRecord],
              ["signOff.review", data.signOff.review],
            ] as Array<[string, string | null]>
          )
            .filter(([key, value]) => value != null || key !== "signOff.consultationRecord")
            .map(([key, value]) => (
              <View key={key} style={s.questionCard}>
                <Text
                  style={{ fontSize: 9, fontFamily: "Inter", fontWeight: 700, color: PDF_COLORS.DARK, marginBottom: 4 }}
                >
                  {tr(key)}
                </Text>
                <Text style={s.answerText}>{value ?? tr("notRecorded")}</Text>
              </View>
            ))}

          <View wrap={false}>
          <Text style={[s.sectionSubtitle, { marginTop: 12 }]}>{tr("signOff.signatures")}</Text>
          <DataTable
            headers={[
              "",
              tr("signOff.nameAndPosition"),
              tr("signOff.signature"),
              tr("signOff.date"),
            ]}
            colWidths={[2, 3, 2.5, 1.5]}
            rows={[
              [tr("signOff.forController"), " \n ", "", ""],
              [tr("signOff.dpo"), " \n ", "", ""],
            ]}
          />
          </View>
        </ContentPage>
      )}
    </Document>
  );
}
