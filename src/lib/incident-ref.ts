// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Human-readable incident reference derived from the incident's publicId.
 *
 * The Incident model has no sequence column and we deliberately add none
 * (per-org counters computed at render are racy; a schema change is not
 * worth it for a display label). The last 6 characters of the publicId CUID
 * are stable and unique-enough for a display badge; the full publicId stays
 * available (e.g. in a title attribute) for search and support.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export function formatIncidentRef(publicId: string): string {
  return `INC-${publicId.slice(-6).toUpperCase()}`;
}
