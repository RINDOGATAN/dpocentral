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
  dpiaCalloutTitle: "GDPR Article 35(7) — Required DPIA Elements",
  dpiaCallout1: "Systematic description of processing operations and purposes",
  dpiaCallout2: "Assessment of necessity and proportionality",
  dpiaCallout3: "Assessment of risks to rights and freedoms of data subjects",
  dpiaCallout4: "Measures envisaged to address risks and demonstrate compliance",
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
};

function fallbackT(key: string, values?: Record<string, string | number | Date>): string {
  const templates: Record<string, string> = {
    ...EN_FALLBACK,
    coverGenerated: "Generated: {date}",
    coverConfidential:
      "CONFIDENTIAL — This document contains sensitive information about data protection practices. Distribution should be limited to authorised personnel and supervisory authorities upon request.",
    sectionProgress: "{answered} of {total} questions answered",
    questionNumber: "Q{n}.",
    priorityCode: "P{n}",
    approvalLevel: "Level {n}",
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
}

export function AssessmentReport({
  data,
  t,
  locale,
}: {
  data: AssessmentExportData;
  /** Scoped to `pdf.assessmentReport`. Optional — English fallback. */
  t?: PdfT;
  locale?: string;
}) {
  const tr: PdfT = t ?? fallbackT;
  const date = fmtDate(new Date());
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
    const ref = tr(`articleRefs.${type}`);
    // articleRefs only has DPIA; other types fall through to the key itself — skip then.
    return ref.startsWith("articleRefs.") ? null : ref;
  })();

  return (
    <Document language={locale}>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>{data.name}</Text>
        <Text style={s.coverSubtitle}>{typeLabel}</Text>
        {articleRef && articleRef !== typeLabel && (
          <Text style={{ fontSize: 11, color: PDF_COLORS.MUTED, marginBottom: 40 }}>
            {articleRef}
          </Text>
        )}
        <Text style={s.coverDate}>{tr("coverGenerated", { date })}</Text>
        <Text style={s.coverConfidential}>{tr("coverConfidential")}</Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title={data.name} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>{tr("executiveSummary")}</Text>

        {/* Stat cards */}
        <View style={s.statsGrid}>
          <StatCard
            value={data.riskLevel?.replace("_", " ") || tr("stats.notAvailable")}
            label={tr("stats.riskLevel")}
          />
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
            { label: tr("meta.status"), value: data.status.replace(/_/g, " ") },
            {
              label: tr("meta.riskScore"),
              value: data.riskScore != null ? `${data.riskScore.toFixed(0)} / 100` : null,
            },
            { label: tr("meta.started"), value: fmtDate(data.startedAt) },
            { label: tr("meta.submitted"), value: fmtDate(data.submittedAt) },
            { label: tr("meta.completed"), value: fmtDate(data.completedAt) },
            { label: tr("meta.dueDate"), value: fmtDate(data.dueDate) },
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

        {/* GDPR Article 35(7) callout for DPIA */}
        {type === "DPIA" && (
          <View style={s.calloutBox}>
            <Text style={s.calloutTitle}>{tr("dpiaCalloutTitle")}</Text>
            <Text style={s.calloutText}>{"\u2713"}  {tr("dpiaCallout1")}</Text>
            <Text style={s.calloutText}>{"\u2713"}  {tr("dpiaCallout2")}</Text>
            <Text style={s.calloutText}>{"\u2713"}  {tr("dpiaCallout3")}</Text>
            <Text style={s.calloutText}>{"\u2713"}  {tr("dpiaCallout4")}</Text>
          </View>
        )}
      </ContentPage>

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

      {/* ── Risk Assessment Summary ───────────────────── */}
      {data.riskLevel && (
        <ContentPage title={data.name} orgName={orgName} date={date}>
          <Text style={s.sectionTitle}>{tr("riskAssessmentSummary")}</Text>

          <View style={s.statsGrid}>
            <StatCard
              value={data.riskLevel.replace("_", " ")}
              label={tr("stats2.overallRiskLevel")}
            />
            <StatCard
              value={data.riskScore != null ? data.riskScore.toFixed(1) : tr("stats.notAvailable")}
              label={tr("stats2.riskScore")}
            />
            <StatCard
              value={data.responses.filter((r) => r.riskScore != null).length}
              label={tr("stats2.scoredQuestions")}
            />
          </View>

          {/* Per-question risk scores table */}
          {data.responses.some((r) => r.riskScore != null) && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.sectionSubtitle}>{tr("questionRiskScores")}</Text>
              <DataTable
                headers={[
                  tr("riskColumns.section"),
                  tr("riskColumns.question"),
                  tr("riskColumns.score"),
                  tr("riskColumns.level"),
                ]}
                colWidths={[2, 4, 1, 1.5]}
                rows={data.responses
                  .filter((r) => r.riskScore != null)
                  .map((r) => {
                    const section = sections.find((sec) =>
                      sec.id === r.sectionId
                    );
                    const question = section?.questions.find(
                      (q) => q.id === r.questionId
                    );
                    const level =
                      r.riskScore! <= 1
                        ? "LOW"
                        : r.riskScore! <= 2.5
                          ? "MEDIUM"
                          : r.riskScore! <= 3.5
                            ? "HIGH"
                            : "CRITICAL";
                    return [
                      section?.title ?? "—",
                      question?.text
                        ? question.text.length > 60
                          ? question.text.slice(0, 57) + "..."
                          : question.text
                        : "—",
                      r.riskScore!.toFixed(1),
                      level,
                    ];
                  })}
              />
            </View>
          )}
        </ContentPage>
      )}

      {/* ── Mitigations ───────────────────────────────── */}
      {data.mitigations.length > 0 && (
        <ContentPage title={data.name} orgName={orgName} date={date}>
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
              m.status.replace(/_/g, " "),
              tr("priorityCode", { n: m.priority }),
              m.owner,
              fmtDate(m.dueDate),
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
        <ContentPage title={data.name} orgName={orgName} date={date}>
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
              a.status.replace(/_/g, " "),
              fmtDate(a.decidedAt),
              a.comments,
            ])}
          />
        </ContentPage>
      )}
    </Document>
  );
}
