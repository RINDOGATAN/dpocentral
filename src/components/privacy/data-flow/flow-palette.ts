/**
 * Shared colour + visual tokens for the in-UI data flow map.
 * Mirrors the navy-semantic PDF palette so UI and exports feel consistent.
 */
import type { DataAssetType } from "@prisma/client";

export const ASSET_TYPE_COLOR: Record<DataAssetType, { stripe: string; soft: string; text: string; label: string }> = {
  APPLICATION:   { stripe: "#0e4a6e", soft: "rgba(14, 74, 110, 0.08)",  text: "#0e4a6e", label: "Application" },
  CLOUD_SERVICE: { stripe: "#2563eb", soft: "rgba(37, 99, 235, 0.08)",  text: "#1e3a8a", label: "Cloud" },
  DATABASE:      { stripe: "#4338ca", soft: "rgba(67, 56, 202, 0.08)",  text: "#312e81", label: "Database" },
  FILE_SYSTEM:   { stripe: "#64748b", soft: "rgba(100, 116, 139, 0.08)",text: "#334155", label: "File System" },
  THIRD_PARTY:   { stripe: "#d97706", soft: "rgba(217, 119, 6, 0.08)",  text: "#92400e", label: "Third Party" },
  PHYSICAL:      { stripe: "#78716c", soft: "rgba(120, 113, 108, 0.08)",text: "#44403c", label: "Physical" },
  OTHER:         { stripe: "#94a3b8", soft: "rgba(148, 163, 184, 0.08)",text: "#475569", label: "Other" },
};

/**
 * Data categories grouped by sensitivity (Article 9, regular PII, behavioural, etc.)
 * Drives edge colour and the "risk halo" on asset nodes.
 */
export const SPECIAL_CATEGORIES = new Set([
  "HEALTH",
  "BIOMETRIC",
  "GENETIC",
  "POLITICAL",
  "RELIGIOUS",
  "SEXUAL_ORIENTATION",
  "CRIMINAL",
]);
export const SENSITIVE_CATEGORIES = new Set([
  "IDENTIFIERS",
  "FINANCIAL",
]);

export type Sensitivity = "special" | "sensitive" | "general" | "none";

export const SENSITIVITY_COLOR: Record<Sensitivity, { stroke: string; bg: string; fg: string; label: string }> = {
  special:   { stroke: "#dc2626", bg: "#fef2f2", fg: "#991b1b", label: "Special cat." },
  sensitive: { stroke: "#d97706", bg: "#fffbeb", fg: "#92400e", label: "Personal" },
  general:   { stroke: "#2563eb", bg: "#eff6ff", fg: "#1e3a8a", label: "General" },
  none:      { stroke: "#94a3b8", bg: "#f8fafc", fg: "#475569", label: "Unclassified" },
};

export function classifyCategories(categories: string[] | null | undefined): Sensitivity {
  if (!categories || categories.length === 0) return "none";
  if (categories.some((c) => SPECIAL_CATEGORIES.has(c))) return "special";
  if (categories.some((c) => SENSITIVE_CATEGORIES.has(c))) return "sensitive";
  return "general";
}

/**
 * Frequency → stroke width in pixels.
 * Strings are free-form in the schema, so we match on common words.
 */
export function strokeWidthForFrequency(frequency: string | null | undefined): number {
  if (!frequency) return 1.5;
  const lower = frequency.toLowerCase();
  if (lower.includes("continuous") || lower.includes("real-time") || lower.includes("realtime")) return 3;
  if (lower.includes("hour")) return 2.6;
  if (lower.includes("daily") || lower.includes("day")) return 2.2;
  if (lower.includes("week")) return 1.8;
  if (lower.includes("month")) return 1.5;
  if (lower.includes("quarter")) return 1.2;
  if (lower.includes("year") || lower.includes("annual")) return 1;
  if (lower.includes("ad-hoc") || lower.includes("ad hoc") || lower.includes("on-demand")) return 1.2;
  return 1.5;
}

/**
 * Short display label for data-category chips.
 * "SEXUAL_ORIENTATION" → "Sexual Orientation" — title case with spaces.
 */
export function formatCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** Very short 3-letter abbreviation for chip display when space is tight. */
export function abbrevCategory(category: string): string {
  const ABBR: Record<string, string> = {
    IDENTIFIERS: "ID",
    DEMOGRAPHICS: "DEM",
    FINANCIAL: "FIN",
    HEALTH: "HLT",
    BIOMETRIC: "BIO",
    LOCATION: "LOC",
    BEHAVIORAL: "BHV",
    EMPLOYMENT: "EMP",
    EDUCATION: "EDU",
    POLITICAL: "POL",
    RELIGIOUS: "REL",
    GENETIC: "GEN",
    SEXUAL_ORIENTATION: "SEX",
    CRIMINAL: "CRI",
  };
  return ABBR[category] ?? category.slice(0, 3);
}
