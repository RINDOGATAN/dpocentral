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
  RiskBadge,
  StatusBadge,
  s,
  fmtDate,
} from "./pdf-styles";

export interface VendorExportData {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  status: string;
  riskTier: string | null;
  riskScore: number | null;
  primaryContact: string | null;
  contactEmail: string | null;
  categories: string[];
  dataProcessed: string[];
  countries: string[];
  certifications: string[];
  lastAssessedAt: Date | null;
  nextReviewAt: Date | null;
  contracts: Array<{
    name: string;
    type: string;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
  }>;
}

export function VendorRegisterReport({
  vendors,
  orgName,
}: {
  vendors: VendorExportData[];
  orgName: string;
}) {
  const date = fmtDate(new Date());

  const byStatus: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  let expiringContracts = 0;
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const v of vendors) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    if (v.riskTier) byRisk[v.riskTier] = (byRisk[v.riskTier] || 0) + 1;
    for (const c of v.contracts) {
      if (c.endDate && new Date(c.endDate) <= thirtyDays && c.status === "ACTIVE") {
        expiringContracts++;
      }
    }
  }

  return (
    <Document>
      <CoverPage
        orgName={orgName}
        title="Vendor & Processor Register"
        subtitle="GDPR Article 28"
        date={date}
      />

      <ContentPage title="Vendor Register" orgName={orgName} date={date}>
        <SectionTitle>Summary</SectionTitle>
        <View style={s.statsGrid}>
          <StatCard value={vendors.length} label="Total Vendors" />
          <StatCard value={byStatus["ACTIVE"] || 0} label="Active" />
          <StatCard value={(byRisk["HIGH"] || 0) + (byRisk["CRITICAL"] || 0)} label="High/Critical Risk" />
          <StatCard value={expiringContracts} label="Contracts Expiring 30d" />
        </View>

        {/* Overview Table */}
        <SectionTitle>All Vendors</SectionTitle>
        <DataTable
          headers={["Vendor", "Status", "Risk Tier", "Categories", "Countries", "Certs", "Next Review"]}
          colWidths={[2, 1, 1, 2, 1.5, 1.5, 1.2]}
          rows={vendors.map((v) => [
            v.name,
            v.status.replace(/_/g, " "),
            v.riskTier || "—",
            v.categories.join(", ") || "—",
            v.countries.join(", ") || "—",
            v.certifications.join(", ") || "None",
            fmtDate(v.nextReviewAt),
          ])}
        />

        {/* Per-vendor detail */}
        {vendors.map((vendor, i) => (
          <View key={vendor.id} wrap={false}>
            <SectionTitle>
              {i + 1}. {vendor.name}
            </SectionTitle>
            <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
              <StatusBadge status={vendor.status} />
              {vendor.riskTier && <RiskBadge level={vendor.riskTier} />}
            </View>

            <MetadataBlock
              items={[
                { label: "Website", value: vendor.website },
                { label: "Primary Contact", value: vendor.primaryContact },
                { label: "Contact Email", value: vendor.contactEmail },
                { label: "Categories", value: vendor.categories.join(", ") || undefined },
                { label: "Data Processed", value: vendor.dataProcessed.join(", ") || undefined },
                { label: "Countries", value: vendor.countries.join(", ") || undefined },
                { label: "Certifications", value: vendor.certifications.join(", ") || "None" },
                { label: "Last Assessed", value: fmtDate(vendor.lastAssessedAt) },
                { label: "Next Review", value: fmtDate(vendor.nextReviewAt) },
                {
                  label: "Risk Score",
                  value: vendor.riskScore != null ? vendor.riskScore.toFixed(1) : undefined,
                },
              ]}
            />

            {vendor.description && (
              <Text style={s.paragraph}>{vendor.description}</Text>
            )}

            {vendor.contracts.length > 0 && (
              <>
                <SectionSubtitle>Contracts / DPAs</SectionSubtitle>
                <DataTable
                  headers={["Contract", "Type", "Status", "Start", "End"]}
                  colWidths={[2.5, 1.2, 1.2, 1.2, 1.2]}
                  rows={vendor.contracts.map((c) => [
                    c.name,
                    c.type,
                    c.status.replace(/_/g, " "),
                    fmtDate(c.startDate),
                    fmtDate(c.endDate),
                  ])}
                />
              </>
            )}

            <View style={s.divider} />
          </View>
        ))}
      </ContentPage>
    </Document>
  );
}

export function vendorsToCSV(vendors: VendorExportData[]): string {
  const headers = [
    "Name",
    "Status",
    "Risk Tier",
    "Risk Score",
    "Website",
    "Primary Contact",
    "Contact Email",
    "Categories",
    "Data Processed",
    "Countries",
    "Certifications",
    "Last Assessed",
    "Next Review",
    "Contract Names",
    "DPA Status",
  ];

  const rows = vendors.map((v) => {
    const dpa = v.contracts.find((c) => c.type === "DPA");
    return [
      v.name,
      v.status,
      v.riskTier || "",
      v.riskScore != null ? String(v.riskScore) : "",
      v.website || "",
      v.primaryContact || "",
      v.contactEmail || "",
      v.categories.join("; "),
      v.dataProcessed.join("; "),
      v.countries.join("; "),
      v.certifications.join("; "),
      fmtDate(v.lastAssessedAt),
      fmtDate(v.nextReviewAt),
      v.contracts.map((c: { name: string }) => c.name).join("; "),
      dpa ? dpa.status : "No DPA",
    ];
  });

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
