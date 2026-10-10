// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A row of customer logos. Renders nothing at all while the list is empty,
 * which is how it ships: a logo is added to src/landing/config/customer-logos.ts
 * only with the customer's written consent.
 */

import { CUSTOMER_LOGOS, type CustomerLogo } from "../config/customer-logos";

interface CustomerLogosProps {
  t: (key: string) => string;
  /** For tests; the page uses the configured list. */
  logos?: readonly CustomerLogo[];
}

export default function CustomerLogos({ t, logos = CUSTOMER_LOGOS }: CustomerLogosProps) {
  if (logos.length === 0) return null;
  return (
    <section className="py-14 md:py-20 border-t border-border" aria-labelledby="customer-logos-heading">
      <div className="container px-6">
        <h2 id="customer-logos-heading" className="section-label block text-center mb-8">
          {t("es.logos.label")}
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 max-w-5xl mx-auto">
          {logos.map((logo) => {
            const img = (
              <img src={logo.src} alt={logo.name} className="h-8 md:h-10 w-auto opacity-80" />
            );
            return (
              <li key={logo.name}>
                {logo.href ? (
                  <a href={logo.href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-100">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
