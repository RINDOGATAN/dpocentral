// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Names the app writes for the records it creates ("TIA: {transfer}",
 * "{activity}: {vendor}"). A colon separates the parts, no long dash. Records created before that
 * keep their names; where the app looks a record up by its generated name
 * (to avoid a duplicate), it also accepts the older form.
 */

export const RECORD_NAME_SEPARATOR = ": ";

/** The separator of names written before 11 Oct 2026 (space, long dash, space). */
const LEGACY_SEPARATOR = " — ";

export function recordName(...parts: string[]): string {
  return parts.join(RECORD_NAME_SEPARATOR);
}

/** The same name as the app wrote it before 11 Oct 2026. */
export function legacyRecordName(...parts: string[]): string {
  return parts.join(LEGACY_SEPARATOR);
}

/** The type word of an AI system the quick start registers from a catalog vendor. */
const AI_SYSTEM_TYPE_NAME = { en: "AI System", es: "Sistema de IA" } as const;

export type RecordNameLocale = keyof typeof AI_SYSTEM_TYPE_NAME;

function recordNameLocale(locale: string | null | undefined): RecordNameLocale {
  return locale === "es" ? "es" : "en";
}

/** "AI System: {vendor}" in English, "Sistema de IA: {vendor}" in Spanish. */
export function aiSystemRecordName(vendorName: string, locale: string | null | undefined): string {
  return recordName(AI_SYSTEM_TYPE_NAME[recordNameLocale(locale)], vendorName);
}

/**
 * The stored name of an AI system as shown in `locale`. A name the app wrote
 * in the other language (including the older long-dash form) has its type
 * word swapped; any other name, typed by a person, is shown as stored.
 */
export function displayAiSystemName(name: string, locale: string | null | undefined): string {
  const target = AI_SYSTEM_TYPE_NAME[recordNameLocale(locale)];
  for (const typeName of Object.values(AI_SYSTEM_TYPE_NAME)) {
    for (const separator of [RECORD_NAME_SEPARATOR, LEGACY_SEPARATOR]) {
      const prefix = typeName + separator;
      if (name.startsWith(prefix) && name.length > prefix.length) {
        return recordName(target, name.slice(prefix.length));
      }
    }
  }
  return name;
}

/** The description the app writes for an AI system it registers from a catalog vendor. */
const AI_SYSTEM_DESCRIPTION = {
  en: (vendor: string, caps: string) => `Auto-registered from vendor catalog import. ${vendor} provides ${caps}.`,
  es: (vendor: string, caps: string) =>
    `Registrado automáticamente al importar el proveedor del catálogo. ${vendor} ofrece ${caps}.`,
} as const;

/** The fallback for a catalog vendor that lists no capability. */
const AI_SYSTEM_DEFAULT_CAPS = { en: "AI capabilities", es: "capacidades de IA" } as const;

/** "Auto-registered from vendor catalog import. {vendor} provides {caps}." in `locale`. */
export function aiSystemRecordDescription(
  vendorName: string,
  capabilities: string[],
  locale: string | null | undefined,
): string {
  const l = recordNameLocale(locale);
  const caps = capabilities.length > 0 ? capabilities.slice(0, 3).join(", ") : AI_SYSTEM_DEFAULT_CAPS[l];
  return AI_SYSTEM_DESCRIPTION[l](vendorName, caps);
}

const AI_SYSTEM_DESCRIPTION_PATTERNS = [
  /^Auto-registered from vendor catalog import\. ([\s\S]+) provides ([\s\S]+)\.$/,
  /^Registrado automáticamente al importar el proveedor del catálogo\. ([\s\S]+) ofrece ([\s\S]+)\.$/,
];

/**
 * The stored description of an AI system as shown in `locale`. A description
 * the app wrote in the other language is rebuilt in `locale` (the vendor name
 * and the catalog's capability list are kept as stored); any other text, typed
 * by a person, is shown as stored.
 */
export function displayAiSystemDescription(description: string, locale: string | null | undefined): string {
  const l = recordNameLocale(locale);
  for (const pattern of AI_SYSTEM_DESCRIPTION_PATTERNS) {
    const m = pattern.exec(description);
    if (!m) continue;
    const [, vendor, rawCaps] = m as unknown as [string, string, string];
    const fallback = Object.values(AI_SYSTEM_DEFAULT_CAPS) as string[];
    const caps = fallback.includes(rawCaps) ? AI_SYSTEM_DEFAULT_CAPS[l] : rawCaps;
    return AI_SYSTEM_DESCRIPTION[l](vendor, caps);
  }
  return description;
}

/** The type word of the transfer impact assessment the app opens for a transfer. */
const TIA_TYPE_NAME = { en: "TIA", es: "EIT" } as const;

const TIA_DESCRIPTION = {
  en: (country: string) => `Transfer Impact Assessment for transfer to ${country}.`,
  es: (country: string) => `Evaluación de impacto de la transferencia a ${country}.`,
} as const;

const TIA_DESCRIPTION_PATTERNS = [
  /^Transfer Impact Assessment for transfer to ([\s\S]+)\.$/,
  /^Evaluación de impacto de la transferencia a ([\s\S]+)\.$/,
];

/** "TIA: {transfer}" in English, "EIT: {transfer}" in Spanish. */
export function tiaRecordName(transferName: string, locale: string | null | undefined): string {
  return recordName(TIA_TYPE_NAME[recordNameLocale(locale)], transferName);
}

/** "Transfer Impact Assessment for transfer to {country}." in `locale`. */
export function tiaRecordDescription(country: string, locale: string | null | undefined): string {
  return TIA_DESCRIPTION[recordNameLocale(locale)](country);
}

/**
 * The stored name of an assessment as shown in `locale`: a transfer impact
 * assessment the app named in the other language has its type word swapped;
 * any other name is shown as stored.
 */
export function displayAssessmentName(name: string, locale: string | null | undefined): string {
  const target = TIA_TYPE_NAME[recordNameLocale(locale)];
  for (const typeName of Object.values(TIA_TYPE_NAME)) {
    for (const separator of [RECORD_NAME_SEPARATOR, LEGACY_SEPARATOR]) {
      const prefix = typeName + separator;
      if (name.startsWith(prefix) && name.length > prefix.length) {
        return recordName(target, name.slice(prefix.length));
      }
    }
  }
  return name;
}

/** The stored description of an assessment as shown in `locale` (see displayAssessmentName). */
export function displayAssessmentDescription(description: string, locale: string | null | undefined): string {
  for (const pattern of TIA_DESCRIPTION_PATTERNS) {
    const m = pattern.exec(description);
    if (m) return TIA_DESCRIPTION[recordNameLocale(locale)](m[1]!);
  }
  return description;
}

/** The purpose the app writes for a catalog AI system that lists no capability. */
const AI_SYSTEM_DEFAULT_PURPOSE = {
  en: (category: string) => `AI-powered ${category} services`,
  es: (category: string) => `Servicios basados en IA (${category})`,
} as const;

const AI_SYSTEM_PURPOSE_PATTERNS = [/^AI-powered ([\s\S]+) services$/, /^Servicios basados en IA \(([\s\S]+)\)$/];

/** "AI-powered {category} services" in `locale`. */
export function aiSystemDefaultPurpose(category: string, locale: string | null | undefined): string {
  return AI_SYSTEM_DEFAULT_PURPOSE[recordNameLocale(locale)](category);
}

/**
 * The stored purpose of an AI system as shown in `locale`: the default purpose
 * the app wrote is rebuilt, with the catalog category passed through
 * `categoryLabel`; any other purpose is shown as stored.
 */
export function displayAiSystemPurpose(
  purpose: string,
  locale: string | null | undefined,
  categoryLabel: (category: string) => string = (c) => c,
): string {
  for (const pattern of AI_SYSTEM_PURPOSE_PATTERNS) {
    const m = pattern.exec(purpose);
    if (m) return aiSystemDefaultPurpose(categoryLabel(m[1]!), locale);
  }
  return purpose;
}
