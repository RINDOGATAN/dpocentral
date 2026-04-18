/**
 * CSV export for the Vendor Register. Kept separate from the PDF document so
 * routes can pull only the export format they need.
 */

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

export function vendorsToCSV(vendors: VendorCsvRow[]): string {
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
      v.riskTier ?? "",
      v.riskScore != null ? String(v.riskScore) : "",
      v.website ?? "",
      v.primaryContact ?? "",
      v.contactEmail ?? "",
      v.categories.join("; "),
      v.dataProcessed.join("; "),
      v.countries.join("; "),
      v.certifications.join("; "),
      fmtDate(v.lastAssessedAt),
      fmtDate(v.nextReviewAt),
      v.contracts.map((c) => c.name).join("; "),
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
