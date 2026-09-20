// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

export interface ExpertProfile {
  id: string;
  name: string | null;
  /** Null when no verified address is on file. Never a placeholder address. */
  email: string | null;
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

// ---------------------------------------------------------------------------
// The directory of people available for technical help.
//
// THIS ENTRY IS A REAL PERSON. It is not a fixture, not a placeholder and not
// sample data. Do not replace it with an invented profile, and do not add
// invented profiles beside it: the fictional names, firms and .example
// addresses that used to live in this file were removed on 2026-09-20 by the
// owner's decision, and no user may ever be shown an invented person again.
//
// Only fields that are known to be true are filled in. Every other field is
// left null or empty on purpose, and must stay that way until the owner
// supplies the real value — an empty card is correct, a plausible-looking
// invented one is not. The contact address in particular is unset because it
// is not recorded anywhere in this repository; see the request-routing note in
// src/server/routers/privacy/experts.ts, which copies every request to our own
// inbox so nothing is lost while the address is missing.
//
// The allow-list in ./client.ts (PERMITTED_DIRECTORY_NAMES) is the enforcement
// point: it also filters what the upstream directory returns, so a new name
// appearing upstream cannot reach a user. Adding someone here without adding
// them there shows nobody.
// ---------------------------------------------------------------------------
export const directoryExperts: ExpertProfile[] = [
  {
    id: "technical-help-1",
    name: "Steve Crowley",
    email: null, // real address not on file — see the note above
    title: null,
    firm: null,
    bio: null,
    expertTypes: ["technical"],
    specializations: [],
    certifications: [],
    languages: ["en"],
    location: { city: null, country: null },
    jurisdictions: [],
    contactUrl: null,
    imageUrl: null,
    acceptingClients: true,
    profileCompleteness: 100,
  },
];

// Taxonomy used by getSpecializations() — surfaces in the filter dropdown in
// both fallback and live modes. Includes all values used by live experts, plus
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
