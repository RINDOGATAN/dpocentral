// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The parts of an assessment's file name: the type's short name in the
 * document's language (EIPD, EIT, EIL in Spanish) and the record's name
 * without a leading type code, so the type is named once.
 */

/** The short name of each assessment type in a file name, per language. */
const FILE_TYPE_LABELS: Record<"en" | "es", Record<string, string>> = {
  en: { DPIA: "DPIA", PIA: "PIA", TIA: "TIA", LIA: "LIA", VENDOR: "Vendor", CUSTOM: "Custom" },
  es: { DPIA: "EIPD", PIA: "PIA", TIA: "EIT", LIA: "EIL", VENDOR: "Proveedor", CUSTOM: "Personalizada" },
};

/** A leading type code in a record name ("DPIA: ", "EIPD: ", "TIA - "...). */
const LEADING_TYPE_CODE = /^\s*(DPIA|EIPD|PIA|TIA|EIT|LIA|EIL)\s*[:\u2013\u2014-]+\s*/i;

/** The assessment's name without a leading type code, which the file name gives once. */
export function assessmentNameWithoutType(name: string): string {
  return name.replace(LEADING_TYPE_CODE, "").trim() || name;
}

/** The type's short name in the document's language (EIPD, EIT, EIL in Spanish). */
export function assessmentTypeShort(type: string, locale?: string | null): string {
  return FILE_TYPE_LABELS[locale === "es" ? "es" : "en"][type] ?? type;
}

