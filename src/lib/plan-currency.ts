// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One currency per visitor, for the paid plan's payment link, under the
 * site's one rule (owner, 12 Oct 2026; src/lib/region.ts): euros only for the
 * 27 EU member states, US dollars for everyone else (the UK, Switzerland, the
 * EEA outside the EU, Latin America and the rest of the world). The country
 * is the hosting platform's header (x-vercel-ip-country) when it gives a
 * two-letter code; otherwise the region of the first Accept-Language tag that
 * carries one; otherwise USD.
 *
 * The country list is region.ts's EU_COUNTRIES; there is no second list here.
 */

import { COUNTRY_HEADER, regionCurrency, type Currency } from "@/lib/region";

export type PlanCurrency = Currency;

/** The region of the first Accept-Language tag (by preference) that names one, or null. */
export function regionFromAcceptLanguage(header: string | null | undefined): string | null {
  const tags = (header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((t) => t.tag && t.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of tags) {
    const region = tag
      .split(/[-_]/)
      .slice(1)
      .find((sub) => /^[A-Za-z]{2}$/.test(sub));
    if (region) return region.toUpperCase();
  }
  return null;
}

/** The visitor's currency from a request's headers. */
export function planCurrencyFromHeaders(headers: { get(name: string): string | null }): PlanCurrency {
  const country = (headers.get(COUNTRY_HEADER) ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) return regionCurrency(country);
  return regionCurrency(regionFromAcceptLanguage(headers.get("accept-language")));
}
