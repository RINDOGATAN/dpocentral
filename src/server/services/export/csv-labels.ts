// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Words for the human-facing CSV registers (records of processing, vendor
 * register, breach register). The English output is the generators' own
 * built-in text and stays exactly as it was; for any other locale the column
 * names come from `pdf.csv` and the codes (legal basis, categories, statuses,
 * severities, types, mechanisms) from the `enums` labels the screens use.
 *
 * The programme ZIP (the portability format) does not use this module and
 * stays in English with raw codes.
 */

export type CsvEnumKind =
  | "legalBasis"
  | "dataCategory"
  | "transferMechanism"
  | "vendorStatus"
  | "riskLevel"
  | "contractStatus"
  | "incidentType"
  | "incidentSeverity"
  | "incidentStatus";

export const CSV_ENUM_KINDS: readonly CsvEnumKind[] = [
  "legalBasis",
  "dataCategory",
  "transferMechanism",
  "vendorStatus",
  "riskLevel",
  "contractStatus",
  "incidentType",
  "incidentSeverity",
  "incidentStatus",
];

export interface CsvWords {
  notSpecified: string;
  yes: string;
  no: string;
  none: string;
  noDpa: string;
}

/** Labels for one register: its column names, the shared words, the codes. */
export interface CsvLabels<H extends string> {
  headers: Record<H, string>;
  words: CsvWords;
  code: (kind: CsvEnumKind, value: string) => string;
}

export const CSV_WORDS_EN: CsvWords = {
  notSpecified: "Not specified",
  yes: "Yes",
  no: "No",
  none: "None",
  noDpa: "No DPA",
};

/** Codes as stored: the English CSVs carry raw codes. */
export const rawCode = (_kind: CsvEnumKind, value: string): string => value;
