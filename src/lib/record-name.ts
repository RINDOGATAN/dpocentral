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
