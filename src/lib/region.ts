// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The visitor's region and the currency shown, from one rule used by the
 * middleware, the pages and the checkout:
 *
 *   - a visitor in one of the 27 EU member states sees euros;
 *   - every other visitor (including the UK, Switzerland, Norway, Iceland,
 *     Liechtenstein, and requests with no country header) sees US dollars;
 *   - Spanish public pages always show euros, whatever the country;
 *   - inside the product (signed-in screens) every price is in the currency
 *     the customer will be charged: the region's, whatever the language.
 *
 * Copy that names EU hosting in English is shown only when `isEuCountry` is
 * true. Pure: no Next.js imports, so it runs in the edge middleware, on the
 * server and in the browser.
 */

export type Currency = "USD" | "EUR";

/** The 27 EU member states, as ISO 3166-1 alpha-2 codes (Greece is "GR"). */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

const EU_SET = new Set(EU_COUNTRIES);

/** The request header the hosting platform sets with the visitor's country. */
export const COUNTRY_HEADER = "x-vercel-ip-country";

/**
 * The cookie that carries the region's currency to client code. The
 * middleware re-evaluates it on every request, so a value written under an
 * earlier rule is replaced on the next page load.
 */
export const CURRENCY_COOKIE = "currency";

/** True only for the 27 EU member states. A missing or unknown code is not EU. */
export function isEuCountry(country: string | null | undefined): boolean {
  return !!country && EU_SET.has(country.trim().toUpperCase());
}

/** The region's currency: euros in the EU, US dollars everywhere else. */
export function regionCurrency(country: string | null | undefined): Currency {
  return isEuCountry(country) ? "EUR" : "USD";
}

/** True when the page's language is Spanish. */
function isSpanish(locale: string | null | undefined): boolean {
  return !!locale && locale.toLowerCase().startsWith("es");
}

/** The currency a page shows: euros on Spanish pages, otherwise the region's. */
export function currencyFor(locale: string | null | undefined, eu: boolean): Currency {
  if (isSpanish(locale)) return "EUR";
  return eu ? "EUR" : "USD";
}

/**
 * The currency an in-app checkout charges: the customer's stored billing
 * currency when there is one (a billing account keeps one currency),
 * otherwise the request's charge currency (euros only in the 27 EU states,
 * whatever the language: planCurrencyFromHeaders in src/lib/plan-currency.ts),
 * the same currency every in-app price hint shows.
 */
export function checkoutCurrency(input: {
  stored?: string | null;
  charge: Currency;
}): Currency {
  return parseCurrency(input.stored) ?? input.charge;
}

/** Reads a stored billing currency ("usd", "EUR"...) into a Currency, or null. */
export function parseCurrency(value: string | null | undefined): Currency | null {
  const v = value?.trim().toUpperCase();
  return v === "USD" || v === "EUR" ? v : null;
}
