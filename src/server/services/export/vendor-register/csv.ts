// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * CSV export for the Vendor Register. Kept separate from the PDF document so
 * routes can pull only the export format they need.
 */

import { CSV_WORDS_EN, rawCode, type CsvLabels } from "@/server/services/export/csv-labels";

export interface VendorCsvRow {
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

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0]!;
}

export const VENDOR_CSV_KEYS = [
  "name",
  "status",
  "riskTier",
  "riskScore",
  "website",
  "primaryContact",
  "contactEmail",
  "categories",
  "dataProcessed",
  "countries",
  "certifications",
  "lastAssessed",
  "nextReview",
  "contractNames",
  "dpaStatus",
] as const;
export type VendorCsvKey = (typeof VENDOR_CSV_KEYS)[number];

/** The English CSV: column names as they have always been, raw codes. */
export const VENDOR_CSV_EN: CsvLabels<VendorCsvKey> = {
  headers: {
    name: "Name",
    status: "Status",
    riskTier: "Risk Tier",
    riskScore: "Risk Score",
    website: "Website",
    primaryContact: "Primary Contact",
    contactEmail: "Contact Email",
    categories: "Categories",
    dataProcessed: "Data Processed",
    countries: "Countries",
    certifications: "Certifications",
    lastAssessed: "Last Assessed",
    nextReview: "Next Review",
    contractNames: "Contract Names",
    dpaStatus: "DPA Status",
  },
  words: CSV_WORDS_EN,
  code: rawCode,
};

export function vendorsToCSV(vendors: VendorCsvRow[], labels: CsvLabels<VendorCsvKey> = VENDOR_CSV_EN): string {
  const { headers: h, words: w, code } = labels;
  const headers = VENDOR_CSV_KEYS.map((k) => h[k]);

  const rows = vendors.map((v) => {
    const dpa = v.contracts.find((c) => c.type === "DPA");
    return [
      v.name,
      code("vendorStatus", v.status),
      v.riskTier ? code("riskLevel", v.riskTier) : "",
      v.riskScore != null ? String(v.riskScore) : "",
      v.website ?? "",
      v.primaryContact ?? "",
      v.contactEmail ?? "",
      v.categories.map((c) => code("vendorCategory", c)).join("; "),
      v.dataProcessed.map((d) => code("dataCategory", d)).join("; "),
      v.countries.join("; "),
      v.certifications.join("; "),
      fmtDate(v.lastAssessedAt),
      fmtDate(v.nextReviewAt),
      v.contracts.map((c) => c.name).join("; "),
      dpa ? code("contractStatus", dpa.status) : w.noDpa,
    ];
  });

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
}
