// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Dealroom solo-intake fact package — the seam between DPO Central and
 * Dealroom (schema "dealroom.solo-intake/1", POST /api/v1/agent/deals).
 *
 * DPO Central holds the understanding of each customer's stack —
 * sub-processors, hosting regions, data categories, evidenced controls.
 * Dealroom holds the contract know-how. This package carries FACTS across
 * the boundary; drafting never does, in either direction. Dealroom answers
 * with an agreed SOLO deal and download URLs for the full document set
 * (DPA PDF/DOCX/TXT + the standalone Transfer Impact Assessment).
 *
 * Clause and option identifiers are the skill-authored ids/codes (stable
 * across reseeds), never database ids. The full clause/option catalog and
 * parameter schema are introspectable via GET /api/v1/agent/templates/:type.
 */

export interface DealroomFactPackage {
  schema: "dealroom.solo-intake/1";
  /** e.g. "DPA" */
  contractType: string;
  /** "SPAIN" | "CALIFORNIA" | "ENGLAND_WALES" (per template) */
  governingLaw: string;
  /** "en" | "es" */
  language?: string;
  dealName: string;
  initiatorEmail?: string;
  initiatorCompany?: string;
  /** Asymmetric-role contracts: "PROCESSOR" | "CONTROLLER" (DPA). */
  fillRole?: string;
  /** Wizard parameters by authored id — see DpaParameters for the DPA set. */
  parameters?: Record<string, string>;
  /** clauseId → option code (or authored optionId). */
  selections?: Record<string, string>;
  /**
   * "defaults": unspecified clauses take the skill's baseline option for
   * the jurisdiction. "explicit" (default): they stay unresolved and are
   * reported back — the deal is then not AGREED until resolved in the UI.
   */
  selectionPolicy?: "explicit" | "defaults";
}

/**
 * The DPA's parameter catalog (authored ids). All values are strings;
 * multi-selects are comma-joined. Optional unless noted.
 */
export interface DpaParameters {
  /** REQUIRED — verbatim into Annex I §2 and the TIA. */
  "processing-purpose": string;
  /** REQUIRED — comma-joined canonical keys: contact-details,
   * identification-data, financial-data, account-credentials,
   * usage-technical, location-data, professional-data, marketing-comms,
   * support-content, special-category, children-data */
  "data-categories": string;
  /** Free-text additional categories (semicolon-separated). */
  "data-categories-other"?: string;
  /** Negative scope — data the processor never receives. Renders as its
   * own Annex I section; the strongest safeguard to state. */
  "data-excluded"?: string;
  /** REQUIRED — "EEA" | "UK" | "US" | "OTHER". US/OTHER adds the SCC
   * incorporation annex (and the TIA unless declined). */
  "processor-establishment": string;
  /** "yes" | "no" — active EU-U.S. Data Privacy Framework certification. */
  "processor-dpf-certified"?: string;
  /** "yes" | "no" (default yes) — attach the TIA as Annex IV. */
  "include-tia"?: string;
  /** Comma-joined technical/organizational measures actually applied:
   * tech-encryption-transit, tech-encryption-rest, tech-eu-held-keys,
   * tech-client-side-encryption, tech-pseudonymization, tech-eu-residency,
   * tech-split-processing, org-request-policy, org-audits-review.
   * Contractual measures are NOT listed here — they derive from agreeing
   * the government-access-requests clause. */
  "tia-safeguards"?: string;
  /** "yes" | "no" | "unknown" — hosted/cloud service (ECSP analysis). */
  "tia-importer-hosted"?: string;
  /** "none" | "some" | "unknown" — declared government-request history. */
  "tia-gov-requests-received"?: string;
  /** "none" | "some" | "unknown" — declared notifiable-breach history. */
  "tia-breach-history"?: string;
  /** Comma-joined Annex II controls the processor can evidence:
   * toms-encryption-rest, toms-access-reviews, toms-network, toms-logging,
   * toms-backup-dr, toms-personnel-checks, toms-testing.
   * Unselected areas stay at the modest baseline. */
  "toms-confirmed"?: string;
  /** Subset of toms-confirmed operated by infrastructure sub-processors —
   * Annex II attributes them with the audit-report validation mechanism. */
  "toms-inherited"?: string;
  /** "provider-managed" (default) | "own-facilities". */
  "toms-physical"?: string;
  /** Named day-one sub-processors, semicolon-separated with roles/regions. */
  "subprocessor-list"?: string;
  /** Only with the custom law/forum clause option. */
  "custom-governing-law"?: string;
  "custom-courts"?: string;
}

/** DPA clause ids and their commonly used option codes for `selections`. */
export const DPA_CLAUSE_OPTIONS = {
  "breach-notification": ["24h", "48h", "72h", "undue-delay"],
  "subprocessor-approval": ["general-30d", "specific", "general-14d", "no-objection"],
  "government-access-requests": ["commitments", "none"],
  "data-deletion": [
    "return-30d",
    "return-or-delete-60d",
    "delete-90d",
    "retain",
    "backup-rotation",
  ],
  "audit-rights": ["full-onsite", "hybrid", "reports-only", "questionnaire"],
} as const;

export interface DealroomIntakeResponse {
  agentDealRoomId: string;
  status: "AGREED" | "NEGOTIATING";
  unresolvedClauseIds: string[];
  /** Null until the deal is AGREED. Paths relative to the Dealroom origin. */
  documents: {
    pdf: string;
    docx: string;
    txt: string;
    tia: string;
  } | null;
}
