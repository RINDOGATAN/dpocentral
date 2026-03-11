export interface ExpertProfile {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  firm: string | null;
  bio: string | null;
  expertType: "legal" | "technical" | "both";
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

export const mockExperts: ExpertProfile[] = [
  {
    id: "exp-001",
    name: "Sergio Maldonado",
    email: "sergio@todo.law",
    title: "Managing Partner",
    firm: "TODO.LAW",
    bio: "Privacy lawyer and technologist with over 15 years of experience at the intersection of data protection, marketing technology, and AI governance. Advises organisations across the EU on GDPR compliance, DPIAs, vendor risk management, cross-border transfers, and the EU AI Act. Builder of DPO Central and Vendor.Watch.",
    expertType: "both",
    specializations: [
      "GDPR",
      "DPIA / Impact Assessments",
      "Cross-Border Transfers",
      "Vendor Management",
      "AI & Data Ethics",
      "EU AI Act",
      "ePrivacy / Cookies",
      "Compliance Frameworks",
    ],
    certifications: ["CIPP/E"],
    languages: ["en", "es"],
    location: { city: "Stockholm", country: "SE" },
    jurisdictions: ["EU", "SE", "ES"],
    contactUrl: "https://todo.law/contact",
    acceptingClients: true,
    profileCompleteness: 95,
  },
  {
    id: "exp-002",
    name: "DPO Central Deployment Team",
    email: "deploy@todo.law",
    title: "Deployment Specialist",
    firm: "TODO.LAW",
    bio: "Helps organizations deploy and maintain self-hosted instances of DPO Central on their own infrastructure — Docker, Kubernetes, bare metal, or private cloud.",
    expertType: "technical",
    specializations: ["Self-Hosting / Deployment", "Privacy by Design"],
    certifications: [],
    languages: ["en", "es"],
    location: { city: "Stockholm", country: "SE" },
    jurisdictions: ["EU"],
    contactUrl: "https://todo.law/contact",
    acceptingClients: true,
    profileCompleteness: 80,
  },
];

export const specializations = [
  "Self-Hosting / Deployment",
  "GDPR",
  "DPIA / Impact Assessments",
  "DSAR / Subject Rights",
  "TIA / Transfer Assessments",
  "Cross-Border Transfers",
  "Healthcare Privacy",
  "Financial Services",
  "Vendor Management",
  "Contracts & DPAs",
  "Incident Response",
  "Breach Notification",
  "Privacy by Design",
  "AI & Data Ethics",
  "EU AI Act",
  "ePrivacy / Cookies",
  "Children's Privacy",
  "EdTech Privacy",
  "Fintech Privacy",
  "ROPA",
  "Compliance Frameworks",
  "SCCs",
  "Multi-Jurisdictional",
  "Startup Privacy",
  "DPA Relations",
  "Automated Decisions",
  "National Derogations",
];

export const expertTypes = [
  { value: "legal", label: "Legal" },
  { value: "technical", label: "Technical" },
  { value: "both", label: "Legal & Technical" },
] as const;
