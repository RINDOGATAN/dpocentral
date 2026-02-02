/**
 * Record of Processing Activities (ROPA) Generator
 *
 * Exports processing activities to various formats for compliance reporting.
 */

export interface ROPAEntry {
  name: string;
  description?: string | null;
  purpose: string;
  legalBasis: string;
  legalBasisDetail?: string | null;
  dataSubjects: string[];
  dataCategories: string[];
  recipients: string[];
  retentionPeriod?: string | null;
  automatedDecisionMaking: boolean;
  automatedDecisionDetail?: string | null;
  systems: Array<{
    name: string;
    type: string;
    location?: string | null;
    elements: Array<{
      name: string;
      category: string;
      sensitivity: string;
    }>;
  }>;
  transfers: Array<{
    destination: string;
    organization?: string | null;
    mechanism: string;
    safeguards?: string | null;
  }>;
  lastReviewed?: Date | null;
  nextReview?: Date | null;
}

/**
 * Convert ROPA data to CSV format
 */
export function ropaToCSV(entries: ROPAEntry[]): string {
  const headers = [
    "Processing Activity",
    "Purpose",
    "Legal Basis",
    "Data Subjects",
    "Data Categories",
    "Recipients",
    "Retention Period",
    "Automated Decision Making",
    "Systems",
    "International Transfers",
    "Last Reviewed",
    "Next Review",
  ];

  const rows = entries.map(entry => [
    entry.name,
    entry.purpose,
    `${entry.legalBasis}${entry.legalBasisDetail ? ` - ${entry.legalBasisDetail}` : ""}`,
    entry.dataSubjects.join("; "),
    entry.dataCategories.join("; "),
    entry.recipients.join("; "),
    entry.retentionPeriod || "Not specified",
    entry.automatedDecisionMaking ? `Yes - ${entry.automatedDecisionDetail || ""}` : "No",
    entry.systems.map(s => s.name).join("; "),
    entry.transfers.map(t => `${t.destination} (${t.mechanism})`).join("; ") || "None",
    entry.lastReviewed ? new Date(entry.lastReviewed).toISOString().split("T")[0] : "",
    entry.nextReview ? new Date(entry.nextReview).toISOString().split("T")[0] : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Convert ROPA data to JSON for API consumption
 */
export function ropaToJSON(entries: ROPAEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

/**
 * Generate ROPA summary statistics
 */
export function generateROPASummary(entries: ROPAEntry[]): {
  totalActivities: number;
  byLegalBasis: Record<string, number>;
  byDataCategory: Record<string, number>;
  withInternationalTransfers: number;
  withAutomatedDecisions: number;
  needingReview: number;
} {
  const now = new Date();

  const byLegalBasis: Record<string, number> = {};
  const byDataCategory: Record<string, number> = {};
  let withInternationalTransfers = 0;
  let withAutomatedDecisions = 0;
  let needingReview = 0;

  for (const entry of entries) {
    // Count by legal basis
    byLegalBasis[entry.legalBasis] = (byLegalBasis[entry.legalBasis] || 0) + 1;

    // Count by data category
    for (const category of entry.dataCategories) {
      byDataCategory[category] = (byDataCategory[category] || 0) + 1;
    }

    // Count international transfers
    if (entry.transfers.length > 0) {
      withInternationalTransfers++;
    }

    // Count automated decision making
    if (entry.automatedDecisionMaking) {
      withAutomatedDecisions++;
    }

    // Count needing review
    if (entry.nextReview && new Date(entry.nextReview) <= now) {
      needingReview++;
    }
  }

  return {
    totalActivities: entries.length,
    byLegalBasis,
    byDataCategory,
    withInternationalTransfers,
    withAutomatedDecisions,
    needingReview,
  };
}

/**
 * Validate ROPA entry for completeness
 */
export function validateROPAEntry(entry: ROPAEntry): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!entry.name) missingFields.push("name");
  if (!entry.purpose) missingFields.push("purpose");
  if (!entry.legalBasis) missingFields.push("legalBasis");
  if (entry.dataSubjects.length === 0) missingFields.push("dataSubjects");
  if (entry.dataCategories.length === 0) missingFields.push("dataCategories");

  // Warnings
  if (!entry.retentionPeriod) {
    warnings.push("Retention period not specified");
  }
  if (entry.recipients.length === 0) {
    warnings.push("No recipients specified");
  }
  if (entry.systems.length === 0) {
    warnings.push("No systems/assets linked");
  }
  if (!entry.lastReviewed) {
    warnings.push("Never reviewed");
  }
  if (entry.automatedDecisionMaking && !entry.automatedDecisionDetail) {
    warnings.push("Automated decision making enabled but no details provided");
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
