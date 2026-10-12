"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The visitor's region, resolved on the server from the country header
 * (src/lib/region.ts) and handed down from the root layout, so server and
 * client render the same currency and the same region-dependent copy.
 * Outside the provider the region is "not EU" (US dollars).
 */

import { createContext, useCallback, useContext } from "react";
import { useLocale } from "next-intl";
import { currencyFor, type Currency } from "@/lib/region";
import { formatPrice, formatPriceIn } from "@/lib/currency";

const RegionContext = createContext(false);

export function RegionProvider({ eu, children }: { eu: boolean; children: React.ReactNode }) {
  return <RegionContext.Provider value={eu}>{children}</RegionContext.Provider>;
}

/** True when the visitor is in one of the 27 EU member states. */
export function useIsEu(): boolean {
  return useContext(RegionContext);
}

/** The currency this page shows: euros on Spanish pages, otherwise the region's. */
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

/** A price for a sentence in the page's language ("49 €", "€49", "$49"). */
export function usePriceInSentence(): (amount: number) => string {
  const currency = useDisplayCurrency();
  const locale = useLocale();
  return useCallback((amount: number) => formatPriceIn(amount, locale, currency), [locale, currency]);
}

/** formatPrice bound to the page's currency. */
export function useFormatPrice(): (amount: number) => string {
  const currency = useDisplayCurrency();
  return useCallback((amount: number) => formatPrice(amount, currency), [currency]);
}
