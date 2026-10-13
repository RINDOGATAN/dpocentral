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
