// Privacy Enhancing Technologies (PETs) taxonomy
// Mirrors VW's PET_CATEGORIES from src/lib/reference-data.ts

export const PET_CATEGORIES = [
  {
    label: "De-Identification",
    technologies: [
      "Tokenization",
      "Data Masking",
      "Pseudonymization",
      "Anonymization",
      "k-Anonymity",
      "l-Diversity",
      "t-Closeness",
      "Synthetic Data",
    ],
  },
  {
    label: "Aggregation",
    technologies: ["Differential Privacy"],
  },
  {
    label: "Encryption",
    technologies: [
      "Homomorphic Encryption",
      "Secure Multi-Party Computation",
      "Private Information Retrieval",
      "Mix Networks",
    ],
  },
  {
    label: "Secure Computation",
    technologies: [
      "Trusted Execution Environments",
      "Federated Learning",
      "Zero-Knowledge Proofs",
    ],
  },
] as const;

export const ALL_PETS = PET_CATEGORIES.flatMap((c) => c.technologies);

export function getPetCategory(technology: string): string | undefined {
  return PET_CATEGORIES.find((c) =>
    (c.technologies as readonly string[]).includes(technology)
  )?.label;
}
