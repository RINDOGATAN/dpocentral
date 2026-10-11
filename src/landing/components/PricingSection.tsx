// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing section, reached from the header's "Pricing" /
 * "Precios" link (#pricing, #precios). Three cards (the free pilot, the
 * Cloud Plan, a managed instance or your own hardware), then how you pay,
 * VAT and the legal links. Copy and links: src/landing/config/pricing.ts.
 *
 * Static on purpose: no scroll animation and no hover lift, so the section
 * is in place when the header link jumps to it and nothing shifts. The
 * record limits sit in a closed disclosure the visitor opens.
 */

import { Check, ExternalLink } from "lucide-react";
import {
  PLAN_PAYMENT_LINK,
  PRICING_ANCHOR,
  PRICING_COPY,
  PRICING_LINKS,
  pilotFacts,
} from "../config/pricing";
import type { LandingLocale } from "../config/storefront";

const CARD = "w-full rounded-2xl border bg-card p-6 flex flex-col";
const LINK =
  "inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground transition-colors underline-offset-4 hover:underline";

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm font-body text-muted-foreground">
      <Check className="w-4 h-4 mt-0.5 text-accent flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function PricingSection({ locale }: { locale: LandingLocale }) {
  const pilot = pilotFacts();
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
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="section-label">{c.label}</span>
          <h2 id={`${anchor}-heading`} className="text-2xl md:text-4xl mt-2 mb-4">
            {c.heading}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-body">{c.sub}</p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Free pilot */}
          <article className={`${CARD} border-border`} aria-labelledby={`${anchor}-pilot`}>
            <h3 id={`${anchor}-pilot`} className="text-xl font-display">{c.pilot.title}</h3>
            <p className="text-3xl font-display mt-3">{c.pilot.price}</p>
            <p className="text-sm text-muted-foreground font-body mt-2 mb-5">{c.pilot.lead}</p>
            <ul className="space-y-2.5 mb-5">
              <Item>{c.pilot.window(pilot.days)}</Item>
              <Item>{c.pilot.oneOrg}</Item>
              {pilot.dpias > 0 && <Item>{c.pilot.dpias(pilot.dpias)}</Item>}
              <Item>{c.pilot.modules}</Item>
              <Item>{c.pilot.testData}</Item>
            </ul>
            <details className="mb-6 text-sm font-body text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">{c.pilot.limitsTitle}</summary>
              <p className="mt-2">{c.pilot.limitsIntro}</p>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {pilot.limits.map((l) => (
                  <li key={l.key}>
                    {l.limit} {l.label[locale]}
                  </li>
                ))}
              </ul>
            </details>
            <a href="/sign-in" className="mt-auto self-start inline-flex items-center justify-center rounded-full border border-primary text-primary px-5 py-2.5 text-sm font-medium hover:bg-primary/10 transition-colors">
              {c.pilot.cta}
            </a>
          </article>

          {/* Cloud Plan */}
          <article className={`${CARD} border-accent/60`} aria-labelledby={`${anchor}-plan`}>
            <span className="self-start rounded-full bg-accent/10 text-accent px-3 py-1 text-xs font-medium font-body mb-3">
              {c.plan.badge}
            </span>
            <h3 id={`${anchor}-plan`} className="text-xl font-display">{c.plan.title}</h3>
            <p className="text-3xl font-display mt-3" data-testid="pricing-plan-price">{c.plan.price}</p>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {c.plan.monthly}, {c.plan.per}
            </p>
            <p className="text-sm font-medium text-foreground font-body mt-5 mb-2.5">{c.plan.included}</p>
            <ul className="space-y-2.5 mb-4">
              {c.plan.items.map((item) => (
                <Item key={item}>{item}</Item>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground font-body mb-6">{c.plan.addon}</p>
            <a
              href={PLAN_PAYMENT_LINK[locale]}
              rel="noopener"
              className="btn-primary text-sm py-2.5 px-5 mt-auto self-start"
              data-testid="pricing-subscribe"
            >
              {c.plan.cta}
            </a>
          </article>

          {/* Managed instance or your own hardware */}
          <article className={`${CARD} border-border`} aria-labelledby={`${anchor}-quote`}>
            <h3 id={`${anchor}-quote`} className="text-xl font-display">{c.quote.title}</h3>
            <p className="text-3xl font-display mt-3">{c.quote.price}</p>
            <div className="mt-5 space-y-5">
              {(
                [
                  [c.quote.managed, links.managed],
                  [c.quote.own, links.deployment],
                ] as const
              ).map(([way, href]) => (
                <div key={way.title}>
                  <p className="text-sm font-medium text-foreground font-body">{way.title}</p>
                  <p className="text-sm text-muted-foreground font-body mt-1 mb-2">{way.desc}</p>
                  <a href={href} className={LINK}>
                    {c.quote.cta}
                    <span className="sr-only">: {way.title}</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-display mb-2">{c.how.title}</h3>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{c.how.text}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-display mb-2">{c.vat.title}</h3>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{c.vat.text}</p>
            <p className="text-sm font-body mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-muted-foreground">{c.legal.intro}</span>
              <a href={links.terms} className={LINK}>{c.legal.terms}</a>
              <a href={links.subprocessors} className={LINK}>{c.legal.subprocessors}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
