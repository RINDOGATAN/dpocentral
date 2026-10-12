// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Currency helpers. The rule lives in src/lib/region.ts: the public pages
 * show euros to EU visitors and on Spanish pages, US dollars otherwise;
 * inside the product every price is in the currency the customer will be
 * charged (euros only in the 27 EU states, whatever the language), from
 * src/lib/plan-currency.ts. React components inside the product take it from
 * useChargeCurrency / useFormatPrice / usePriceInSentence
 * (src/components/region-provider.tsx).
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
 * A price written for a sentence in the page's language, in the given
 * currency. Spanish writes the amount first ("1.800 €", "1.800 US$": "US$"
 * because "$" alone reads as a local peso in much of the Spanish-speaking
 * world); English writes the symbol first ("€1,800", "$1,800"). The caller
 * chooses the currency: inside the product it is the charge currency
 * (src/lib/plan-currency.ts), whatever the language.
 */
export function formatPriceIn(amount: number, locale: string | null | undefined, currency: Currency): string {
  if (locale?.toLowerCase().startsWith("es")) {
    const n = amount.toLocaleString("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions);
    return currency === "USD" ? `${n} US$` : `${n} €`;
  }
  const n = amount.toLocaleString("en-US");
  return currency === "USD" ? `$${n}` : `€${n}`;
}
