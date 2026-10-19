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

/** A publicId that is already a readable reference ("DSAR-2026-0003", from imports and demos). */
const READABLE = /^[A-Z]{2,6}-\d{4}-\d{1,6}$/;

export function formatRequestRef(publicId: string, locale = "en"): string {
  if (READABLE.test(publicId)) return publicId;
  const prefix = PREFIX[locale.split("-")[0]] ?? PREFIX.en;
  return `${prefix}-${publicId.slice(-6).toUpperCase()}`;
}

/**
 * The part of a typed search that matches a publicId: "REQ-ABC123" or
 * "SOL-abc123" (the reference a person reads) becomes "abc123", which the
 * publicId ends with. Anything else is returned unchanged.
 */
export function requestRefSearchTail(search: string): string | null {
  const m = /^\s*(?:REQ|SOL)-([a-z0-9]{6})\s*$/i.exec(search);
  return m ? m[1] : null;
}
