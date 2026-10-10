// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The web address part of an organisation's name (its public rights-request
 * portal is /dsar/<slug>). Accents are dropped, not turned into dashes:
 * "Ejemplo Logística, S.L." gives "ejemplo-logistica-s-l".
 */
export function organizationSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
