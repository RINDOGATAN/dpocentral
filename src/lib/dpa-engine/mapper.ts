// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Maps DPO Central's own models — vendor register, questionnaire responses,
 * processing activities — into the DPA fact model (INSTRUCTIONS.md §9),
 * enforcing the §7 honesty rules in code:
 *
 *  - `toms-confirmed` stays empty here: certifications alone justify the
 *    `org-audits-review` TIA safeguard, never TOMs warranties. Confirmed
 *    controls require actual audit evidence a human reviews and ticks.
 *  - `processor-establishment` means where the vendor is ESTABLISHED, so it
 *    is only inferred when the register is unambiguous (explicit field, or
 *    every recorded country maps to one region); otherwise left for the
 *    reviewer.
 *  - Importer declarations (`tia-gov-requests-received`, `tia-breach-history`)
 *    keep their "unknown" defaults unless the vendor itself answered — never
 *    fabricated to "none".
 *
 * The output is a PROPOSAL: the UI shows every mapped fact for human review
 * and editing before any document is generated.
 */

import type { ClauseSelections, DpaFacts, GoverningLawKey } from "./types";

// Decoupled from Prisma so the mapper is testable without a database.
export interface MapperVendor {
  name: string;
  address?: string | null;
  dataProcessed: string[];
  countries: string[];
  certifications: string[];
  metadata?: unknown;
}

export interface MapperQuestionnaireResponse {
  status: string;
  submittedAt?: Date | null;
  responses?: unknown;
}

export interface MapperProcessingActivity {
  name: string;
  purpose: string;
  recipients: string[];
}

export interface MapperInput {
  vendor: MapperVendor;
  questionnaireResponses?: MapperQuestionnaireResponse[];
  processingActivities?: MapperProcessingActivity[];
  /** Regions of the org's jurisdictions, primary first (e.g. "EU", "UK", "US-CA"). */
  organizationJurisdictionRegions?: string[];
}

/** A user-visible provenance note — bilingual, like every UI string. */
export interface MapperNote {
  en: string;
  es: string;
}

export interface MappedDpaInputs {
  facts: DpaFacts;
  selections: ClauseSelections;
  governingLaw: GoverningLawKey;
  /** Human-readable notes on what was inferred and from where. */
  notes: MapperNote[];
}

// ── DataCategory → data-categories (§9 table) ───────────────────────────

const CATEGORY_MAP: Record<string, string[]> = {
  IDENTIFIERS: ["contact-details", "identification-data"],
  FINANCIAL: ["financial-data"],
  LOCATION: ["location-data"],
  BEHAVIORAL: ["usage-technical"],
  EMPLOYMENT: ["professional-data"],
  HEALTH: ["special-category"],
  BIOMETRIC: ["special-category"],
  GENETIC: ["special-category"],
  POLITICAL: ["special-category"],
  RELIGIOUS: ["special-category"],
  SEXUAL_ORIENTATION: ["special-category"],
  CRIMINAL: ["special-category"],
};

/** Categories with no canonical key become free-text "other" entries. */
const CATEGORY_OTHER_TEXT: Record<string, string> = {
  DEMOGRAPHICS: "Demographic data",
  EDUCATION: "Education data",
};

// ── Country → establishment region ──────────────────────────────────────

const EEA_COUNTRIES = new Set([
  "at", "austria", "be", "belgium", "bg", "bulgaria", "hr", "croatia",
  "cy", "cyprus", "cz", "czech republic", "czechia", "dk", "denmark",
  "ee", "estonia", "fi", "finland", "fr", "france", "de", "germany",
  "gr", "greece", "hu", "hungary", "ie", "ireland", "it", "italy",
  "lv", "latvia", "lt", "lithuania", "lu", "luxembourg", "mt", "malta",
  "nl", "netherlands", "pl", "poland", "pt", "portugal", "ro", "romania",
  "sk", "slovakia", "si", "slovenia", "es", "spain", "se", "sweden",
  "is", "iceland", "li", "liechtenstein", "no", "norway",
]);
const UK_COUNTRIES = new Set(["gb", "uk", "united kingdom", "great britain"]);
const US_COUNTRIES = new Set(["us", "usa", "united states", "united states of america"]);

function regionOf(country: string): "EEA" | "UK" | "US" | "OTHER" {
  const c = country.trim().toLowerCase();
  if (EEA_COUNTRIES.has(c)) return "EEA";
  if (UK_COUNTRIES.has(c)) return "UK";
  if (US_COUNTRIES.has(c)) return "US";
  return "OTHER";
}

const ESTABLISHMENTS = ["EEA", "UK", "US", "OTHER"] as const;

function inferEstablishment(
  vendor: MapperVendor,
  notes: MapperNote[]
): string {
  // An explicit establishment field always wins over countries inference.
  const meta = vendor.metadata as { establishment?: unknown } | null | undefined;
  const explicit = typeof meta?.establishment === "string" ? meta.establishment : "";
  if ((ESTABLISHMENTS as readonly string[]).includes(explicit)) {
    return explicit;
  }
  // `countries` records where the vendor operates/stores data — that is NOT
  // establishment (§7.4). Infer only when every entry maps to one region.
  const regions = Array.from(new Set(vendor.countries.map(regionOf)));
  if (regions.length === 1) {
    const countries = vendor.countries.join(", ");
    notes.push({
      en: `Establishment ${regions[0]} inferred from the vendor's recorded countries (${countries}); confirm it is where the vendor is established, not merely where data is stored.`,
      es: `Establecimiento ${regions[0]} inferido de los países registrados del proveedor (${countries}); confirme que es donde el proveedor está establecido, no solo donde se almacenan los datos.`,
    });
    return regions[0]!;
  }
  if (regions.length > 1) {
    notes.push({
      en: "Establishment left blank: the vendor's recorded countries span several regions and establishment means where the vendor is established, not every storage region.",
      es: "Establecimiento sin cumplimentar: los países registrados del proveedor abarcan varias regiones y el establecimiento es donde el proveedor está establecido, no cada región de almacenamiento.",
    });
  }
  return "";
}

// ── Questionnaire mining (best-effort; the flow is Vendor.Watch-owned) ──

function latestResponses(
  responses: MapperQuestionnaireResponse[] | undefined
): Record<string, unknown> | null {
  const usable = (responses ?? [])
    .filter((r) => ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(r.status))
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
  const first = usable[0]?.responses;
  return first && typeof first === "object" && !Array.isArray(first)
    ? (first as Record<string, unknown>)
    : null;
}

/**
 * Questionnaire breach-window answers → breach-notification option. Both
 * seeded questionnaires phrase ir2 as an hours window ("Within 48 hours",
 * "48 hours"), so matching the hour figure covers each; unrecognized
 * answers fall back to the 72h default.
 */
const BREACH_WINDOW_MAP: Array<[RegExp, string]> = [
  [/24\s*h/i, "breach-24h"],
  [/48\s*h/i, "breach-48h"],
  [/72\s*h/i, "breach-72h"],
];

// ── Main mapping ────────────────────────────────────────────────────────

export function mapVendorToDpaInputs(input: MapperInput): MappedDpaInputs {
  const { vendor } = input;
  const notes: MapperNote[] = [];
  const facts: DpaFacts = {};

  // Data categories (§9 table).
  const keys: string[] = [];
  const other: string[] = [];
  for (const category of vendor.dataProcessed) {
    const mapped = CATEGORY_MAP[category];
    if (mapped) {
      for (const k of mapped) if (!keys.includes(k)) keys.push(k);
    } else if (CATEGORY_OTHER_TEXT[category]) {
      other.push(CATEGORY_OTHER_TEXT[category]);
    }
    // OTHER carries no assertable content — the reviewer adds specifics.
  }
  facts["data-categories"] = keys.join(",");
  if (other.length) facts["data-categories-other"] = other.join("; ");

  // Establishment (§7.4).
  const establishment = inferEstablishment(vendor, notes);
  if (establishment) facts["processor-establishment"] = establishment;

  // Certifications → the org-audits-review TIA safeguard only (§7.3).
  const certs = vendor.certifications.join(" ");
  const hasIso = /iso[\s-]*27001/i.test(certs);
  const hasSoc2 = /soc[\s-]*2/i.test(certs);
  if (hasIso || hasSoc2) {
    facts["tia-safeguards"] = "org-audits-review";
    notes.push({
      en: "Certifications support the audits-review TIA safeguard only; Annex II stays at the baseline unless controls are confirmed against actual audit evidence.",
      es: "Las certificaciones solo justifican la salvaguarda de revisión de auditorías de la TIA; el Anexo II se mantiene en el nivel base salvo que los controles se confirmen con evidencia real de auditoría.",
    });
  }

  // Processing purpose from activities naming this vendor as a recipient.
  // Recipients are free-text categories, so substring matching needs a
  // guard: only whole-value equality, or a ≥4-character containment, may
  // link them — otherwise vendor "Fitbit" matches recipient "IT" and an
  // unrelated activity's purpose lands in Annex I.
  const vendorName = vendor.name.trim().toLowerCase();
  const nameMatches = (recipient: string): boolean => {
    const r = recipient.trim().toLowerCase();
    if (!r || !vendorName) return false;
    if (r === vendorName) return true;
    if (vendorName.length >= 4 && r.includes(vendorName)) return true;
    if (r.length >= 4 && vendorName.includes(r)) return true;
    return false;
  };
  const linked = (input.processingActivities ?? []).filter((a) =>
    a.recipients.some(nameMatches)
  );
  if (linked.length) {
    facts["processing-purpose"] = Array.from(
      new Set(linked.map((a) => a.purpose.trim()).filter(Boolean))
    ).join(" ");
    const names = linked.map((a) => a.name).join(", ");
    notes.push({
      en: `Processing purpose drawn from ${linked.length} processing ${linked.length === 1 ? "activity" : "activities"} naming this vendor as a recipient: ${names}. Verify each one really covers this vendor.`,
      es: `Finalidad del tratamiento extraída de ${linked.length} ${linked.length === 1 ? "actividad" : "actividades"} de tratamiento que nombran a este proveedor como destinatario: ${names}. Verifique que cada una corresponde realmente a este proveedor.`,
    });
  }

  // Sub-processor list, when the register records one.
  const meta = vendor.metadata as { subprocessors?: unknown } | null | undefined;
  if (Array.isArray(meta?.subprocessors) && meta.subprocessors.length) {
    facts["subprocessor-list"] = meta.subprocessors.map(String).join("; ");
  } else if (typeof meta?.subprocessors === "string" && meta.subprocessors.trim()) {
    facts["subprocessor-list"] = meta.subprocessors.trim();
  }

  // Questionnaire answers — only the vendor's own declarations (§7.5).
  const answers = latestResponses(input.questionnaireResponses);
  let breachSelection = "";
  if (answers) {
    if (typeof answers.ir2 === "string") {
      for (const [pattern, option] of BREACH_WINDOW_MAP) {
        if (pattern.test(answers.ir2)) {
          breachSelection = option;
          break;
        }
      }
    }
    // The seeded questionnaires disagree on what ir4 asks (breach-history
    // textarea vs incident-drills boolean), so a free-text answer is NEVER
    // auto-classified into the breach-history declaration — it stays at
    // "unknown" and the raw answer is surfaced for the reviewer to judge.
    const breachHistory =
      typeof answers.ir4 === "string" ? answers.ir4.trim() : "";
    if (breachHistory) {
      const quoted =
        breachHistory.length > 160 ? `${breachHistory.slice(0, 160)}…` : breachHistory;
      notes.push({
        en: `The vendor's questionnaire contains an incident-related answer: "${quoted}". Review it and set the breach-history declaration yourself — it is not classified automatically.`,
        es: `El cuestionario del proveedor contiene una respuesta sobre incidentes: «${quoted}». Revísela y fije usted la declaración de historial de violaciones — no se clasifica automáticamente.`,
      });
    }
    const transferMechanisms = Array.isArray(answers.dt3)
      ? answers.dt3.map(String)
      : typeof answers.dt3 === "string"
        ? [answers.dt3]
        : [];
    if (transferMechanisms.some((m) => /data privacy framework/i.test(m))) {
      facts["processor-dpf-certified"] = "yes";
      notes.push({
        en: "DPF certification taken from the vendor's questionnaire answer (dt3); verify the active registration at dataprivacyframework.gov.",
        es: "Certificación DPF tomada de la respuesta del cuestionario del proveedor (dt3); verifique el registro activo en dataprivacyframework.gov.",
      });
    }
  }
  // No answer → the engine's defaults keep declarations at "unknown".

  // Governing law from the org's jurisdictions, honouring their order
  // (primary first): the FIRST region that maps to a supported law wins,
  // so a primary-US org with a secondary UK office proposes California.
  const regions = input.organizationJurisdictionRegions ?? [];
  let governingLaw: GoverningLawKey = "SPAIN";
  let gljSelection = "glj-es-madrid";
  for (const region of regions) {
    if (region === "UK") {
      governingLaw = "ENGLAND_WALES";
      gljSelection = "glj-uk-london";
      break;
    }
    if (region.startsWith("US")) {
      governingLaw = "CALIFORNIA";
      gljSelection = "glj-us-courts";
      break;
    }
    if (region === "EU") {
      break; // EU → the Spanish default already set.
    }
  }

  const crossBorder = establishment === "US" || establishment === "OTHER";
  const selections: ClauseSelections = {
    "scope-processing": "scope-standard",
    "processing-instructions": "instructions-standard",
    "subprocessor-approval": "subproc-general-30d",
    "data-transfer": crossBorder ? "transfer-sccs" : "transfer-adequacy-sccs",
    "security-measures": hasIso
      ? "security-iso27001"
      : hasSoc2
        ? "security-soc2"
        : "security-annex",
    "breach-notification": breachSelection || "breach-72h",
    "data-subject-rights": "rights-standard",
    "audit-rights": hasIso || hasSoc2 ? "audit-reports" : "audit-questionnaire",
    "data-deletion": "deletion-return-or-delete-60d",
    confidentiality: "confidentiality-standard",
    "liability-indemnification": "liability-2x",
    "breach-liability-cap": "breachcap-supercap-2x",
    "term-termination": "term-30d-cure",
    "governing-law-jurisdiction": gljSelection,
    // Government-access commitments matter for third-country processors;
    // choosing them also derives the contractual TIA measure (§5).
    "government-access-requests": crossBorder ? "gov-access-full" : "gov-access-none",
  };

  return { facts, selections, governingLaw, notes };
}
