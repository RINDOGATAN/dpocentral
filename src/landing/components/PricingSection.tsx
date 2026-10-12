// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing block, reached from the header's "Pricing" /
 * "Precios" link (#pricing, #precios). Third version:
 * one simple block in both languages, matching the storefront home's (a
 * left-aligned title over a short "Product | Price" table): one row (what is
 * offered | what it costs), the "Start free" button and a small "Subscribe"
 * link, then one quiet line to the contact wizard. Under the price row, one
 * small line links the plan's terms and sub-processors (same tab); the block
 * says nothing about tax.
 * Copy and links: src/landing/config/pricing.ts. The same component, copy
 * and classes are on AI Sentinel's landing.
 *
 * Static on purpose: no scroll animation, so the block is in place when the
 * header link jumps to it and nothing shifts.
 */

import {
  PLAN_PAYMENT_LINK,
  PRICING_ANCHOR,
  PRICING_CONTACT_URL,
  PRICING_COPY,
  PRICING_LEGAL_URL,
  PRICING_PILOT_DAYS,
} from "../config/pricing";
import type { LandingLocale } from "../config/storefront";
import { useIsEu } from "@/components/region-provider";
import { currencyFor } from "@/lib/region";

/** A cell: stacked on phones, a table cell from `sm`, as on the storefront home. */
const CELL = "block sm:table-cell px-5 sm:px-6 align-top text-left";

export default function PricingSection({ locale }: { locale: LandingLocale }) {
  // Spanish: euros; English: euros in the EU, US dollars elsewhere (src/lib/region.ts).
  const currency = currencyFor(locale, useIsEu());
  const c = PRICING_COPY[locale];
  const legal = PRICING_LEGAL_URL[locale];
  const quiet = "underline underline-offset-4 hover:text-foreground transition-colors";
  const anchor = PRICING_ANCHOR[locale];
  const other = PRICING_ANCHOR[locale === "en" ? "es" : "en"];
  return (
    <section
      id={anchor}
      className="py-16 md:py-24 scroll-mt-24"
      aria-labelledby={`${anchor}-heading`}
      data-testid="landing-pricing"
    >
      {/* A link in the other language's anchor lands here too. */}
      <span id={other} className="block scroll-mt-24" aria-hidden="true" />
      <div className="container px-6 max-w-5xl mx-auto">
        <h2 id={`${anchor}-heading`} className="font-display text-2xl md:text-4xl mb-6">
          {c.heading}
        </h2>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full border-collapse" data-testid="pricing-table">
            <thead className="hidden sm:table-header-group">
              <tr>
                {c.cols.map((col, i) => (
                  <th key={col} scope="col" className={`${CELL} pt-4 pb-3 text-muted-foreground font-medium text-xs tracking-[0.1em] uppercase ${i === 0 ? "sm:w-[52%]" : ""}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="block sm:table-row sm:border-t sm:border-border" data-testid="pricing-row">
                <th scope="row" className={`${CELL} pt-5 pb-1 sm:py-5 font-medium text-base md:text-lg leading-snug`} data-testid="pricing-offer">
                  {c.offer}
                </th>
                <td className={`${CELL} pb-5 sm:py-5 text-base md:text-lg text-muted-foreground sm:text-foreground leading-snug font-body`} data-testid="pricing-price">
                  {c.price(PRICING_PILOT_DAYS, currency)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="px-5 sm:px-6 pb-4 sm:-mt-2 text-xs text-muted-foreground font-body" data-testid="pricing-legal">
            <a href={legal.terms} className={quiet} data-testid="pricing-terms">
              {c.legal.terms}
            </a>
            <span aria-hidden="true"> · </span>
            <a href={legal.subprocessors} className={quiet} data-testid="pricing-subprocessors">
              {c.legal.subprocessors}
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border px-5 sm:px-6 py-5">
            <a href="/sign-in" className="btn-primary" data-testid="pricing-start">
              {c.start}
            </a>
            <a
              href={PLAN_PAYMENT_LINK[currency]}
              rel="noopener"
              className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              data-testid="pricing-subscribe"
            >
              {c.subscribe}
            </a>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground font-body" data-testid="pricing-contact">
          {c.contact.question}{" "}
          <a
            href={PRICING_CONTACT_URL[locale]}
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            {c.contact.link}
          </a>
        </p>
      </div>
    </section>
  );
}
