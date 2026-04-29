/**
 * Jurisdiction Requirements Catalog.
 *
 * Defines the **actionable** compliance requirements per jurisdiction, mapped
 * to checks against existing modules (ROPA, assessments, vendors, AI systems,
 * transfers, DSAR settings). The Regulations hub queries this to render a
 * "GDPR applies — here's what's required, here's what you've done" checklist
 * on each applied-jurisdiction card.
 *
 * Keep this small and high-signal. Each requirement should map to a single
 * concrete artifact a privacy officer can produce, not a vague principle.
 */

export type RequirementId =
  | "ropa"
  | "dpia"
  | "dsar-portal"
  | "incident-response"
  | "vendor-dpas"
  | "transfer-tia"
  | "ai-system-register";

export interface JurisdictionRequirement {
  id: RequirementId;
  /** What needs to be done. */
  title: string;
  /** One-line context. */
  description: string;
  /** Where to act on this. */
  actionHref: string;
}

/**
 * Universal requirements: apply to any "comprehensive" privacy regulation
 * (GDPR, UK_GDPR, FADP, CPRA, VCDPA, LGPD, etc.).
 */
const UNIVERSAL_REQUIREMENTS: JurisdictionRequirement[] = [
  {
    id: "ropa",
    title: "Maintain a Record of Processing Activities (ROPA)",
    description:
      "Document all processing activities your organisation performs, including purpose, legal basis, and data categories.",
    actionHref: "/privacy/data-inventory",
  },
  {
    id: "dpia",
    title: "Conduct DPIAs for high-risk processing",
    description:
      "Document a Data Protection Impact Assessment for any processing likely to result in a high risk to data subjects.",
    actionHref: "/privacy/assessments",
  },
  {
    id: "dsar-portal",
    title: "Provide a public data subject request channel",
    description:
      "Configure an intake form so data subjects can submit access, rectification, erasure, and other requests.",
    actionHref: "/privacy/dsar/settings",
  },
  {
    id: "incident-response",
    title: "Establish a breach response process",
    description:
      "Have a documented incident-response workflow so breaches can be triaged, contained, and notified within statutory deadlines.",
    actionHref: "/privacy/incidents",
  },
  {
    id: "vendor-dpas",
    title: "Sign DPAs with all data processors",
    description:
      "Maintain a Data Processing Agreement with every active vendor that processes personal data on your behalf.",
    actionHref: "/privacy/vendors",
  },
];

/**
 * Cross-border transfer requirement: applies when the jurisdiction itself
 * regulates international transfers (most comprehensive regimes do).
 */
const TRANSFER_TIA_REQUIREMENT: JurisdictionRequirement = {
  id: "transfer-tia",
  title: "Complete a TIA for each international data transfer",
  description:
    "When personal data leaves the regulated territory, a Transfer Impact Assessment (Schrems II) is required for non-adequate destinations.",
  actionHref: "/privacy/data-inventory?tab=transfers",
};

/**
 * AI system register: applies to AI-governance regulations (EU AI Act etc.).
 */
const AI_REGISTER_REQUIREMENT: JurisdictionRequirement = {
  id: "ai-system-register",
  title: "Maintain an AI system register",
  description:
    "Document each AI system in use, classify its risk tier, and track provider/deployer obligations.",
  actionHref: "/privacy/ai-systems",
};

/**
 * Returns the requirements that apply to a given jurisdiction.
 * Currently keyed off jurisdiction code + category — extend with overrides
 * as we onboard sectoral / niche regulations that need bespoke checks.
 */
export function getRequirementsForJurisdiction(input: {
  code: string;
  category: string;
}): JurisdictionRequirement[] {
  const reqs: JurisdictionRequirement[] = [];

  if (input.category === "ai_governance") {
    reqs.push(AI_REGISTER_REQUIREMENT);
    // AI regulations often layer on top of a comprehensive regime; no
    // universal-set duplication unless the org also applied GDPR/etc.
    return reqs;
  }

  // Default: comprehensive privacy regimes get the universal set + transfer TIA.
  reqs.push(...UNIVERSAL_REQUIREMENTS);
  reqs.push(TRANSFER_TIA_REQUIREMENT);

  return reqs;
}
