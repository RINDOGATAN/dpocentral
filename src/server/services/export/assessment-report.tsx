import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  CoverPage,
  ContentPage,
  SectionTitle,
  SectionSubtitle,
  MetadataBlock,
  DataTable,
  RiskBadge,
  StatusBadge,
  s,
  fmtDate,
  fmtDateTime,
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

  return (
    <Document>
      <CoverPage
        orgName={orgName}
        title={data.name}
        subtitle={`${TYPE_LABELS[type] || type} — ${ARTICLE_REFS[type] || ""}`}
        date={date}
      />

      {/* Executive Summary */}
      <ContentPage title={data.name} orgName={orgName} date={date}>
        <SectionTitle>Executive Summary</SectionTitle>
        <MetadataBlock
          items={[
            { label: "Assessment Type", value: TYPE_LABELS[type] || type },
            { label: "Template", value: `${data.template.name} v${data.template.version}` },
            { label: "Status", value: data.status.replace(/_/g, " ") },
            { label: "Risk Level", value: data.riskLevel || "Not assessed" },
            { label: "Risk Score", value: data.riskScore != null ? `${data.riskScore.toFixed(1)}` : "N/A" },
            { label: "Completion", value: `${data.completionPercentage}% (${data.responses.length}/${data.totalQuestions})` },
            { label: "Started", value: fmtDate(data.startedAt) },
            { label: "Submitted", value: fmtDate(data.submittedAt) },
            { label: "Completed", value: fmtDate(data.completedAt) },
            { label: "Due Date", value: fmtDate(data.dueDate) },
            { label: "Linked Activity", value: data.processingActivity?.name },
            { label: "Linked Vendor", value: data.vendor?.name },
          ]}
        />
        {data.description && (
          <>
            <SectionSubtitle>Description</SectionSubtitle>
            <Text style={s.paragraph}>{data.description}</Text>
          </>
        )}

        {/* Responses by Section */}
        {sections.map((section) => (
          <View key={section.id} wrap={false}>
            <SectionTitle>{section.title}</SectionTitle>
            {section.description && (
              <Text style={[s.paragraph, { fontStyle: "italic" }]}>
                {section.description}
              </Text>
            )}
            {(section.questions || []).map((q, qi) => {
              const resp = responseMap.get(`${section.id}:${q.id}`);
              return (
                <View key={q.id} style={s.card}>
                  <View style={[s.row, { marginBottom: 4 }]}>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>
                      Q{qi + 1}.{" "}
                    </Text>
                    <Text style={{ fontSize: 9, flex: 1 }}>{q.text}</Text>
                    {q.required && (
                      <Text style={{ fontSize: 7, color: "#ef4444" }}>
                        {" "}
                        Required
                      </Text>
                    )}
                  </View>
                  {resp ? (
                    <View style={{ marginTop: 4 }}>
                      <Text style={s.paragraph}>{resp.response}</Text>
                      {resp.riskScore != null && (
                        <View style={s.row}>
                          <Text style={[s.metaLabel, { width: 80 }]}>
                            Risk Score:
                          </Text>
                          <Text style={s.metaValue}>
                            {resp.riskScore.toFixed(1)}
                          </Text>
                        </View>
                      )}
                      {resp.notes && (
                        <View style={s.row}>
                          <Text style={[s.metaLabel, { width: 80 }]}>
                            Notes:
                          </Text>
                          <Text style={s.metaValue}>{resp.notes}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontSize: 8,
                        fontStyle: "italic",
                        color: "#999",
                        marginTop: 4,
                      }}
                    >
                      Not answered
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Risk Assessment Summary */}
        {data.riskLevel && (
          <View wrap={false}>
            <SectionTitle>Risk Assessment</SectionTitle>
            <View style={[s.row, { gap: 12, marginBottom: 8 }]}>
              <View style={s.row}>
                <Text style={[s.metaLabel, { width: 80 }]}>Risk Level:</Text>
                <RiskBadge level={data.riskLevel} />
              </View>
              {data.riskScore != null && (
                <View style={s.row}>
                  <Text style={[s.metaLabel, { width: 80 }]}>Score:</Text>
                  <Text style={s.metaValue}>{data.riskScore.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Mitigations */}
        {data.mitigations.length > 0 && (
          <View wrap={false}>
            <SectionTitle>Mitigations</SectionTitle>
            <DataTable
              headers={[
                "Title",
                "Status",
                "Priority",
                "Owner",
                "Due Date",
                "Evidence",
              ]}
              colWidths={[3, 1.5, 1, 1.5, 1.5, 2]}
              rows={data.mitigations.map((m) => [
                m.title,
                m.status.replace(/_/g, " "),
                `P${m.priority}`,
                m.owner,
                fmtDate(m.dueDate),
                m.evidence ? "Yes" : "No",
              ])}
            />
          </View>
        )}

        {/* Approval History */}
        {data.approvals.length > 0 && (
          <View wrap={false}>
            <SectionTitle>Approval History</SectionTitle>
            <DataTable
              headers={["Level", "Approver", "Status", "Date", "Comment"]}
              colWidths={[0.8, 2, 1.2, 1.5, 3]}
              rows={data.approvals.map((a) => [
                `Level ${a.level}`,
                a.approver.name || a.approver.email,
                a.status,
                fmtDate(a.decidedAt),
                a.comments,
              ])}
            />
          </View>
        )}
      </ContentPage>
    </Document>
  );
}
