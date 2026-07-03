export interface ExpertProfile {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  firm: string | null;
  bio: string | null;
  expertTypes: string[];
  specializations: string[];
  certifications: string[];
  languages: string[]; // ISO 639-1
  location: { city: string | null; country: string | null }; // country = ISO 3166-1 alpha-2
  jurisdictions: string[];
  contactUrl: string | null;
  imageUrl?: string | null;
  acceptingClients: boolean;
  profileCompleteness: number; // 0–100
}

/** ISO 3166-1 alpha-2 → display name */
export const countryNames: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  CZ: "Czech Republic",
  DE: "Germany",
  DK: "Denmark",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  IE: "Ireland",
  IT: "Italy",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  SE: "Sweden",
  CH: "Switzerland",
  US: "United States",
};

/** ISO 639-1 → display name */
export const languageNames: Record<string, string> = {
  cs: "Czech",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  ga: "Irish",
  it: "Italian",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  sk: "Slovak",
  sv: "Swedish",
};

// Mirrors the live Dealroom directory. Update via `vercel env pull` + curl against
// /api/v1/experts/search when adding or removing experts in Dealroom.
// Legal (lawyer) experts were removed from the platform (2026-07 decision) —
// only technical/deployment experts are listed here.
export const mockExperts: ExpertProfile[] = [
  {
    id: "cmmxonolh023n12pm68y7qlls",
    name: "Wences Spiegel Marquez",
    email: "wences.spiegel@rindogatan.com",
    title: "Deployment Consultant",
    firm: "Rindogatan",
    bio: "Self-hosting and deployment specialist covering EU, US, and UK environments.",
    expertTypes: ["deployment"],
    specializations: ["Self-Hosting / Deployment"],
    certifications: [],
    languages: ["en", "es"],
    location: { city: "London", country: "GB" },
    jurisdictions: ["EU", "US", "UK"],
    contactUrl: null,
    imageUrl: null,
    acceptingClients: true,
    profileCompleteness: 75,
  },
  {
    id: "cmpk5y19j0000q50ttihul1xk",
    name: "Steve Crowley",
    email: "steve.crowley@spc-consulting.com",
    title: "Deployment Consultant",
    firm: "SPC Consulting",
    bio: "Self-hosting and deployment specialist covering EU, US, and UK environments.",
    expertTypes: ["deployment"],
    specializations: ["Self-Hosting / Deployment"],
    certifications: [],
    languages: ["en", "es"],
    location: { city: "London", country: "GB" },
    jurisdictions: ["EU", "US", "UK"],
    contactUrl: null,
    imageUrl: null,
    acceptingClients: true,
    profileCompleteness: 75,
  },
];

// Taxonomy used by getSpecializations() — surfaces in the filter dropdown in
// both mock and live modes. Includes all values used by live experts, plus
// forward-looking taxonomy entries that future experts may adopt.
export const specializations = [
  "Self-Hosting / Deployment",
  "GDPR",
  "CCPA / US State Privacy",
  "Cross-Border Transfers / SCCs / TIA",
  "DPA / Vendor Contracts",
  "AI Governance / EU AI Act",
  "Copyright / IP",
  "Privacy by Design",
  "DPIA / Impact Assessments",
  "DSAR / Subject Rights",
  "Healthcare Privacy",
  "Financial Services",
  "Incident Response",
  "Breach Notification",
  "ePrivacy / Cookies",
  "Children's Privacy",
  "EdTech Privacy",
  "Fintech Privacy",
  "ROPA",
  "Compliance Frameworks",
  "Multi-Jurisdictional",
  "Startup Privacy",
  "DPA Relations",
  "Automated Decisions",
  "National Derogations",
];

export const expertTypes = [
  { value: "technical", label: "Technical" },
  { value: "deployment", label: "Deployment" },
] as const;
