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

export interface DataInventoryExportData {
  assets: Array<{
    id: string;
    name: string;
    type: string;
    owner: string | null;
    location: string | null;
    hostingType: string | null;
    description: string | null;
    isProduction: boolean;
    dataElements: Array<{
      name: string;
      category: string;
      sensitivity: string;
      isPersonalData: boolean;
      isSpecialCategory: boolean;
      retentionDays: number | null;
    }>;
  }>;
  flows: Array<{
    name: string;
    description: string | null;
    sourceAsset: { name: string };
    destinationAsset: { name: string };
    dataCategories: string[];
    frequency: string | null;
    encryptionMethod: string | null;
    isAutomated: boolean;
  }>;
  transfers: Array<{
    name: string;
    destinationCountry: string;
    destinationOrg: string | null;
    mechanism: string;
    safeguards: string | null;
    tiaCompleted: boolean;
    tiaDate: Date | null;
    isActive: boolean;
    processingActivity: { name: string } | null;
  }>;
}

export function DataInventoryReport({
  data,
  orgName,
}: {
  data: DataInventoryExportData;
  orgName: string;
}) {
  const date = fmtDate(new Date());
  const totalElements = data.assets.reduce(
    (sum, a) => sum + a.dataElements.length,
    0
  );
  const specialCatCount = data.assets.reduce(
    (sum, a) => sum + a.dataElements.filter((e) => e.isSpecialCategory).length,
    0
  );

  return (
    <Document>
      <CoverPage
        orgName={orgName}
        title="Data Inventory"
        subtitle="GDPR Article 30 Supplement"
        date={date}
      />

      <ContentPage title="Data Inventory" orgName={orgName} date={date}>
        <SectionTitle>Summary</SectionTitle>
        <View style={s.statsGrid}>
          <StatCard value={data.assets.length} label="Data Assets" />
          <StatCard value={totalElements} label="Data Elements" />
          <StatCard value={data.flows.length} label="Data Flows" />
          <StatCard value={data.transfers.length} label="Int'l Transfers" />
        </View>
        {specialCatCount > 0 && (
          <Text style={[s.paragraph, { color: "#9a3412" }]}>
            {specialCatCount} special category data element(s) identified.
          </Text>
        )}

        {/* Assets Overview */}
        <SectionTitle>Data Assets</SectionTitle>
        <DataTable
          headers={["Name", "Type", "Owner", "Location", "Hosting", "Elements", "Prod"]}
          colWidths={[2.5, 1.2, 1.5, 1.5, 1.2, 1, 0.8]}
          rows={data.assets.map((a) => [
            a.name,
            a.type.replace(/_/g, " "),
            a.owner,
            a.location,
            a.hostingType,
            a.dataElements.length,
            a.isProduction ? "Yes" : "No",
          ])}
        />

        {/* Per-asset data elements */}
        {data.assets
          .filter((a) => a.dataElements.length > 0)
          .map((asset) => (
            <View key={asset.id} wrap={false}>
              <SectionSubtitle>
                {asset.name} — Data Elements
              </SectionSubtitle>
              <DataTable
                headers={["Element", "Category", "Sensitivity", "Personal", "Special Cat.", "Retention"]}
                colWidths={[2, 1.5, 1.2, 1, 1.2, 1.2]}
                rows={asset.dataElements.map((el) => [
                  el.name,
                  el.category.replace(/_/g, " "),
                  el.sensitivity,
                  el.isPersonalData ? "Yes" : "No",
                  el.isSpecialCategory ? "Yes" : "No",
                  el.retentionDays != null ? `${el.retentionDays}d` : "—",
                ])}
              />
            </View>
          ))}

        {/* Data Flows */}
        {data.flows.length > 0 && (
          <>
            <SectionTitle>Data Flows</SectionTitle>
            <DataTable
              headers={["Name", "Source", "Destination", "Categories", "Frequency", "Encryption"]}
              colWidths={[2, 1.5, 1.5, 2, 1, 1.5]}
              rows={data.flows.map((f) => [
                f.name,
                f.sourceAsset.name,
                f.destinationAsset.name,
                f.dataCategories.join(", "),
                f.frequency,
                f.encryptionMethod,
              ])}
            />
          </>
        )}

        {/* International Transfers */}
        {data.transfers.length > 0 && (
          <>
            <SectionTitle>International Transfers</SectionTitle>
            <DataTable
              headers={["Name", "Destination", "Organization", "Mechanism", "TIA", "Active"]}
              colWidths={[2, 1.2, 1.5, 2, 1, 0.8]}
              rows={data.transfers.map((t) => [
                t.name,
                t.destinationCountry,
                t.destinationOrg,
                t.mechanism.replace(/_/g, " "),
                t.tiaCompleted ? `Yes (${fmtDate(t.tiaDate)})` : "No",
                t.isActive ? "Yes" : "No",
              ])}
            />
          </>
        )}
      </ContentPage>
    </Document>
  );
}

export function dataInventoryToCSV(data: DataInventoryExportData): string {
  const headers = [
    "Asset Name",
    "Asset Type",
    "Owner",
    "Location",
    "Hosting",
    "Production",
    "Element Name",
    "Element Category",
    "Sensitivity",
    "Personal Data",
    "Special Category",
    "Retention (days)",
  ];

  const rows: string[][] = [];
  for (const asset of data.assets) {
    if (asset.dataElements.length === 0) {
      rows.push([
        asset.name,
        asset.type,
        asset.owner || "",
        asset.location || "",
        asset.hostingType || "",
        asset.isProduction ? "Yes" : "No",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    } else {
      for (const el of asset.dataElements) {
        rows.push([
          asset.name,
          asset.type,
          asset.owner || "",
          asset.location || "",
          asset.hostingType || "",
          asset.isProduction ? "Yes" : "No",
          el.name,
          el.category,
          el.sensitivity,
          el.isPersonalData ? "Yes" : "No",
          el.isSpecialCategory ? "Yes" : "No",
          el.retentionDays != null ? String(el.retentionDays) : "",
        ]);
      }
    }
  }

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
