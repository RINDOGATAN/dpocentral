// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The region rule (src/lib/region.ts): visitors in the 27 EU member states
 * see euros; every other visitor, and a request with no country header, sees
 * US dollars; Spanish pages always show euros. The middleware's cookie, the
 * landing's pricing block, the pilot bar, the in-app prices, the checkout and
 * the safeguards copy all follow it.
 */

import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { NextRequest, NextResponse } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import middleware from "@/middleware";
import {
  EU_COUNTRIES,
  checkoutCurrency,
  currencyFor,
  isEuCountry,
  regionCurrency,
} from "@/lib/region";
import { RegionProvider, useFormatPrice } from "@/components/region-provider";
import PricingSection from "@/landing/components/PricingSection";
import { PLAN_PAYMENT_LINK } from "@/landing/config/pricing";
import { pilotEndBarPrice } from "@/lib/pilot-end-bar";
import { SafeguardsChoiceList } from "@/components/safeguards/safeguards-parts";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const EUR_COUNTRIES = ["DE", "ES", "IE", "FR", "IT", "GR", "HR", "CY", "MT", "LU"];
const USD_COUNTRIES = ["GB", "CH", "NO", "IS", "LI", "MX", "BR", "US", "CA", "AR", "JP", "AU", "TR", "UA", "RS"];
const MISSING = [null, undefined, "", "XX", "EU"];

describe("the rule", () => {
  it("lists exactly the 27 EU member states", () => {
    expect(new Set(EU_COUNTRIES).size).toBe(27);
    expect(EU_COUNTRIES).not.toContain("GB");
    expect(EU_COUNTRIES).toContain("GR");
  });

  it.each(EUR_COUNTRIES)("%s -> EUR", (c) => {
    expect(isEuCountry(c)).toBe(true);
    expect(regionCurrency(c)).toBe("EUR");
    expect(currencyFor("en", isEuCountry(c))).toBe("EUR");
  });

  it.each(USD_COUNTRIES)("%s -> USD", (c) => {
    expect(isEuCountry(c)).toBe(false);
    expect(regionCurrency(c)).toBe("USD");
    expect(currencyFor("en", isEuCountry(c))).toBe("USD");
  });

  it.each(MISSING)("missing or unknown country (%s) -> USD", (c) => {
    expect(regionCurrency(c)).toBe("USD");
  });

  it("accepts lower-case codes", () => {
    expect(regionCurrency("de")).toBe("EUR");
    expect(regionCurrency("gb")).toBe("USD");
  });

  it("Spanish pages always show euros, whatever the country", () => {
    for (const c of [...EUR_COUNTRIES, ...USD_COUNTRIES, ...MISSING]) {
      expect(currencyFor("es", isEuCountry(c))).toBe("EUR");
      expect(currencyFor("es-ES", isEuCountry(c))).toBe("EUR");
    }
  });
});

describe("checkout currency", () => {
  it("charges what the page showed", () => {
    expect(checkoutCurrency({ locale: "en", country: "DE" })).toBe("EUR");
    expect(checkoutCurrency({ locale: "en", country: "GB" })).toBe("USD");
    expect(checkoutCurrency({ locale: "en", country: "CH" })).toBe("USD");
    expect(checkoutCurrency({ locale: "en", country: null })).toBe("USD");
    expect(checkoutCurrency({ locale: "es", country: "MX" })).toBe("EUR");
    expect(checkoutCurrency({ locale: "es", country: "US" })).toBe("EUR");
  });

  it("keeps a customer's stored billing currency", () => {
    expect(checkoutCurrency({ stored: "eur", locale: "en", country: "US" })).toBe("EUR");
    expect(checkoutCurrency({ stored: "usd", locale: "es", country: "ES" })).toBe("USD");
    // An unknown stored value falls back to the rule.
    expect(checkoutCurrency({ stored: "gbp", locale: "en", country: "GB" })).toBe("USD");
    expect(checkoutCurrency({ stored: null, locale: "en", country: "IE" })).toBe("EUR");
  });
});

describe("middleware currency cookie", () => {
  async function cookieFor(country: string | null, existing?: string) {
    const headers = new Headers();
    if (country) headers.set("x-vercel-ip-country", country);
    if (existing) headers.set("cookie", `currency=${existing}`);
    const res = await middleware(new NextRequest("https://example.test/privacy", { headers }));
    return res.cookies.get("currency")?.value;
  }

  it.each([
    ["DE", "EUR"],
    ["IE", "EUR"],
    ["GB", "USD"],
    ["CH", "USD"],
    ["NO", "USD"],
    ["BR", "USD"],
    ["US", "USD"],
    [null, "USD"],
  ] as const)("%s -> %s", async (country, expected) => {
    expect(await cookieFor(country)).toBe(expected);
  });

  it("replaces a value written under the earlier rule", async () => {
    // The earlier rule gave EUR to every non-US visitor.
    expect(await cookieFor("GB", "EUR")).toBe("USD");
    expect(await cookieFor(null, "EUR")).toBe("USD");
  });

  it("leaves a current value alone", async () => {
    expect(await cookieFor("DE", "EUR")).toBeUndefined();
    expect(await cookieFor("US", "USD")).toBeUndefined();
  });
});

const wrap = (locale: "en" | "es", eu: boolean, child: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={(locale === "es" ? es : en) as never} timeZone="UTC">
      <RegionProvider eu={eu}>{child}</RegionProvider>
    </NextIntlClientProvider>
  );
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("landing pricing block", () => {
  it("English, EU visitor: euros and the euro payment link", () => {
    const html = wrap("en", true, createElement(PricingSection, { locale: "en" }));
    expect(text(html)).toContain("then €179 a month or €1,800 a year");
    expect(html).toContain(`href="${PLAN_PAYMENT_LINK.EUR}"`);
    expect(text(html)).not.toMatch(/\$/);
  });

  it("English, outside the EU: the US offer, unchanged", () => {
    const html = wrap("en", false, createElement(PricingSection, { locale: "en" }));
    expect(text(html)).toContain("then $179 a month or $1,800 a year");
    expect(html).toContain(`href="${PLAN_PAYMENT_LINK.USD}"`);
    expect(text(html)).not.toMatch(/€|\bEU\b|Frankfurt|Europe/);
  });

  it.each([true, false])("Spanish (EU visitor: %s): always euros", (eu) => {
    const html = wrap("es", eu, createElement(PricingSection, { locale: "es" }));
    expect(text(html)).toContain("179 € al mes o 1.800 € al año");
    expect(html).toContain(`href="${PLAN_PAYMENT_LINK.EUR}"`);
    expect(text(html)).not.toMatch(/\$/);
  });
});

describe("pilot bar price", () => {
  it("follows the rule", () => {
    expect(pilotEndBarPrice("en", "USD")).toBe("$179 a month or $1,800 a year");
    expect(pilotEndBarPrice("en", "EUR")).toBe("€179 a month or €1,800 a year");
    expect(pilotEndBarPrice("es", "EUR")).toBe("179 € al mes o 1.800 € al año");
    expect(pilotEndBarPrice("es", "USD")).toBe("179 € al mes o 1.800 € al año");
  });
});

describe("in-app prices", () => {
  function Price() {
    return createElement("span", null, useFormatPrice()(9));
  }
  it.each([
    ["en", true, "€9"],
    ["en", false, "$9"],
    ["es", true, "€9"],
    ["es", false, "€9"],
  ] as const)("%s, EU %s -> %s", (locale, eu, expected) => {
    expect(text(wrap(locale, eu, createElement(Price)))).toContain(expected);
  });
});

describe("safeguards copy names EU hosting only to EU visitors (English)", () => {
  const list = (locale: "en" | "es", eu: boolean) =>
    text(
      wrap(
        locale,
        eu,
        createElement(SafeguardsChoiceList, { value: null, onChange: () => {}, legend: "q" })
      )
    );

  it("EU visitor sees the EU cloud", () => {
    expect(list("en", true)).toContain("a) For now, the shared EU cloud");
    expect(list("en", true)).toContain("hosted in the EU");
  });

  it("visitor outside the EU sees no EU hosting", () => {
    const t = list("en", false);
    expect(t).toContain("a) For now, the shared cloud");
    expect(t).not.toMatch(/\bEU\b|Europe|Frankfurt/);
  });

  it("Spanish keeps the EU cloud", () => {
    expect(list("es", false)).toContain("la nube compartida de la UE");
  });
});
