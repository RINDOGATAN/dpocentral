// PET-to-Risk mapping for DPIA mitigation suggestions
// Maps privacy risk categories to recommended Privacy Enhancing Technologies
// with GDPR article references for compliance documentation

export const PET_RISK_MAPPINGS = [
  {
    riskId: "large_scale_processing",
    label: "Large-scale data processing",
    description: "Processing personal data at scale increases exposure risk",
    recommendedPets: ["Differential Privacy", "Anonymization", "k-Anonymity", "Synthetic Data"],
    gdprReference: "Art. 35(3)(b)",
  },
  {
    riskId: "special_category_data",
    label: "Special category data processing",
    description: "Processing of Art. 9 sensitive data (health, biometric, political, etc.)",
    recommendedPets: ["Pseudonymization", "Tokenization", "Homomorphic Encryption", "Data Masking"],
    gdprReference: "Art. 9, Art. 35(3)(b)",
  },
  {
    riskId: "cross_border_transfer",
    label: "International data transfers",
    description: "Transfer of personal data outside EEA without adequacy decision",
    recommendedPets: ["Homomorphic Encryption", "Secure Multi-Party Computation", "Trusted Execution Environments"],
    gdprReference: "Art. 46, Schrems II",
  },
  {
    riskId: "reidentification",
    label: "Re-identification risk",
    description: "Risk that de-identified data could be re-linked to individuals",
    recommendedPets: ["k-Anonymity", "l-Diversity", "t-Closeness", "Differential Privacy", "Synthetic Data"],
    gdprReference: "Recital 26",
  },
  {
    riskId: "profiling",
    label: "Profiling & automated decisions",
    description: "Systematic evaluation of personal aspects with legal or significant effects",
    recommendedPets: ["Differential Privacy", "Federated Learning", "Anonymization"],
    gdprReference: "Art. 22, Art. 35(3)(a)",
  },
  {
    riskId: "third_party_sharing",
    label: "Third-party data sharing",
    description: "Sharing personal data with external processors or joint controllers",
    recommendedPets: ["Secure Multi-Party Computation", "Zero-Knowledge Proofs", "Private Information Retrieval", "Tokenization"],
    gdprReference: "Art. 28",
  },
  {
    riskId: "unauthorized_access",
    label: "Unauthorized access risk",
    description: "Risk of unauthorized parties accessing personal data",
    recommendedPets: ["Data Masking", "Tokenization", "Trusted Execution Environments", "Homomorphic Encryption"],
    gdprReference: "Art. 32",
  },
  {
    riskId: "data_minimization",
    label: "Data minimization gaps",
    description: "Processing more personal data than necessary for the stated purpose",
    recommendedPets: ["Anonymization", "Pseudonymization", "Synthetic Data", "Differential Privacy"],
    gdprReference: "Art. 5(1)(c), Art. 25",
  },
] as const;

export type PetRiskMapping = (typeof PET_RISK_MAPPINGS)[number];

/** Given a set of risk IDs, return all unique recommended PETs */
export function getRecommendedPets(riskIds: string[]): string[] {
  const pets = new Set<string>();
  for (const mapping of PET_RISK_MAPPINGS) {
    if (riskIds.includes(mapping.riskId)) {
      for (const pet of mapping.recommendedPets) {
        pets.add(pet);
      }
    }
  }
  return Array.from(pets);
}

/** Given a PET name, return which risks it addresses */
export function getRisksAddressedByPet(pet: string): PetRiskMapping[] {
  return PET_RISK_MAPPINGS.filter((m) =>
    (m.recommendedPets as readonly string[]).includes(pet)
  );
}

/** Keyword-based mapping from question text to risk IDs */
const RISK_KEYWORD_MAP: Record<string, string[]> = {
  special_category_data: ["special category", "sensitive", "health", "biometric", "genetic", "racial", "political", "religious"],
  cross_border_transfer: ["transfer", "country", "jurisdiction", "cross-border", "international", "third country", "adequacy"],
  large_scale_processing: ["volume", "scale", "records", "large-scale", "systematic", "extensive"],
  profiling: ["profiling", "automated", "scoring", "algorithmic", "decision-making"],
  third_party_sharing: ["sharing", "third party", "processor", "sub-processor", "joint controller", "recipient"],
  unauthorized_access: ["access", "security", "breach", "unauthorized", "encryption", "safeguard"],
  data_minimization: ["minimization", "purpose", "necessary", "proportionate", "adequate", "relevant"],
  reidentification: ["re-identification", "reidentification", "de-identified", "anonymized", "pseudonymized", "linkage"],
};

/** Analyze question text and return matching risk IDs */
export function detectRisksFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const detected: string[] = [];
  for (const [riskId, keywords] of Object.entries(RISK_KEYWORD_MAP)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      detected.push(riskId);
    }
  }
  return detected;
}
