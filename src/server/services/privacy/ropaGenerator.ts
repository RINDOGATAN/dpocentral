// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Record of processing activities (GDPR Art. 30): the shape every export
 * (PDF, CSV, XLSX, JSON) reads, the cover figures and the per-activity
 * completeness check. Language-free: warnings are codes, translated where
 * the document is written (see ../export/ropa/record-text.ts).
 */

import { missingRecordFields } from "@/lib/record-completeness";

/** How the organisation takes part in the activity (Prisma ProcessingRole). */
export type RopaRole = "CONTROLLER" | "JOINT_CONTROLLER" | "PROCESSOR";

/** Which of the two records of Art. 30 a document is. */
export type RopaRecordKind = "controller" | "processor";

export interface ROPATransfer {
  /** ISO 3166 code as stored (the documents print the country's name). */
  destination: string;
  organization?: string | null;
  mechanism: string;
  safeguards?: string | null;
  tiaCompleted?: boolean;
  tiaDate?: Date | null;
}

export interface ROPAEntry {
  name: string;
  description?: string | null;
  role?: RopaRole;
  jointControllerDetails?: string | null;
  purpose: string;
  legalBasis: string;
  legalBasisDetail?: string | null;
  dataSubjects: string[];
  dataCategories: string[];
  recipients: string[];
  retentionPeriod?: string | null;
  retentionDays?: number | null;
  /** The measures that apply: the activity's own, or the organisation's. */
  securityMeasures?: string | null;
  /** True when securityMeasures is the organisation's general description. */
  securityInherited?: boolean;
  automatedDecisionMaking: boolean;
  automatedDecisionDetail?: string | null;
  /** Processor activities: the controller on whose behalf it is carried out. */
  clientControllerName?: string | null;
  clientControllerContact?: string | null;
  clientRepresentative?: string | null;
  clientDpo?: string | null;
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
  transfers: ROPATransfer[];
  lastReviewed?: Date | null;
  nextReview?: Date | null;
}

/** Special categories of personal data (Art. 9) and criminal data (Art. 10). */
export const SPECIAL_CATEGORIES: ReadonlySet<string> = new Set([
  "HEALTH",
  "BIOMETRIC",
  "GENETIC",
  "POLITICAL",
  "RELIGIOUS",
  "SEXUAL_ORIENTATION",
  "CRIMINAL",
]);

/** An activity needs review when it has never been reviewed or its date has passed. */
export function needsReview(entry: Pick<ROPAEntry, "lastReviewed" | "nextReview">, now = new Date()): boolean {
  if (!entry.lastReviewed) return true;
  return !!entry.nextReview && new Date(entry.nextReview) <= now;
}

/**
 * Generate ROPA summary statistics
 */
export function generateROPASummary(entries: ROPAEntry[], now = new Date()): {
  totalActivities: number;
  byLegalBasis: Record<string, number>;
  byDataCategory: Record<string, number>;
  withInternationalTransfers: number;
  withAutomatedDecisions: number;
  needingReview: number;
  neverReviewed: number;
  incomplete: number;
} {
  const byLegalBasis: Record<string, number> = {};
  const byDataCategory: Record<string, number> = {};
  let withInternationalTransfers = 0;
  let withAutomatedDecisions = 0;
  let needingReview = 0;
  let neverReviewed = 0;
  let incomplete = 0;

  for (const entry of entries) {
    byLegalBasis[entry.legalBasis] = (byLegalBasis[entry.legalBasis] || 0) + 1;
    for (const category of entry.dataCategories) {
      byDataCategory[category] = (byDataCategory[category] || 0) + 1;
    }
    if (entry.transfers.length > 0) withInternationalTransfers++;
    if (entry.automatedDecisionMaking) withAutomatedDecisions++;
    if (!entry.lastReviewed) neverReviewed++;
    if (needsReview(entry, now)) needingReview++;
    if (!validateROPAEntry(entry).isValid) incomplete++;
  }

  return {
    totalActivities: entries.length,
    byLegalBasis,
    byDataCategory,
    withInternationalTransfers,
    withAutomatedDecisions,
    needingReview,
    neverReviewed,
    incomplete,
  };
}

/** Why an activity is incomplete: the same rule as the "Incomplete" list. */
export type RopaMissingField = "name" | "purpose" | "legalBasis" | "dataSubjects" | "categories" | "recipients" | "retention";

/** Gaps that do not make the record incomplete but are worth a note. */
export type RopaWarning =
  | "retentionMissing"
  | "recipientsMissing"
  | "dataSubjectsMissing"
  | "categoriesMissing"
  | "securityMissing"
  | "noSystems"
  | "neverReviewed"
  | "reviewOverdue"
  | "automatedNoDetail"
  | "clientControllerMissing";

/**
 * Validate an entry. `isValid` follows src/lib/record-completeness.ts (the
 * rule the register and the review queue use) plus the three fields every
 * record is created with; `warnings` are codes, in display order.
 */
export function validateROPAEntry(entry: ROPAEntry, now = new Date()): {
  isValid: boolean;
  missingFields: RopaMissingField[];
  warnings: RopaWarning[];
} {
  const missingFields: RopaMissingField[] = [];
  if (!entry.name) missingFields.push("name");
  if (!entry.purpose) missingFields.push("purpose");
  if (!entry.legalBasis && entry.role !== "PROCESSOR") missingFields.push("legalBasis");
  missingFields.push(
    ...missingRecordFields({
      dataSubjects: entry.dataSubjects,
      categories: entry.dataCategories,
      recipients: entry.recipients,
      retentionPeriod: entry.retentionPeriod,
      retentionDays: entry.retentionDays,
    }),
  );

  const warnings: RopaWarning[] = [];
  if (entry.dataSubjects.length === 0) warnings.push("dataSubjectsMissing");
  if (entry.dataCategories.length === 0) warnings.push("categoriesMissing");
  if (missingFields.includes("retention")) warnings.push("retentionMissing");
  if (entry.recipients.length === 0) warnings.push("recipientsMissing");
  if (!entry.securityMeasures?.trim()) warnings.push("securityMissing");
  if (entry.role === "PROCESSOR" && !entry.clientControllerName?.trim()) warnings.push("clientControllerMissing");
  if (entry.systems.length === 0) warnings.push("noSystems");
  if (!entry.lastReviewed) warnings.push("neverReviewed");
  else if (entry.nextReview && new Date(entry.nextReview) <= now) warnings.push("reviewOverdue");
  if (entry.automatedDecisionMaking && !entry.automatedDecisionDetail) warnings.push("automatedNoDetail");

  return { isValid: missingFields.length === 0, missingFields, warnings };
}
