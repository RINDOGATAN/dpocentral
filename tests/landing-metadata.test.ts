// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's title and description follow the language it shows:
 * `?lang=` first, then the `locale` cookie (last value wins), else English.
 * Before this, `?lang=es` without the cookie showed the English title over the
 * Spanish page, and the Spanish title was the old tagline. The landing also
 * sets document.title when the visitor toggles the language. Same pattern as
 * AI Sentinel's landing (its PR #76).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

let cookieHeader: string | null = null;
let acceptLanguage: string | null = null;

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(acceptLanguage ? { "accept-language": acceptLanguage } : {}),
    }),
}));
vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: () => {}, useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/landing/LandingPage", () => ({ default: () => null }));

const { generateMetadata, default: HomePage } = await import("@/app/page");
const { LANDING_SEO, landingLocale, prefersSpanish } = await import("@/config/seo");

const ROOT = path.resolve(__dirname, "..");
const meta = (search: Record<string, string | string[]> = {}) => generateMetadata({ searchParams: Promise.resolve(search) });
const ES_TITLE = "DPO CENTRAL: gestión de la privacidad y la protección de datos, sin hojas de cálculo";

beforeEach(() => {
  cookieHeader = null;
  acceptLanguage = null;
});

describe("landing metadata", () => {
  it("keeps the English title and description the layout has always written", async () => {
    expect(LANDING_SEO.en.title).toBe(`DPO CENTRAL - ${en.metadata.tagline}`);
    expect(LANDING_SEO.en.description).toBe(en.metadata.description);
    const m = await meta();
    expect(m.title).toEqual({ absolute: LANDING_SEO.en.title });
    expect(m.description).toBe(LANDING_SEO.en.description);
    expect(m.openGraph).toMatchObject({ title: LANDING_SEO.en.title, locale: "en" });
  });

  it("writes the Spanish title and the Spanish description", async () => {
    expect(LANDING_SEO.es.title).toBe(ES_TITLE);
    expect(LANDING_SEO.es.description).toBe(es.metadata.description);
    for (const s of [LANDING_SEO.es.title, LANDING_SEO.es.description]) {
      expect(s).not.toMatch(/[—–]|ejecut(?!iv)|\busted\b|vosotr/i);
    }
  });

  it("returns Spanish for ?lang=es without a cookie, and for the cookie", async () => {
    const fromParam = await meta({ lang: "es" });
    expect(fromParam.title).toEqual({ absolute: ES_TITLE });
    expect(fromParam.openGraph).toMatchObject({ title: ES_TITLE, description: LANDING_SEO.es.description, locale: "es" });
    expect(fromParam.twitter).toMatchObject({ title: ES_TITLE });
    cookieHeader = "locale=es";
    expect((await meta()).title).toEqual({ absolute: ES_TITLE });
  });

  it("lets ?lang= win over the cookie, and the last cookie value win", async () => {
    cookieHeader = "locale=es";
    expect((await meta({ lang: "en" })).title).toEqual({ absolute: LANDING_SEO.en.title });
    cookieHeader = "locale=en; locale=es";
    expect((await meta()).title).toEqual({ absolute: ES_TITLE });
    cookieHeader = "locale=es; locale=en";
    expect((await meta()).title).toEqual({ absolute: LANDING_SEO.en.title });
    expect(landingLocale(["es", "en"], null)).toBe("es");
    expect(landingLocale("fr", null)).toBe("en");
  });

  it("updates the tab title on the toggle, and drops a stale ?lang= first", () => {
    const landing = readFileSync(path.join(ROOT, "src/landing/LandingPage.tsx"), "utf8");
    expect(landing).toMatch(/document\.title = LANDING_SEO\[locale\]\.title;/);
    expect(landing).toMatch(/searchParams\.delete\("lang"\)/);
  });

  // Regression: a Spanish browser with no cookie and no ?lang= saw English.
  it("serves Spanish to a Spanish browser with no cookie, from the first paint", async () => {
    acceptLanguage = "es-ES,es;q=0.9,en;q=0.8";
    expect((await meta()).title).toEqual({ absolute: ES_TITLE });
    const el = (await HomePage({ searchParams: Promise.resolve({}) })) as { props: { initialLocale: string } };
    expect(el.props.initialLocale).toBe("es");
    // The cookie and ?lang= still come first.
    cookieHeader = "locale=en";
    expect((await meta()).title).toEqual({ absolute: LANDING_SEO.en.title });
    cookieHeader = null;
    expect((await meta({ lang: "en" })).title).toEqual({ absolute: LANDING_SEO.en.title });
    acceptLanguage = "en-US,en;q=0.9,es;q=0.5";
    expect((await meta()).title).toEqual({ absolute: LANDING_SEO.en.title });
  });

  it("reads Accept-Language by quality, Spanish only when it comes before English", () => {
    expect(prefersSpanish("es")).toBe(true);
    expect(prefersSpanish("es-419")).toBe(true);
    expect(prefersSpanish("fr-FR,es;q=0.8,en;q=0.5")).toBe(true);
    expect(prefersSpanish("en;q=0.4,es;q=0.6")).toBe(true);
    expect(prefersSpanish("en-GB,es;q=0.9")).toBe(false);
    expect(prefersSpanish("fr-FR")).toBe(false);
    expect(prefersSpanish("es;q=0")).toBe(false);
    expect(prefersSpanish(null)).toBe(false);
  });

  it("renders the landing in the server's language and never switches it on load", () => {
    const landing = readFileSync(path.join(ROOT, "src/landing/LandingPage.tsx"), "utf8");
    expect(landing).toMatch(/useState<"en" \| "es">\(initialLocale\)/);
    expect(landing).not.toMatch(/detectLocale|readLocaleCookie/);
    const hero = readFileSync(path.join(ROOT, "src/landing/components/StartupProductPage.tsx"), "utf8");
    // The hero block (badge, title, subtitle) is visible in the server's HTML.
    expect(hero).toContain("<m.div initial={false}>");
  });
});
