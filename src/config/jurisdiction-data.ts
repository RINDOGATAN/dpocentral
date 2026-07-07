// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Jurisdiction Core Data — single source of truth for the operative
 * per-jurisdiction numbers (DSAR deadlines, breach-notification windows)
 * and identity fields shared by:
 *
 *   - prisma/seed.ts               (DB seeds — upserts rows from this list)
 *   - src/server/services/privacy/slaCalculator.ts (SLA deadline tables)
 *   - src/config/jurisdiction-catalog.ts (extended editorial layer — its
 *     entries for these codes MUST use the same codes and numbers)
 *
 * Codes here are the canonical DB keys (Jurisdiction.code). Note the
 * hyphenated forms "UK-GDPR" and "PDPA-SG" — these match the seeded DB
 * rows; do not reintroduce underscore variants.
 *
 * Covers only the jurisdictions the seeds create. The full 40+ jurisdiction
 * editorial catalog lives in jurisdiction-catalog.ts.
 */

export interface JurisdictionCoreData {
  /** Canonical DB key (Jurisdiction.code). */
  code: string;
  name: string;
  shortName: string;
  region: string;
  /** Days to respond to a data subject access request. */
  dsarDeadlineDays: number;
  /** Additional extension days available, if any. */
  dsarExtensionDays?: number;
  /** Hours to notify the regulator of a breach; 0 = no fixed statutory clock. */
  breachNotificationHours: number;
  /** Supervisory authority / regulator name. */
  dpaName: string;
}

export const JURISDICTION_CORE_DATA: JurisdictionCoreData[] = [
  {
    code: "GDPR",
    name: "General Data Protection Regulation",
    shortName: "GDPR",
    region: "EU",
    dsarDeadlineDays: 30,
    dsarExtensionDays: 60,
    breachNotificationHours: 72,
    dpaName: "Lead supervisory authority (EDPB member)",
  },
  {
    code: "UK-GDPR",
    name: "UK General Data Protection Regulation",
    shortName: "UK GDPR",
    region: "UK",
    dsarDeadlineDays: 30,
    dsarExtensionDays: 60,
    breachNotificationHours: 72,
    dpaName: "Information Commissioner's Office (ICO)",
  },
  {
    // Single California jurisdiction: the CCPA as amended by the CPRA.
    // The CPRA did not create a separate law — it amended the CCPA and
    // created the CPPA as regulator alongside the Attorney General.
    code: "CCPA",
    name: "California Consumer Privacy Act (as amended by CPRA)",
    shortName: "CCPA/CPRA",
    region: "US-CA",
    dsarDeadlineDays: 45,
    dsarExtensionDays: 45,
    breachNotificationHours: 0, // "Without unreasonable delay" (Cal. Civ. Code 1798.82)
    dpaName: "California Privacy Protection Agency (CPPA) and California Attorney General",
  },
  {
    code: "LGPD",
    name: "Lei Geral de Proteção de Dados",
    shortName: "LGPD",
    region: "BR",
    dsarDeadlineDays: 15,
    dsarExtensionDays: 0,
    // 3 business days per ANPD Res. 15/2024 (72h is an approximation; the
    // legal clock runs in business days)
    breachNotificationHours: 72,
    dpaName: "Autoridade Nacional de Proteção de Dados (ANPD)",
  },
  {
    code: "PIPEDA",
    name: "Personal Information Protection and Electronic Documents Act",
    shortName: "PIPEDA",
    region: "CA",
    dsarDeadlineDays: 30,
    dsarExtensionDays: 30,
    breachNotificationHours: 0, // "As soon as feasible"
    dpaName: "Office of the Privacy Commissioner of Canada (OPC)",
  },
  {
    code: "POPIA",
    name: "Protection of Personal Information Act",
    shortName: "POPIA",
    region: "ZA",
    dsarDeadlineDays: 30,
    dsarExtensionDays: 0,
    breachNotificationHours: 0, // "As soon as reasonably possible"
    dpaName: "Information Regulator (South Africa)",
  },
  {
    code: "PDPA-SG",
    name: "Personal Data Protection Act (Singapore)",
    shortName: "PDPA (SG)",
    region: "SG",
    dsarDeadlineDays: 30,
    dsarExtensionDays: 30,
    breachNotificationHours: 72,
    dpaName: "Personal Data Protection Commission (PDPC)",
  },
  {
    code: "APPI",
    name: "Act on the Protection of Personal Information",
    shortName: "APPI",
    region: "JP",
    dsarDeadlineDays: 14, // "Without delay"
    dsarExtensionDays: 0,
    breachNotificationHours: 72,
    dpaName: "Personal Information Protection Commission (PPC)",
  },
];

/** Lookup by canonical code. */
export const JURISDICTION_CORE_BY_CODE: Record<string, JurisdictionCoreData> =
  Object.fromEntries(JURISDICTION_CORE_DATA.map((j) => [j.code, j]));
