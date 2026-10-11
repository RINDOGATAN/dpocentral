// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing section, reached from the header's "Pricing" /
 * "Precios" link (#pricing, #precios). Second version (owner, 11 Oct 2026):
 * only the TODO.LAW hosted mode, in two cards side by side (stacked on
 * phones): the free pilot and the Cloud Plan, the second one highlighted.
 * One line under the cards sends a managed instance or your own hardware to
 * the storefront's contact wizard. Copy and links: src/landing/config/pricing.ts.
 * The same component, copy and classes are on AI Sentinel's landing.
 *
 * Static on purpose: no scroll animation and no hover lift on the cards, so
 * the section is in place when the header link jumps to it and nothing
 * shifts. From `md`, the two cards share their rows (CSS subgrid), so the
 * titles, prices, lists and buttons line up whatever the text length.
 */

import { Check } from "lucide-react";
import {
  PLAN_PAYMENT_LINK,
  PRICING_ANCHOR,
  PRICING_COPY,
  PRICING_LINKS,
  PRICING_PILOT_DAYS,
} from "../config/pricing";
import type { LandingLocale } from "../config/storefront";

/** A card: a column on phones, five shared rows from `md` (title, price, list, button, note). */
const CARD =
  "relative overflow-hidden rounded-2xl border bg-card p-8 md:p-10 flex flex-col md:grid md:grid-rows-subgrid md:row-span-5 md:gap-0";
const NOTE_LINK = "underline underline-offset-2 hover:text-foreground transition-colors";

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm md:text-base font-body text-foreground/90">
      <Check className="w-5 h-5 mt-0.5 text-accent flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function PricingSection({ locale }: { locale: LandingLocale }) {
  const c = PRICING_COPY[locale];
  const links = PRICING_LINKS[locale];
  const anchor = PRICING_ANCHOR[locale];
  const other = PRICING_ANCHOR[locale === "en" ? "es" : "en"];
  return (
    <section
      id={anchor}
      className="py-20 md:py-28 bg-secondary/20 border-y border-border scroll-mt-24"
      aria-labelledby={`${anchor}-heading`}
      data-testid="landing-pricing"
    >
      {/* A link in the other language's anchor lands here too. */}
      <span id={other} className="block scroll-mt-24" aria-hidden="true" />
      <div className="container px-6">
        <div className="max-w-2xl mx-auto text-center mb-12 md:mb-16">
          <h2 id={`${anchor}-heading`} className="text-3xl md:text-5xl mb-4">
            {c.heading}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-body">{c.lead}</p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8">
          {/* Free pilot */}
          <article
            className={`${CARD} border-border shadow-[var(--shadow-card)]`}
            aria-labelledby={`${anchor}-pilot`}
            data-testid="pricing-pilot"
          >
            <h3 id={`${anchor}-pilot`} className="text-lg font-display">{c.pilot.title}</h3>
            <div className="mt-4">
              <p className="text-4xl md:text-5xl leading-none font-display tracking-tight">{c.pilot.price}</p>
            </div>
            <ul className="mt-8 space-y-3">
              <Item>{c.pilot.window(PRICING_PILOT_DAYS)}</Item>
              <Item>{c.pilot.after}</Item>
            </ul>
            <div className="mt-8 md:mt-10">
              <a
                href="/sign-in"
                className="w-full inline-flex items-center justify-center rounded-full border border-primary/70 text-primary px-6 py-3 font-medium hover:bg-primary/10 transition-colors"
                data-testid="pricing-start"
              >
                {c.pilot.cta}
              </a>
            </div>
            <div aria-hidden="true" />
          </article>

          {/* Cloud Plan (highlighted, as the hero's sign-in card) */}
          <article
            className={`${CARD} border-accent/70 shadow-[var(--shadow-hover)]`}
            aria-labelledby={`${anchor}-plan`}
            data-testid="pricing-plan"
          >
            <div
              className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 bg-accent/15 rounded-full blur-3xl"
              aria-hidden="true"
            />
            <h3 id={`${anchor}-plan`} className="relative text-lg font-display text-accent">{c.plan.title}</h3>
            <div className="relative mt-4">
              <p className="leading-none font-display tracking-tight" data-testid="pricing-plan-price">
                <span className="text-4xl md:text-5xl">{c.plan.amount}</span>{" "}
                <span className="text-xl md:text-2xl text-muted-foreground">{c.plan.period}</span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground font-body">{c.plan.monthly}</p>
            </div>
            <ul className="relative mt-8 space-y-3">
              {c.plan.items.map((item) => (
                <Item key={item}>{item}</Item>
              ))}
            </ul>
            <div className="relative mt-8 md:mt-10">
              <a
                href={PLAN_PAYMENT_LINK[locale]}
                rel="noopener"
                className="btn-primary w-full"
                data-testid="pricing-subscribe"
              >
                {c.plan.cta}
              </a>
            </div>
            <p className="relative mt-4 text-xs leading-relaxed text-muted-foreground font-body text-center">
              {c.plan.note.tax}{" "}
              <a href={links.terms} className={NOTE_LINK}>{c.plan.note.terms}</a>{" "}
              {c.plan.note.and}{" "}
              <a href={links.subprocessors} className={NOTE_LINK}>{c.plan.note.subprocessors}</a>
              {c.plan.note.end}
            </p>
          </article>
        </div>

        <p className="mt-10 md:mt-12 text-center text-sm md:text-base text-muted-foreground font-body" data-testid="pricing-contact">
          {c.contact.question}{" "}
          <a
            href={links.contact}
            className="font-medium text-accent underline-offset-4 hover:underline hover:text-foreground transition-colors"
          >
            {c.contact.link}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
