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

const TYPE_LABELS: Record<string, string> = {
  DPIA: "Data Protection Impact Assessment",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

const ARTICLE_REFS: Record<string, string> = {
  DPIA: "GDPR Article 35(7)",
  PIA: "Privacy Impact Assessment",
  TIA: "Transfer Impact Assessment",
  LIA: "Legitimate Interest Assessment",
  VENDOR: "Vendor Risk Assessment",
  CUSTOM: "Custom Assessment",
};

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

export function AssessmentReport({ data }: { data: AssessmentExportData }) {
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

  return (
    <Document>
      {/* ── Cover Page ────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverStripe} />
        <Text style={s.coverOrgName}>{orgName}</Text>
        <Text style={s.coverTitle}>{data.name}</Text>
        <Text style={s.coverSubtitle}>
          {TYPE_LABELS[type] || type}
        </Text>
        {ARTICLE_REFS[type] && ARTICLE_REFS[type] !== TYPE_LABELS[type] && (
          <Text style={{ fontSize: 11, color: PDF_COLORS.MUTED, marginBottom: 40 }}>
            {ARTICLE_REFS[type]}
          </Text>
        )}
        <Text style={s.coverDate}>Generated: {date}</Text>
        <Text style={s.coverConfidential}>
          CONFIDENTIAL — This document contains sensitive information about data
          protection practices. Distribution should be limited to authorized
          personnel and supervisory authorities upon request.
        </Text>
      </Page>

      {/* ── Executive Summary ─────────────────────────── */}
      <ContentPage title={data.name} orgName={orgName} date={date}>
        <Text style={s.sectionTitle}>Executive Summary</Text>

        {/* Stat cards */}
        <View style={s.statsGrid}>
          <StatCard
            value={data.riskLevel?.replace("_", " ") || "N/A"}
            label="Risk Level"
          />
          <StatCard
            value={`${data.completionPercentage}%`}
            label="Completion"
          />
          <StatCard
            value={`${data.responses.length} / ${data.totalQuestions}`}
            label="Questions Answered"
          />
          <StatCard
            value={data.mitigations.length}
            label="Mitigations"
          />
        </View>

        {/* Progress bar */}
        <ProgressBar percent={data.completionPercentage} />

        {/* Metadata */}
        <MetadataBlock
          items={[
            { label: "Assessment Type", value: TYPE_LABELS[type] || type },
            { label: "Template", value: `${data.template.name} v${data.template.version}` },
            { label: "Status", value: data.status.replace(/_/g, " ") },
            { label: "Risk Score", value: data.riskScore != null ? `${data.riskScore.toFixed(0)} / 100` : null },
            { label: "Started", value: fmtDate(data.startedAt) },
            { label: "Submitted", value: fmtDate(data.submittedAt) },
            { label: "Completed", value: fmtDate(data.completedAt) },
            { label: "Due Date", value: fmtDate(data.dueDate) },
            { label: "Linked Activity", value: data.processingActivity?.name },
            { label: "Linked Vendor", value: data.vendor?.name },
          ]}
        />

        {/* Description */}
        {data.description && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.sectionSubtitle}>Description</Text>
            <Text style={s.paragraph}>{data.description}</Text>
          </View>
        )}

        {/* GDPR Article 35(7) callout for DPIA */}
        {type === "DPIA" && (
          <View style={s.calloutBox}>
            <Text style={s.calloutTitle}>
              GDPR Article 35(7) — Required DPIA Elements
            </Text>
            <Text style={s.calloutText}>
              {"\u2713"}  Systematic description of processing operations and purposes
            </Text>
            <Text style={s.calloutText}>
              {"\u2713"}  Assessment of necessity and proportionality
            </Text>
            <Text style={s.calloutText}>
              {"\u2713"}  Assessment of risks to rights and freedoms of data subjects
            </Text>
            <Text style={s.calloutText}>
              {"\u2713"}  Measures envisaged to address risks and demonstrate compliance
            </Text>
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
                {answeredCount} of {sectionQuestions.length} questions answered
              </Text>
              {answeredCount === sectionQuestions.length && (
                <Text
                  style={[
                    s.badge,
                    { backgroundColor: "#dcfce7", color: "#166534" },
                  ]}
                >
                  Complete
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
                    <Text style={s.questionNumber}>Q{qi + 1}.</Text>
                    <Text style={s.questionText}>{q.text}</Text>
                    {q.required && (
                      <Text style={s.requiredTag}>REQUIRED</Text>
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
                              fontFamily: "Helvetica-Bold",
                              color: PDF_COLORS.MUTED,
                            }}
                          >
                            Risk Score:
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
                        <Text style={s.notesText}>Note: {resp.notes}</Text>
                      )}
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 8,
                        fontStyle: "italic",
                        color: "#999",
                        marginTop: 6,
                      }}
                    >
                      Not yet answered
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
          <Text style={s.sectionTitle}>Risk Assessment Summary</Text>

          <View style={s.statsGrid}>
            <StatCard
              value={data.riskLevel.replace("_", " ")}
              label="Overall Risk Level"
            />
            <StatCard
              value={data.riskScore != null ? data.riskScore.toFixed(1) : "N/A"}
              label="Risk Score"
            />
            <StatCard
              value={data.responses.filter((r) => r.riskScore != null).length}
              label="Scored Questions"
            />
          </View>

          {/* Per-question risk scores table */}
          {data.responses.some((r) => r.riskScore != null) && (
            <View style={{ marginTop: 8 }}>
              <Text style={s.sectionSubtitle}>Question Risk Scores</Text>
              <DataTable
                headers={["Section", "Question", "Score", "Level"]}
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
          <Text style={s.sectionTitle}>Risk Mitigations</Text>

          <View style={s.statsGrid}>
            <StatCard value={data.mitigations.length} label="Total" />
            <StatCard value={completedMitigations} label="Completed" />
            <StatCard
              value={data.mitigations.length - completedMitigations}
              label="Outstanding"
            />
          </View>

          <DataTable
            headers={[
              "Title",
              "Status",
              "Priority",
              "Owner",
              "Due Date",
              "Evidence",
            ]}
            colWidths={[3, 1.5, 0.8, 1.5, 1.5, 1]}
            rows={data.mitigations.map((m) => [
              m.title,
              m.status.replace(/_/g, " "),
              `P${m.priority}`,
              m.owner,
              fmtDate(m.dueDate),
              m.evidence ? "Yes" : "No",
            ])}
          />

          {/* Mitigation details for items with descriptions */}
          {data.mitigations.some((m) => m.description) && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.sectionSubtitle}>Mitigation Details</Text>
              {data.mitigations
                .filter((m) => m.description)
                .map((m, i) => (
                  <View key={i} style={s.questionCard} wrap={false}>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: "Helvetica-Bold",
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
          <Text style={s.sectionTitle}>Approval History</Text>
          <DataTable
            headers={["Level", "Approver", "Status", "Date", "Comments"]}
            colWidths={[0.8, 2, 1.2, 1.5, 3]}
            rows={data.approvals.map((a) => [
              `Level ${a.level}`,
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
