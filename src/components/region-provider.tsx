"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The visitor's region, resolved on the server from the country header
 * (src/lib/region.ts) and handed down from the root layout, so server and
 * client render the same currency and the same region-dependent copy.
 * Outside the provider the region is "not EU" (US dollars).
 *
 * Two currencies, two places:
 *   - the public pages show useDisplayCurrency (euros on Spanish pages and
 *     for EU visitors, US dollars otherwise);
 *   - inside the product every price hint shows useChargeCurrency: the
 *     currency the customer will actually be charged, euros only in the 27
 *     EU states, whatever the interface language. The signed-in layout sets
 *     it from the same decision as the pilot bar's "Move to the paid plan"
 *     (inAppPlanOffer in src/lib/plan-upgrade.ts).
 */

import { createContext, useCallback, useContext } from "react";
import { useLocale } from "next-intl";
import { currencyFor, type Currency } from "@/lib/region";
import { formatPrice, formatPriceIn } from "@/lib/currency";

const RegionContext = createContext(false);
const ChargeCurrencyContext = createContext<Currency | null>(null);

export function RegionProvider({ eu, children }: { eu: boolean; children: React.ReactNode }) {
  return <RegionContext.Provider value={eu}>{children}</RegionContext.Provider>;
}

/** True when the visitor is in one of the 27 EU member states. */
export function useIsEu(): boolean {
  return useContext(RegionContext);
}

/**
 * The signed-in application's charge currency, decided on the server from
 * the request (inAppPlanOffer), for every price hint inside the product.
 */
export function ChargeCurrencyProvider({
  currency,
  children,
}: {
  currency: Currency;
  children: React.ReactNode;
}) {
  return <ChargeCurrencyContext.Provider value={currency}>{children}</ChargeCurrencyContext.Provider>;
}

/**
 * The currency an in-app price is shown in: the one the customer will be
 * charged. Inside the signed-in layout it is the server's decision for this
 * request; elsewhere, the region's currency. Never the language's.
 */
export function useChargeCurrency(): Currency {
  const charge = useContext(ChargeCurrencyContext);
  const eu = useIsEu();
  return charge ?? (eu ? "EUR" : "USD");
}

/** The currency a public page shows: euros on Spanish pages, otherwise the region's. */
export function useDisplayCurrency(): Currency {
  const eu = useIsEu();
  return currencyFor(useLocale(), eu);
}

/**
 * Whether copy may name EU hosting: always on Spanish pages, and in English
 * only for visitors in the EU.
 */
export function useNamesEuHosting(): boolean {
  const eu = useIsEu();
  const locale = useLocale();
  return eu || locale.toLowerCase().startsWith("es");
}

/** An in-app price for a sentence in the page's language ("49 €", "49 US$", "€49", "$49"), in the charge currency. */
export function usePriceInSentence(): (amount: number) => string {
  const currency = useChargeCurrency();
  const locale = useLocale();
  return useCallback((amount: number) => formatPriceIn(amount, locale, currency), [locale, currency]);
}

/** formatPrice bound to the in-app charge currency. */
export function useFormatPrice(): (amount: number) => string {
  const currency = useChargeCurrency();
  return useCallback((amount: number) => formatPrice(amount, currency), [currency]);
}
