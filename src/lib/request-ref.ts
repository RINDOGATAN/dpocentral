// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Human-readable reference for a rights request (DSAR), derived from its
 * publicId the same way an incident's is (src/lib/incident-ref.ts): the last
 * six characters, upper case, behind a short prefix in the reader's language
 * ("REQ-" in English, "SOL-" for "solicitud" in Spanish). The full publicId
 * stays available, in a title attribute, for search and support; it is never
 * the label a person reads.
 */

const PREFIX: Record<string, string> = { en: "REQ", es: "SOL" };

export function formatRequestRef(publicId: string, locale = "en"): string {
  const prefix = PREFIX[locale.split("-")[0]] ?? PREFIX.en;
  return `${prefix}-${publicId.slice(-6).toUpperCase()}`;
}
