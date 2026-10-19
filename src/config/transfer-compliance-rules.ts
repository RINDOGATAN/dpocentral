// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Transfer Compliance Rules (Feature 4)
 *
 * Schrems II checklist, EU adequacy decision database, supplementary
 * measures catalog, and compliance status evaluation for international
 * data transfers under GDPR Chapter V.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { EU_COUNTRIES } from "../lib/region";
import { canonicalCountryCode } from "../lib/country-code";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * What a partial adequacy decision requires of the recipient before the
 * decision covers the transfer:
 *   - DPF: the US recipient is certified under the EU-US Data Privacy
 *     Framework (listed as active at dataprivacyframework.gov);
 *   - PIPEDA: the Canadian recipient is a commercial organisation subject to
 *     the Personal Information Protection and Electronic Documents Act.
 */
export type PartialAdequacyScope = "DPF" | "PIPEDA";

export interface AdequacyDecision {
  country: string;
  countryCode: string;
  /** Date the adequacy decision was adopted (ISO 8601) */
  decisionDate: string;
  /** Whether the decision covers only certain recipients or transfers */
  isPartial: boolean;
  /** For a partial decision: what must be true of the recipient. */
  partialScope?: PartialAdequacyScope;
  notes?: string;
}

export interface SchremsIIChecklistItem {
  id: string;
  category: string;
  question: string;
  helpText: string;
  required: boolean;
}

export interface SupplementaryMeasure {
  id: string;
  category: "technical" | "contractual" | "organizational";
  name: string;
  description: string;
}

export type TransferComplianceStatus =
  | "COMPLIANT"
  | "NEEDS_REVIEW"
  | "NON_COMPLIANT"
  | "PENDING";

export interface TransferInput {
  mechanism: string;
  destinationCountry: string;
  tiaCompleted: boolean;
  sccExpiryDate?: Date | null;
  supplementaryMeasures?: Record<string, unknown>;
  /**
   * For a destination with a partial adequacy decision: whether the record
   * says the recipient is within its scope (DPF certification for the US,
   * PIPEDA coverage for Canada). Unknown (null/undefined) counts as no.
   */
  adequacyScopeConfirmed?: boolean | null;
}

// ---------------------------------------------------------------------------
// Adequacy Decisions (European Commission list, checked October 2026)
// ---------------------------------------------------------------------------
// Not listed here: the adequacy decision for the European Patent
// Organisation (July 2025), because it covers an international organisation,
// not a country code a transfer record can name.

export const ADEQUACY_DECISIONS: AdequacyDecision[] = [
  {
    country: "Andorra",
    countryCode: "AD",
    decisionDate: "2010-10-19",
    isPartial: false,
  },
  {
    country: "Argentina",
    countryCode: "AR",
    decisionDate: "2003-06-30",
    isPartial: false,
  },
  {
    country: "Brazil",
    countryCode: "BR",
    decisionDate: "2026-01-26",
    isPartial: false,
    notes:
      "Based on the General Data Protection Law (LGPD). Covers the public and private sectors; excludes transfers made only for public security, national defence, state security or criminal investigation and prosecution.",
  },
  {
    country: "Canada",
    countryCode: "CA",
    decisionDate: "2001-12-20",
    isPartial: true,
    partialScope: "PIPEDA",
    notes:
      "Limited to commercial organisations subject to the Personal Information Protection and Electronic Documents Act (PIPEDA). Does not cover all Canadian organisations.",
  },
  {
    country: "Faroe Islands",
    countryCode: "FO",
    decisionDate: "2010-03-05",
    isPartial: false,
  },
  {
    country: "Guernsey",
    countryCode: "GG",
    decisionDate: "2003-11-21",
    isPartial: false,
  },
  {
    country: "Isle of Man",
    countryCode: "IM",
    decisionDate: "2004-04-28",
    isPartial: false,
  },
  {
    country: "Israel",
    countryCode: "IL",
    decisionDate: "2011-01-31",
    isPartial: false,
  },
  {
    country: "Japan",
    countryCode: "JP",
    decisionDate: "2019-01-23",
    isPartial: false,
    notes:
      "Based on the Act on Protection of Personal Information (APPI) with supplementary rules for EU-sourced data.",
  },
  {
    country: "Jersey",
    countryCode: "JE",
    decisionDate: "2008-05-08",
    isPartial: false,
  },
  {
    country: "New Zealand",
    countryCode: "NZ",
    decisionDate: "2012-12-19",
    isPartial: false,
  },
  {
    country: "Republic of Korea",
    countryCode: "KR",
    decisionDate: "2021-12-17",
    isPartial: false,
    notes:
      "Based on the Personal Information Protection Act (PIPA). Confirmed by the Commission's first review in July 2026.",
  },
  {
    country: "Switzerland",
    countryCode: "CH",
    decisionDate: "2000-07-26",
    isPartial: false,
  },
  {
    country: "United Kingdom",
    countryCode: "GB",
    decisionDate: "2021-06-28",
    isPartial: false,
    notes:
      "Adequacy decision adopted post-Brexit under GDPR Art. 45. Renewed by the European Commission on 19 December 2025; valid until 27 December 2031.",
  },
  {
    country: "Uruguay",
    countryCode: "UY",
    decisionDate: "2012-08-21",
    isPartial: false,
  },
  {
    country: "United States",
    countryCode: "US",
    decisionDate: "2023-07-10",
    isPartial: true,
    partialScope: "DPF",
    notes:
      "EU-US Data Privacy Framework (DPF). Only covers US organisations that self-certify under the DPF. Verify recipient certification at dataprivacyframework.gov.",
  },
];

const decisionsByCode = new Map(
  ADEQUACY_DECISIONS.map((d) => [d.countryCode.toUpperCase(), d])
);

/**
 * The EEA: the 27 EU member states (one list, src/lib/region.ts) plus
 * Iceland, Liechtenstein and Norway. Transfers within it are not restricted
 * under GDPR Chapter V.
 */
export const EEA_COUNTRY_CODES: readonly string[] = [...EU_COUNTRIES, "IS", "LI", "NO"];
const EEA_SET = new Set(EEA_COUNTRY_CODES);

/** True when the destination is in the EEA (aliases such as EL accepted). */
export function isEeaCountry(countryCode: string | null | undefined): boolean {
  return EEA_SET.has(canonicalCountryCode(countryCode));
}

// ---------------------------------------------------------------------------
// Schrems II Checklist
// ---------------------------------------------------------------------------

export const SCHREMS_II_CHECKLIST: SchremsIIChecklistItem[] = [
  // Step 1: Know your transfers
  {
    id: "s2_1_map_transfers",
    category: "Know your transfers",
    question:
      "Have you mapped all international transfers of personal data, including onward transfers by processors?",
    helpText:
      "Create a comprehensive inventory of all data flows leaving the EEA, including those by sub-processors, cloud infrastructure providers, and support teams.",
    required: true,
  },
  {
    id: "s2_1_verify_necessity",
    category: "Know your transfers",
    question:
      "Is each transfer necessary, or could the processing be performed within the EEA?",
    helpText:
      "Consider whether the same outcome could be achieved without transferring data to a third country. Data minimization applies to transfers.",
    required: true,
  },

  // Step 2: Identify transfer tool
  {
    id: "s2_2_identify_mechanism",
    category: "Identify transfer tool",
    question:
      "Have you identified the GDPR Chapter V transfer mechanism for each transfer (adequacy, SCCs, BCRs, derogation)?",
    helpText:
      "Each transfer must rely on one of the mechanisms in GDPR Art. 45-49. Document which mechanism applies and ensure it is current.",
    required: true,
  },
  {
    id: "s2_2_scc_version",
    category: "Identify transfer tool",
    question:
      "If using SCCs, are you using the current EU Commission standard contractual clauses (2021 version)?",
    helpText:
      "The old SCCs (2001/2010) are no longer valid. Ensure all SCC agreements have been migrated to the 2021 version.",
    required: true,
  },

  // Step 3: Assess third country law
  {
    id: "s2_3_assess_laws",
    category: "Assess third country law",
    question:
      "Have you assessed whether the laws of the destination country provide essentially equivalent protection?",
    helpText:
      "Consider government surveillance powers, data protection legislation, rule of law, and effective remedies for data subjects. The EDPB recommendations provide guidance.",
    required: true,
  },
  {
    id: "s2_3_access_requests",
    category: "Assess third country law",
    question:
      "Have you evaluated whether public authorities in the destination country can access the transferred data?",
    helpText:
      "Assess the legal framework for government access (national security, law enforcement) and whether it is limited to what is necessary and proportionate.",
    required: true,
  },
  {
    id: "s2_3_practical_experience",
    category: "Assess third country law",
    question:
      "Have you considered practical experience regarding government access requests?",
    helpText:
      "Request information from the data importer about government access requests received, to supplement the legal analysis.",
    required: false,
  },

  // Step 4: Supplementary measures
  {
    id: "s2_4_supplementary_needed",
    category: "Supplementary measures",
    question:
      "If the third country assessment reveals gaps, have you identified supplementary measures to fill those gaps?",
    helpText:
      "Supplementary measures can be technical (encryption, pseudonymization), contractual (additional clauses), or organizational (policies, audits).",
    required: true,
  },
  {
    id: "s2_4_measures_effective",
    category: "Supplementary measures",
    question:
      "Are the supplementary measures effective in ensuring essentially equivalent protection in practice?",
    helpText:
      "Technical measures are generally the most effective. Contractual and organizational measures alone may not be sufficient if the legal framework allows disproportionate government access.",
    required: true,
  },

  // Step 5: Procedural steps
  {
    id: "s2_5_formal_steps",
    category: "Procedural steps",
    question:
      "Have you taken any formal procedural steps required by the chosen transfer mechanism (e.g., SA authorization for BCRs)?",
    helpText:
      "Some mechanisms require prior authorization or notification to the supervisory authority. Ensure all procedural requirements are met.",
    required: false,
  },
  {
    id: "s2_5_documentation",
    category: "Procedural steps",
    question:
      "Have you documented the Transfer Impact Assessment (TIA) and its conclusions?",
    helpText:
      "Maintain records of your assessment as part of your GDPR Art. 5(2) accountability obligations. The TIA should be reviewed and updated regularly.",
    required: true,
  },

  // Step 6: Monitor developments
  {
    id: "s2_6_monitor",
    category: "Monitor developments",
    question:
      "Have you established a process to monitor legal and political developments in the destination country?",
    helpText:
      "Changes in legislation, court rulings, or enforcement practices may affect the validity of your transfer mechanism. Set up alerts and schedule periodic reviews.",
    required: true,
  },
  {
    id: "s2_6_suspend_plan",
    category: "Monitor developments",
    question:
      "Do you have a plan to suspend transfers if protection can no longer be ensured?",
    helpText:
      "If developments mean protection is no longer essentially equivalent and cannot be remedied by supplementary measures, you must suspend the transfer and notify the SA if needed.",
    required: true,
  },
];

// ---------------------------------------------------------------------------
// Supplementary Measures
// ---------------------------------------------------------------------------

export const SUPPLEMENTARY_MEASURES: SupplementaryMeasure[] = [
  // Technical measures
  {
    id: "tech_encryption_transit",
    category: "technical",
    name: "Encryption in transit",
    description:
      "Use TLS 1.2+ or equivalent for all data in transit. Ensure the encryption keys are managed within the EEA or an adequate country.",
  },
  {
    id: "tech_encryption_rest",
    category: "technical",
    name: "Encryption at rest",
    description:
      "Encrypt personal data at rest using AES-256 or equivalent. Encryption keys should be held by the data exporter or a trusted third party in an adequate jurisdiction, not accessible by the data importer or third country authorities.",
  },
  {
    id: "tech_pseudonymization",
    category: "technical",
    name: "Pseudonymization",
    description:
      "Replace directly identifying data with pseudonyms before transfer. The mapping table must be kept in the EEA and not accessible to the data importer.",
  },
  {
    id: "tech_access_controls",
    category: "technical",
    name: "Strict access controls",
    description:
      "Implement role-based access controls, multi-factor authentication, and least-privilege access policies on all systems processing transferred data.",
  },
  {
    id: "tech_split_processing",
    category: "technical",
    name: "Split or multi-party processing",
    description:
      "Distribute data across multiple jurisdictions or providers such that no single entity in a non-adequate country has access to the complete dataset.",
  },

  // Contractual measures
  {
    id: "cont_enhanced_clauses",
    category: "contractual",
    name: "Enhanced contractual clauses",
    description:
      "Include specific obligations for the data importer to challenge disproportionate government access requests and to notify the data exporter promptly.",
  },
  {
    id: "cont_transparency_obligations",
    category: "contractual",
    name: "Transparency obligations",
    description:
      "Require the data importer to provide regular transparency reports on government access requests received and to confirm compliance with their obligations.",
  },
  {
    id: "cont_audit_rights",
    category: "contractual",
    name: "Audit rights",
    description:
      "Contractually secure the right to audit the data importer's compliance with the transfer safeguards, including unannounced audits.",
  },
  {
    id: "cont_warrant_canary",
    category: "contractual",
    name: "Warrant canary / notification clause",
    description:
      "Include a clause requiring the data importer to notify the exporter of any legally binding request for access by a public authority, to the extent permitted by law.",
  },

  // Organizational measures
  {
    id: "org_policies",
    category: "organizational",
    name: "Internal policies and procedures",
    description:
      "Adopt and enforce internal policies for handling government access requests, including escalation procedures, legal review, and documentation requirements.",
  },
  {
    id: "org_training",
    category: "organizational",
    name: "Staff training",
    description:
      "Provide regular training to personnel involved in processing transferred data on their obligations under GDPR and the transfer safeguards in place.",
  },
  {
    id: "org_dpo_involvement",
    category: "organizational",
    name: "DPO involvement",
    description:
      "Ensure the Data Protection Officer is involved in evaluating and monitoring international transfers, and has access to all TIA documentation.",
  },
  {
    id: "org_certification",
    category: "organizational",
    name: "Certifications and standards",
    description:
      "Require or prefer data importers that hold relevant certifications (ISO 27001, SOC 2, ISO 27701) demonstrating mature security and privacy controls.",
  },
];

// ---------------------------------------------------------------------------
// Evaluation Functions
// ---------------------------------------------------------------------------

/**
 * How far an adequacy decision covers a destination:
 *   - EEA: not a restricted transfer at all;
 *   - FULL: a full adequacy decision;
 *   - PARTIAL_CONFIRMED: a partial decision, and the record says the
 *     recipient is within its scope (e.g. DPF-certified);
 *   - PARTIAL_UNCONFIRMED: a partial decision, scope not recorded: the
 *     decision does not cover the transfer until it is;
 *   - NONE: no adequacy decision.
 */
export type AdequacyCoverage =
  | "EEA"
  | "FULL"
  | "PARTIAL_CONFIRMED"
  | "PARTIAL_UNCONFIRMED"
  | "NONE";

export function adequacyCoverage(
  countryCode: string | null | undefined,
  adequacyScopeConfirmed?: boolean | null
): AdequacyCoverage {
  const code = canonicalCountryCode(countryCode);
  if (EEA_SET.has(code)) return "EEA";
  const decision = decisionsByCode.get(code);
  if (!decision) return "NONE";
  if (!decision.isPartial) return "FULL";
  return adequacyScopeConfirmed === true ? "PARTIAL_CONFIRMED" : "PARTIAL_UNCONFIRMED";
}

/** True when no Chapter V safeguard is needed: EEA, full adequacy, or a partial decision whose scope is recorded. */
function coveredByAdequacy(coverage: AdequacyCoverage): boolean {
  return coverage === "EEA" || coverage === "FULL" || coverage === "PARTIAL_CONFIRMED";
}

/**
 * Check if a destination needs no Chapter V safeguard: within the EEA, a
 * full adequacy decision, or a partial decision (US, Canada) whose scope the
 * record confirms. A partial decision without that confirmation is not
 * adequate for the transfer.
 */
export function isAdequateCountry(
  countryCode: string,
  adequacyScopeConfirmed?: boolean | null
): boolean {
  return coveredByAdequacy(adequacyCoverage(countryCode, adequacyScopeConfirmed));
}

/**
 * Get the adequacy decision details for a country, if one exists.
 */
export function getAdequacyDecision(
  countryCode: string
): AdequacyDecision | undefined {
  return decisionsByCode.get(canonicalCountryCode(countryCode));
}

/** The kind of Chapter V tool a stored mechanism names. */
type MechanismKind = "NONE" | "ADEQUACY" | "ART46" | "SCC" | "DEROGATION" | "OTHER";

function mechanismKind(mechanism: string | null | undefined): MechanismKind {
  const m = (mechanism ?? "").toUpperCase().replace(/[\s_-]+/g, "");
  if (m === "" || m === "NONE") return "NONE";
  if (m.includes("ADEQUACY") || m.includes("ART45")) return "ADEQUACY";
  if (m.includes("SCC") || m.includes("STANDARDCONTRACTUAL")) return "SCC";
  if (
    m.includes("BCR") ||
    m.includes("BINDINGCORPORATE") ||
    m.includes("CERTIFICATION") ||
    m.includes("CODEOFCONDUCT")
  ) {
    return "ART46";
  }
  if (m.includes("DEROGATION") || m.includes("ART49")) return "DEROGATION";
  return "OTHER";
}

/**
 * Determine the compliance status of an international data transfer.
 *
 * Logic:
 * - EEA-internal transfer → COMPLIANT (not a restricted transfer)
 * - Full adequacy decision → COMPLIANT
 * - Partial adequacy (US under the DPF, Canada under PIPEDA) → COMPLIANT
 *   only when the record confirms the recipient is within the decision's
 *   scope; otherwise the mechanism rules below apply
 * - "Adequacy decision" stated but not covered → NEEDS_REVIEW
 * - SCCs with an expired expiry date → NON_COMPLIANT
 * - SCCs, BCRs, certification or code of conduct (Art. 46) without a
 *   completed TIA → NEEDS_REVIEW; with one → COMPLIANT
 * - Derogation (Art. 49) → NEEDS_REVIEW (case-by-case)
 * - No mechanism → NON_COMPLIANT
 * - Any other mechanism → PENDING
 */
export function getTransferComplianceStatus(
  transfer: TransferInput
): TransferComplianceStatus {
  const coverage = adequacyCoverage(
    transfer.destinationCountry,
    transfer.adequacyScopeConfirmed
  );
  if (coveredByAdequacy(coverage)) return "COMPLIANT";

  switch (mechanismKind(transfer.mechanism)) {
    case "NONE":
      return "NON_COMPLIANT";
    case "ADEQUACY":
      // Adequacy claimed, but the country has none, or the recipient is not
      // recorded as within a partial decision's scope.
      return "NEEDS_REVIEW";
    case "SCC":
      if (transfer.sccExpiryDate && new Date(transfer.sccExpiryDate) < new Date()) {
        return "NON_COMPLIANT";
      }
      return transfer.tiaCompleted ? "COMPLIANT" : "NEEDS_REVIEW";
    case "ART46":
      return transfer.tiaCompleted ? "COMPLIANT" : "NEEDS_REVIEW";
    case "DEROGATION":
      return "NEEDS_REVIEW";
    case "OTHER":
      return "PENDING";
  }
}

/**
 * Get a human-readable summary of why a transfer has its current status.
 */
export function getTransferComplianceExplanation(
  transfer: TransferInput
): string {
  const status = getTransferComplianceStatus(transfer);
  const coverage = adequacyCoverage(
    transfer.destinationCountry,
    transfer.adequacyScopeConfirmed
  );

  if (coverage === "EEA") {
    return "Transfer within the EEA: no Chapter V restrictions apply.";
  }

  const decision = getAdequacyDecision(transfer.destinationCountry);
  const kind = mechanismKind(transfer.mechanism);

  switch (status) {
    case "COMPLIANT":
      if (decision && coverage !== "PARTIAL_UNCONFIRMED") {
        const partialNote = decision.isPartial
          ? " The record confirms the recipient is within the scope of this partial decision."
          : "";
        return `${decision.country} has an EU adequacy decision (adopted ${decision.decisionDate}).${partialNote}`;
      }
      return "Transfer mechanism and safeguards are in place and current.";

    case "NEEDS_REVIEW":
      if (coverage === "PARTIAL_UNCONFIRMED" && kind === "ADEQUACY") {
        return `The adequacy decision for ${decision?.country ?? transfer.destinationCountry} covers only some recipients. Record that the recipient is within its scope, or rely on another safeguard.`;
      }
      if ((kind === "SCC" || kind === "ART46") && !transfer.tiaCompleted) {
        return "The safeguard is in place but a Transfer Impact Assessment (TIA) has not been completed. A TIA is required following the Schrems II ruling.";
      }
      return "Transfer mechanism requires further review to confirm compliance.";

    case "NON_COMPLIANT":
      if (
        transfer.sccExpiryDate &&
        new Date(transfer.sccExpiryDate) < new Date()
      ) {
        return `SCCs expired on ${new Date(transfer.sccExpiryDate).toISOString().split("T")[0]}. Renewal is required before data transfers can continue lawfully.`;
      }
      return "No valid transfer mechanism is in place. Data transfers must be suspended until a lawful mechanism is established.";

    case "PENDING":
      return "Transfer compliance has not yet been assessed. Complete the evaluation to determine status.";
  }
}
