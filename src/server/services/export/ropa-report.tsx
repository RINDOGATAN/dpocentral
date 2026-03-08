import React from "react";
import { Document, View, Text } from "@react-pdf/renderer";
import {
  CoverPage,
  ContentPage,
  SectionTitle,
  SectionSubtitle,
  MetadataBlock,
  DataTable,
  StatCard,
  s,
  fmtDate,
} from "./pdf-styles";
import type { ROPAEntry } from "@/server/services/privacy/ropaGenerator";
import { generateROPASummary, validateROPAEntry } from "@/server/services/privacy/ropaGenerator";

export function ROPAReport({
  entries,
  orgName,
}: {
  entries: ROPAEntry[];
  orgName: string;
}) {
  const date = fmtDate(new Date());
  const summary = generateROPASummary(entries);

  return (
    <Document>
      <CoverPage
        orgName={orgName}
        title="Record of Processing Activities"
        subtitle="GDPR Article 30"
        date={date}
      />

      {/* Summary */}
      <ContentPage title="ROPA" orgName={orgName} date={date}>
        <SectionTitle>Summary</SectionTitle>
        <View style={s.statsGrid}>
          <StatCard value={summary.totalActivities} label="Activities" />
          <StatCard value={summary.withInternationalTransfers} label="Int'l Transfers" />
          <StatCard value={summary.withAutomatedDecisions} label="Automated Decisions" />
          <StatCard value={summary.needingReview} label="Needing Review" />
        </View>

        {Object.keys(summary.byLegalBasis).length > 0 && (
          <>
            <SectionSubtitle>By Legal Basis</SectionSubtitle>
            <DataTable
              headers={["Legal Basis", "Count"]}
              colWidths={[3, 1]}
              rows={Object.entries(summary.byLegalBasis).map(([basis, count]) => [
                basis.replace(/_/g, " "),
                count,
              ])}
            />
          </>
        )}

        {/* Per-activity detail */}
        <SectionTitle>Processing Activities</SectionTitle>
        {entries.map((entry, i) => {
          const validation = validateROPAEntry(entry);
          return (
            <View key={i} style={s.card} wrap={false}>
              <View style={[s.row, { justifyContent: "space-between", marginBottom: 6 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>
                  {i + 1}. {entry.name}
                </Text>
                {!validation.isValid && (
                  <Text style={[s.badge, { backgroundColor: "#fef9c3", color: "#854d0e" }]}>
                    INCOMPLETE
                  </Text>
                )}
              </View>

              <MetadataBlock
                items={[
                  { label: "Purpose", value: entry.purpose },
                  {
                    label: "Legal Basis",
                    value: `${entry.legalBasis}${entry.legalBasisDetail ? ` — ${entry.legalBasisDetail}` : ""}`,
                  },
                  { label: "Data Subjects", value: entry.dataSubjects.join(", ") || undefined },
                  { label: "Data Categories", value: entry.dataCategories.join(", ") || undefined },
                  { label: "Recipients", value: entry.recipients.join(", ") || undefined },
                  { label: "Retention Period", value: entry.retentionPeriod },
                  {
                    label: "Automated Decisions",
                    value: entry.automatedDecisionMaking
                      ? `Yes — ${entry.automatedDecisionDetail || "No details"}`
                      : "No",
                  },
                  { label: "Last Reviewed", value: fmtDate(entry.lastReviewed) },
                  { label: "Next Review", value: fmtDate(entry.nextReview) },
                ]}
              />

              {entry.systems.length > 0 && (
                <>
                  <SectionSubtitle>Systems / Assets</SectionSubtitle>
                  <DataTable
                    headers={["System", "Type", "Location", "Data Elements"]}
                    colWidths={[2, 1, 1, 3]}
                    rows={entry.systems.map((sys) => [
                      sys.name,
                      sys.type,
                      sys.location,
                      sys.elements.map((e) => e.name).join(", ") || "—",
                    ])}
                  />
                </>
              )}

              {entry.transfers.length > 0 && (
                <>
                  <SectionSubtitle>International Transfers</SectionSubtitle>
                  <DataTable
                    headers={["Destination", "Organization", "Mechanism", "Safeguards"]}
                    colWidths={[1.5, 2, 2, 2]}
                    rows={entry.transfers.map((t) => [
                      t.destination,
                      t.organization,
                      t.mechanism,
                      t.safeguards,
                    ])}
                  />
                </>
              )}

              {validation.warnings.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  {validation.warnings.map((w, wi) => (
                    <Text key={wi} style={{ fontSize: 7, color: "#854d0e" }}>
                      Warning: {w}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ContentPage>
    </Document>
  );
}
