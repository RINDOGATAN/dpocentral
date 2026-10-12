// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Currency helpers. The rule (EU member states see euros, every other
 * visitor US dollars, Spanish pages always euros) lives in src/lib/region.ts;
 * React components take the page's currency from useDisplayCurrency /
 * useFormatPrice (src/components/region-provider.tsx).
 */

import { CURRENCY_COOKIE, type Currency } from "./region";

export type { Currency } from "./region";

/** Yearly price, in euros, of one premium module in the self-hosted kit. */
export const KIT_MODULE_PRICE_PER_YEAR = 60;

/**
 * The region's currency from the cookie the middleware sets. Code outside
 * React only; a missing cookie means US dollars.
 */
export function getCurrency(): Currency {
  if (typeof document === "undefined") return "USD";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CURRENCY_COOKIE}=(\\w+)`));
  return match?.[1] === "EUR" ? "EUR" : "USD";
}

export function formatPrice(amount: number, currency: Currency = getCurrency()): string {
  return currency === "USD" ? `$${amount}` : `€${amount}`;
}

/**
 * A price written for a sentence in the page's language: Spanish pages
 * always in euros, after the amount ("1.800 €"); English pages in the
 * region's currency ("€1,800" or "$1,800").
 */
export function formatPriceIn(amount: number, locale: string | null | undefined, currency: Currency): string {
  if (locale?.toLowerCase().startsWith("es")) return `${amount.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions)} €`;
  const n = amount.toLocaleString("en-US");
  return currency === "USD" ? `$${n}` : `€${n}`;
}
