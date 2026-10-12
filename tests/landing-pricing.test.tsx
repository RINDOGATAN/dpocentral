// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing block, third version:
 *   - one simple block in BOTH languages, right after the hosting block;
 *   - the header carries "Pricing" / "Precios" to the block's anchor, the
 *     last link before the language switch (the phone menu has it too);
 *   - one row: what is offered | what it costs; "Start free" to sign-up, a
 *     small "Subscribe" link to the yearly payment link of the page's
 *     currency; one quiet line to the storefront's contact wizard;
 *   - one currency per page (English $, Spanish €), never stated as equal;
 *     EU hosting named only in Spanish;
 *   - the pilot's days are the ones the caps enforce;
 *   - plain copy: no long dash; Spanish says tú.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StartupsHeader from "@/landing/components/StartupsHeader";
import PricingSection from "@/landing/components/PricingSection";
import { RegionProvider } from "@/components/region-provider";
import LandingSections from "@/landing/components/LandingSections";
import { PLAN_PAYMENT_LINK, PRICING_COPY, PRICING_LEGAL_URL, PRICING_PILOT_DAYS } from "@/landing/config/pricing";
import { PILOT_DAYS } from "@/server/services/pilot/caps";

type L = "en" | "es";
const noop = () => {};
const header = (locale: L) =>
  renderToStaticMarkup(createElement(StartupsHeader, { t: (k: string) => k, locale, onLocaleToggle: noop, onSignup: noop }));
const section = (locale: L) => renderToStaticMarkup(createElement(PricingSection, { locale }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const landing = (locale: L) =>
  renderToStaticMarkup(createElement(LandingSections, { t: (k: string) => k, locale, videos: [] }));

describe("the pricing block is on both landings", () => {
  it.each(["en", "es"] as const)("%s: the block and the header link are shown", (locale) => {
    const anchor = locale === "en" ? "pricing" : "precios";
    expect(landing(locale)).toContain(`id="${anchor}"`);
    expect(header(locale)).toContain('data-testid="nav-pricing"');
  });

  it.each(["en", "es"] as const)("%s: follows the hosting (ways) section", (locale) => {
    const html = landing(locale);
    const ways = html.indexOf(`${locale}.ways-heading`);
    expect(ways).toBeGreaterThan(-1);
    expect(html.indexOf(`id="${locale === "en" ? "pricing" : "precios"}"`)).toBeGreaterThan(ways);
  });
});

describe("header pricing link", () => {
  it.each([
    ["en", "Pricing", "#pricing"],
    ["es", "Precios", "#precios"],
  ] as const)("%s: shows %s, leading to %s, before the language switch", (locale, label, href) => {
    const html = header(locale);
    const tag = html.match(/<a[^>]*data-testid="nav-pricing"[^>]*>([^<]*)<\/a>/);
    expect(tag?.[0]).toContain(`href="${href}"`);
    expect(tag?.[1]).toBe(label);
    expect(html.indexOf('data-testid="nav-pricing"')).toBeLessThan(
      html.indexOf(locale === "en" ? 'aria-label="Español"' : 'aria-label="English"'),
    );
  });
});

describe("pricing block", () => {
  it.each(["en", "es"] as const)("%s: carries the anchor the header links to, and the other language's", (locale) => {
    const html = section(locale);
    expect(html).toContain(`id="${locale === "en" ? "pricing" : "precios"}"`);
    expect(html).toContain(`id="${locale === "en" ? "precios" : "pricing"}"`);
  });

  it("reads the pilot's days from the caps", () => {
    expect(PRICING_PILOT_DAYS).toBe(PILOT_DAYS);
    expect(PILOT_DAYS).toBe(15);
  });

  it("English: the exact copy, US dollars only, no hosting region", () => {
    const t = text(section("en"));
    for (const line of [
      "Pricing",
      "DPO Central, AI Sentinel and VendorWatch on the TODO.LAW cloud",
      `Start free (${PILOT_DAYS}-day trial), then $179 a month or $1,800 a year`,
      "Start free",
      "Subscribe",
      "Managed instance or your own hardware? Get a quotation.",
    ]) {
      expect(t).toContain(line);
    }
    expect(t).not.toMatch(/€|\bEUR\b|\beuros?\b/i);
    expect(t).not.toMatch(/\bEU\b|Frankfurt|Europe/);
  });

  it("Spanish: the exact copy, euros only", () => {
    const t = text(section("es"));
    for (const line of [
      "Precios",
      "DPO Central, AI Sentinel y VendorWatch en la nube UE",
      `Empieza gratis (${PILOT_DAYS} días de prueba); después, 179 € al mes o 1.800 € al año`,
      "Empieza gratis",
      "Contratar",
      "¿Instancia gestionada o tu propio hardware? Solicita una oferta.",
    ]) {
      expect(t).toContain(line);
    }
    expect(t).not.toMatch(/\$|\bUSD\b|dólar/i);
  });

  it("never states or implies that the euro and dollar prices are the same", () => {
    const all = JSON.stringify(PRICING_COPY) + text(section("en")) + text(section("es"));
    expect(all).not.toMatch(/\$\s?\d[\d,.]*\s*\/\s*\d[\d.,]*\s?€|€\s*\/\s*\$|same price|mismo precio|equivalent|equivalente|or the equivalent|o su equivalente/i);
  });

  it("is one block: one row, no cards, nothing of the earlier versions", () => {
    for (const locale of ["en", "es"] as const) {
      const html = section(locale);
      expect(html).not.toContain("<article");
      expect(html.match(/data-testid="pricing-row"/g)?.length).toBe(1);
      expect(html).not.toContain("/contact/deployment");
    }
    const all = text(section("en")) + text(section("es"));
    expect(all).not.toMatch(/Free pilot|Piloto gratuito|No VAT|Sin IVA|Contact us|Escríbenos|Frankfurt|Fráncfort/);
  });

  it("starts the pilot at sign-in and subscribes yearly with the link of the page's currency", () => {
    expect(PLAN_PAYMENT_LINK.EUR).toBe("https://buy.stripe.com/fZubJ273hbnnbH56qn4sE04");
    expect(PLAN_PAYMENT_LINK.USD).toBe("https://buy.stripe.com/aFa9AU73h3UV26v7ur4sE05");
    // Outside the EU (the default): English in dollars, Spanish in euros.
    for (const [locale, cur, other] of [["en", "USD", "EUR"], ["es", "EUR", "USD"]] as const) {
      const html = section(locale);
      expect(html).toMatch(/<a href="\/sign-in"[^>]*data-testid="pricing-start"/);
      const sub = html.match(/<a[^>]*data-testid="pricing-subscribe"[^>]*>/)?.[0] ?? "";
      expect(sub).toContain(`href="${PLAN_PAYMENT_LINK[cur]}"`);
      expect(sub).not.toContain(PLAN_PAYMENT_LINK[other]);
    }
  });

  it("sends a managed instance or own hardware to the storefront's contact wizard", () => {
    expect(section("en")).toContain('href="https://www.todo.law/contact/managed"');
    expect(section("es")).toContain('href="https://www.todo.law/es/contact/managed"');
  });

  it("uses no long dash and says tú in Spanish", () => {
    const all = JSON.stringify(PRICING_COPY) + text(section("en")) + text(section("es"));
    expect(all).not.toMatch(/[—–]|--/);
    expect(text(section("es"))).not.toMatch(/\busted\b/i);
  });
});

describe("pricing block: legal links, no tax", () => {
  // The page's currency picks the documents: the dollar plan (English, outside the EU) links
  // its own terms, the DPA and the sub-processor list; the euro plan keeps its terms and list.
  const CASES = {
    "en, dollars": {
      html: () => section("en"),
      links: [
        ["terms", "Terms", "https://www.todo.law/legal/cloud-plan-terms"],
        ["dpa", "DPA", "https://www.todo.law/legal/eu-cloud-plan-dpa"],
        ["subprocessors", "Sub-processors", "https://www.todo.law/legal/eu-cloud-plan-subprocessors"],
      ],
    },
    "en, euros (EU visitor)": {
      html: () => renderToStaticMarkup(
        <RegionProvider eu>
          <PricingSection locale="en" />
        </RegionProvider>,
      ),
      links: [
        ["terms", "Terms", "https://www.todo.law/legal/eu-cloud-plan-terms"],
        ["subprocessors", "Sub-processors", "https://www.todo.law/legal/eu-cloud-plan-subprocessors"],
      ],
    },
    es: {
      html: () => section("es"),
      links: [
        ["terms", "Condiciones", "https://www.todo.law/es/legal/condiciones-plan-nube-ue"],
        ["subprocessors", "Subencargados", "https://www.todo.law/es/legal/subencargados-plan-nube-ue"],
      ],
    },
  } as const;

  it.each(Object.keys(CASES) as (keyof typeof CASES)[])("%s: one small line under the price row with the plan's legal links", (name) => {
    const { html: render, links } = CASES[name];
    const html = render();
    const line = html.match(/<p[^>]*data-testid="pricing-legal"[^>]*>([\s\S]*?)<\/p>/);
    expect(line).not.toBeNull();
    expect(html.match(/data-testid="pricing-legal"/g)?.length).toBe(1);
    // Under the price row, before the buttons.
    expect(html.indexOf('data-testid="pricing-legal"')).toBeGreaterThan(html.indexOf('data-testid="pricing-price"'));
    expect(html.indexOf('data-testid="pricing-legal"')).toBeLessThan(html.indexOf('data-testid="pricing-start"'));
    for (const [key, label, href] of links) {
      const a = line![1].match(new RegExp(`<a([^>]*data-testid="pricing-${key}"[^>]*)>([^<]*)</a>`));
      expect(a?.[1]).toContain(`href="${href}"`);
      expect(a?.[2]).toBe(label);
      // Same tab.
      expect(a?.[1]).not.toContain("target=");
    }
    expect(text(line![1]).trim()).toBe(links.map(([, label]) => label).join(" · "));
  });

  it("keeps the euro plan's documents in PRICING_LEGAL_URL", () => {
    expect(PRICING_LEGAL_URL.en.terms).toBe("https://www.todo.law/legal/eu-cloud-plan-terms");
    expect(PRICING_LEGAL_URL.es.terms).toBe("https://www.todo.law/es/legal/condiciones-plan-nube-ue");
  });

  it.each(["en", "es"] as const)("%s: never mentions VAT, IVA, reverse charge or tax", (locale) => {
    const all = JSON.stringify(PRICING_COPY[locale]) + text(section(locale));
    expect(all).not.toMatch(/\bVAT\b|\bIVA\b|reverse.?charge|inversión del sujeto|sujeto pasivo|\btax(es)?\b|impuestos?|tributos?/i);
  });

  it.each(["llms.txt", "llms-full.txt"])("public/%s never mentions VAT, IVA or reverse charge", (file) => {
    const body = readFileSync(join(process.cwd(), "public", file), "utf8");
    expect(body).not.toMatch(/\bVAT\b|\bIVA\b|reverse.?charge|inversión del sujeto|sujeto pasivo/i);
  });
});
