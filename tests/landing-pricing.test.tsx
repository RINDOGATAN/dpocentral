// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing link and section (owner, 11 Oct 2026):
 *   - the header carries "Pricing" / "Precios" to the section's anchor, the
 *     last link before the language switch (the phone menu has it too);
 *   - one currency per page: the Spanish section shows euros only, the
 *     English one US dollars only;
 *   - the pilot's limits are the ones the caps enforce;
 *   - the payment button is the yearly link of the page's currency, and the
 *     managed and own-hardware ways lead to the storefront's wizard;
 *   - plain copy: no long dash.
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StartupsHeader from "@/landing/components/StartupsHeader";
import PricingSection from "@/landing/components/PricingSection";
import LandingSections from "@/landing/components/LandingSections";
import { PLAN_PAYMENT_LINK, PRICING_COPY } from "@/landing/config/pricing";
import { PILOT_DAYS, PILOT_LIMITS } from "@/server/services/pilot/caps";

type L = "en" | "es";
const noop = () => {};
const header = (locale: L) =>
  renderToStaticMarkup(createElement(StartupsHeader, { t: (k: string) => k, locale, onLocaleToggle: noop, onSignup: noop }));
const section = (locale: L) => renderToStaticMarkup(createElement(PricingSection, { locale }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("header pricing link", () => {
  it.each([
    ["en", "Pricing", "#pricing"],
    ["es", "Precios", "#precios"],
  ] as const)("%s: shows %s, leading to %s, before the language switch", (locale, label, href) => {
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

  it("Spanish: euros only", () => {
    const t = text(section("es"));
    expect(t).toContain("1.800 € al año");
    expect(t).toContain("179 € al mes");
    expect(t).toContain("49 € al mes");
    expect(t).not.toMatch(/\$|\bUSD\b|dólar/i);
  });

  it("English: US dollars only", () => {
    const t = text(section("en"));
    expect(t).toContain("$1,800 a year");
    expect(t).toContain("$179 a month");
    expect(t).toContain("$49 a month");
    expect(t).not.toMatch(/€|\bEUR\b|\beuros?\b/i);
  });

  it("subscribes yearly with the link of the page's currency", () => {
    expect(section("en")).toContain(`href="${PLAN_PAYMENT_LINK.en}"`);
    expect(section("es")).toContain(`href="${PLAN_PAYMENT_LINK.es}"`);
    expect(PLAN_PAYMENT_LINK.en).not.toBe(PLAN_PAYMENT_LINK.es);
  });

  it("states the pilot's limits as the caps enforce them", () => {
    const en = text(section("en"));
    const es = text(section("es"));
    expect(en).toContain(`${PILOT_DAYS} days of editing`);
    expect(es).toContain(`${PILOT_DAYS} días de edición`);
    expect(en).toContain(`${PILOT_LIMITS.vendors} vendors`);
    expect(es).toContain(`${PILOT_LIMITS.members} miembros`);
  });

  it("quotes the managed instance and own hardware, with the storefront's wizard", () => {
    expect(section("en")).toContain('href="https://www.todo.law/contact/managed"');
    expect(section("en")).toContain('href="https://www.todo.law/contact/deployment"');
    expect(section("es")).toContain('href="https://www.todo.law/es/contact/managed"');
    expect(section("es")).toContain('href="https://www.todo.law/es/contact/deployment"');
    expect(text(section("en"))).toContain("On quotation");
    expect(text(section("es"))).toContain("Bajo presupuesto");
  });

  it("links the sub-processors in the page's language", () => {
    expect(section("en")).toContain("https://www.todo.law/legal/eu-cloud-plan-subprocessors");
    expect(section("es")).toContain("https://www.todo.law/es/legal/subencargados-plan-nube-ue");
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
