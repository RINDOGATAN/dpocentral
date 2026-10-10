// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where the TODO.LAW logo on the public landing leads: the main storefront,
 * in the language the landing is showing. The product's own name keeps its
 * own link.
 */

export type LandingLocale = "en" | "es";

export const STOREFRONT_URL = "https://www.todo.law";

export function storefrontUrl(locale: LandingLocale): string {
  return locale === "es" ? `${STOREFRONT_URL}/es` : STOREFRONT_URL;
}

export function storefrontLogoLabel(locale: LandingLocale): string {
  return locale === "es" ? "TODO.LAW: inicio" : "TODO.LAW";
}
