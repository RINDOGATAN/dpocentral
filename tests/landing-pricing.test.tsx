// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing link and section (owner, 11 Oct 2026):
 *   - the header carries "Pricing" / "Precios" to the section's anchor, the
 *     last link before the language switch (the phone menu has it too);
 *   - one currency per page: the Spanish section shows euros only, the
 *     English one US dollars only;
 *   - second version (owner, 11 Oct 2026): only the hosted mode, in two
 *     cards (the free pilot, the Cloud Plan) and one contact line for a
 *     managed instance or your own hardware; the long paragraphs, the record
 *     limits, the rights-request line and the quote card are gone;
 *   - the pilot's editing days are the ones the caps enforce;
 *   - the payment button is the yearly link of the page's currency, and the
 *     contact line leads to the storefront's wizard;
 *   - plain copy: no long dash.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StartupsHeader from "@/landing/components/StartupsHeader";
import PricingSection from "@/landing/components/PricingSection";
import LandingSections from "@/landing/components/LandingSections";
import { PLAN_PAYMENT_LINK, PRICING_COPY, PRICING_SECTION_LOCALES, pricingShownFor } from "@/landing/config/pricing";
import { PILOT_DAYS } from "@/server/services/pilot/caps";

type L = "en" | "es";
const noop = () => {};
const header = (locale: L) =>
  renderToStaticMarkup(createElement(StartupsHeader, { t: (k: string) => k, locale, onLocaleToggle: noop, onSignup: noop }));
const section = (locale: L) => renderToStaticMarkup(createElement(PricingSection, { locale }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

afterEach(() => {
  vi.unstubAllEnvs();
});

const landing = (locale: L) =>
  renderToStaticMarkup(createElement(LandingSections, { t: (k: string) => k, locale, videos: [] }));

describe("pricing is shown in Spanish only for now (PRICING_SECTION_LOCALES)", () => {
  it("defaults to Spanish only", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICING_SECTION_LOCALES", "");
    expect([...PRICING_SECTION_LOCALES]).toEqual(["es"]);
    expect(pricingShownFor("es")).toBe(true);
    expect(pricingShownFor("en")).toBe(false);
  });

  it("English: no pricing link (desktop or phone) and no section", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICING_SECTION_LOCALES", "");
    const html = header("en");
    expect(html).not.toContain('data-testid="nav-pricing"');
    expect(html).not.toContain(">Pricing<");
    const page = landing("en");
    expect(page).not.toContain('id="pricing"');
    expect(page).not.toContain('id="precios"');
    expect(text(page)).not.toContain("$1,800");
  });

  it("Spanish: the section is on the landing", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICING_SECTION_LOCALES", "");
    expect(landing("es")).toContain('id="precios"');
  });

  it("flipping the flag to include English shows the link and the section", () => {
    vi.stubEnv("NEXT_PUBLIC_PRICING_SECTION_LOCALES", "es, en");
    expect(pricingShownFor("en")).toBe(true);
    expect(header("en")).toContain('data-testid="nav-pricing"');
    expect(landing("en")).toContain('id="pricing"');
    expect(landing("es")).toContain('id="precios"');
  });
});

describe("header pricing link (where shown)", () => {
  it.each([
    ["en", "Pricing", "#pricing"],
    ["es", "Precios", "#precios"],
  ] as const)("%s: shows %s, leading to %s, before the language switch", (locale, label, href) => {
    vi.stubEnv("NEXT_PUBLIC_PRICING_SECTION_LOCALES", "es,en");
    const html = header(locale);
    const tag = html.match(/<a[^>]*data-testid="nav-pricing"[^>]*>([^<]*)<\/a>/);
    expect(tag?.[0]).toContain(`href="${href}"`);
    expect(tag?.[1]).toBe(label);
    // The pricing link comes before the language button.
    expect(html.indexOf('data-testid="nav-pricing"')).toBeLessThan(html.indexOf(locale === "en" ? 'aria-label="Español"' : 'aria-label="English"'));
  });
});

describe("pricing section", () => {
  it.each(["en", "es"] as const)("%s: carries the anchor the header links to", (locale) => {
    const html = section(locale);
    expect(html).toContain(`id="${locale === "en" ? "pricing" : "precios"}"`);
    // The other language's anchor lands on it too.
    expect(html).toContain(`id="${locale === "en" ? "precios" : "pricing"}"`);
  });

  it("Spanish: the exact copy, euros only", () => {
    const t = text(section("es")).replace(/\s+/g, " ");
    for (const line of [
      "Precios",
      "Empieza gratis. Cuando lo necesites, pasa al plan de pago con todos tus registros.",
      "Piloto gratuito",
      "Gratis",
      `${PILOT_DAYS} días de edición`,
      "Después, solo lectura con exportación",
      "Empieza gratis",
      "Plan nube UE",
      "1.800 € al año",
      "o 179 € al mes",
      "DPO Central, AI Sentinel y VendorWatch",
      "Sin límite de usuarios ni de registros",
      "Datos en la UE (Fráncfort)",
      "Contratar",
      "Sin IVA español (inversión del sujeto pasivo para empresas de la UE). Condiciones y subencargados .",
      "¿Instancia gestionada o tu propio hardware? Escríbenos .",
    ]) {
      expect(t).toContain(line);
    }
    expect(t).not.toMatch(/\$|\bUSD\b|dólar/i);
  });

  it("English: the exact copy, US dollars only", () => {
    const t = text(section("en")).replace(/\s+/g, " ");
    for (const line of [
      "Pricing",
      "Start free. When you need it, move to the paid plan with all your records.",
      "Free pilot",
      "Free",
      `${PILOT_DAYS} days of editing`,
      "Then read-only with export",
      "Start free",
      "Cloud Plan",
      "$1,800 a year",
      "or $179 a month",
      "DPO Central, AI Sentinel and VendorWatch",
      "No limits on users or records",
      "Data stored in the EU (Frankfurt)",
      "Subscribe",
      "No VAT charged. Terms and sub-processors .",
      "Managed instance or your own hardware? Contact us .",
    ]) {
      expect(t).toContain(line);
    }
    expect(t).not.toMatch(/€|\bEUR\b|\beuros?\b/i);
  });

  it("has two cards and nothing of the first version", () => {
    for (const locale of ["en", "es"] as const) {
      const html = section(locale);
      expect(html.match(/<article/g)?.length).toBe(2);
      expect(html).not.toContain("<details");
      expect(html).not.toContain("/contact/deployment");
    }
    const all = text(section("en")) + text(section("es"));
    expect(all).not.toMatch(/49 €|\$49|On quotation|Bajo presupuesto|For real data|Para datos reales|test records|registros de prueba|How you pay|Cómo pagas/);
  });

  it("subscribes yearly with the link of the page's currency; starts the pilot at sign-in", () => {
    expect(section("en")).toContain(`href="${PLAN_PAYMENT_LINK.en}"`);
    expect(section("es")).toContain(`href="${PLAN_PAYMENT_LINK.es}"`);
    expect(PLAN_PAYMENT_LINK.en).not.toBe(PLAN_PAYMENT_LINK.es);
    expect(PLAN_PAYMENT_LINK.es).toBe("https://buy.stripe.com/fZubJ273hbnnbH56qn4sE04");
    expect(PLAN_PAYMENT_LINK.en).toBe("https://buy.stripe.com/aFa9AU73h3UV26v7ur4sE05");
    for (const locale of ["en", "es"] as const) {
      expect(section(locale)).toMatch(/<a href="\/sign-in"[^>]*data-testid="pricing-start"/);
    }
  });

  it("sends a managed instance or own hardware to the storefront's wizard", () => {
    expect(section("en")).toContain('href="https://www.todo.law/contact/managed"');
    expect(section("es")).toContain('href="https://www.todo.law/es/contact/managed"');
  });

  it("links the plan terms and sub-processors in the page's language", () => {
    expect(section("en")).toContain('href="https://www.todo.law/legal/eu-cloud-plan-terms"');
    expect(section("en")).toContain('href="https://www.todo.law/legal/eu-cloud-plan-subprocessors"');
    expect(section("es")).toContain('href="https://www.todo.law/es/legal/condiciones-plan-nube-ue"');
    expect(section("es")).toContain('href="https://www.todo.law/es/legal/subencargados-plan-nube-ue"');
  });

  it("follows the ways section on the landing", () => {
    const html = renderToStaticMarkup(createElement(LandingSections, { t: (k: string) => k, locale: "es", videos: [] }));
    expect(html.indexOf("es.ways-heading")).toBeGreaterThan(-1);
    expect(html.indexOf('id="precios"')).toBeGreaterThan(html.indexOf("es.ways-heading"));
  });

  it("uses no long dash and says tú in Spanish", () => {
    const all = JSON.stringify(PRICING_COPY) + text(section("en")) + text(section("es"));
    expect(all).not.toMatch(/[—–]|--/);
    expect(text(section("es"))).not.toMatch(/\busted\b/i);
  });
});
