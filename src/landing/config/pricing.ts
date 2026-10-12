// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing block (third version): one
 * simple block, right under the hosting block, in both languages, matching
 * the storefront home's pricing block. A title, one row (what is offered |
 * what it costs), a "Start free" button to the existing sign-up, a small
 * "Subscribe" link to the yearly payment link, and one quiet line to the
 * storefront's contact wizard for a managed instance or your own hardware.
 * The same block, copy and classes are on AI Sentinel's landing.
 *
 * One currency per visitor (src/lib/region.ts): the Spanish page always
 * shows euros; the English page shows euros to visitors in the 27 EU member
 * states and US dollars to everyone else. The two are separate prices;
 * nothing here says or implies they are the same. EU hosting is named only
 * in Spanish ("en la nube UE").
 *
 * Under the price row, one small line links the plan's terms and its
 * sub-processors on the storefront (for the dollar plan, also the DPA; see pricingLegalLinks); the block says
 * nothing about tax.
 *
 * Payment links: the euro link is the storefront's (src/content/plan-nube-ue.ts),
 * the dollar link is a separate payment link. Only yearly links exist. The pilot's days
 * are read from the value the service enforces (src/server/services/pilot/limits.ts).
 */

import { PILOT_DAYS } from "@/server/services/pilot/limits";
import type { Currency } from "@/lib/region";
import { STOREFRONT_URL, type LandingLocale } from "./storefront";

/** The block's anchor, per language; the other language's anchor also lands on it. */
export const PRICING_ANCHOR: Record<LandingLocale, string> = { en: "pricing", es: "precios" };

/** The yearly payment link, per currency. */
export const PLAN_PAYMENT_LINK: Record<Currency, string> = {
  USD: "https://buy.stripe.com/aFa9AU73h3UV26v7ur4sE05",
  EUR: "https://buy.stripe.com/fZubJ273hbnnbH56qn4sE04",
};

/** The storefront's contact wizard for a managed instance or your own hardware. */
export const PRICING_CONTACT_URL: Record<LandingLocale, string> = {
  en: `${STOREFRONT_URL}/contact/managed`,
  es: `${STOREFRONT_URL}/es/contact/managed`,
};

/** The plan's terms and sub-processor pages on the storefront, per language (the euro plan). */
export const PRICING_LEGAL_URL: Record<LandingLocale, { terms: string; subprocessors: string }> = {
  en: {
    terms: `${STOREFRONT_URL}/legal/eu-cloud-plan-terms`,
    subprocessors: `${STOREFRONT_URL}/legal/eu-cloud-plan-subprocessors`,
  },
  es: {
    terms: `${STOREFRONT_URL}/es/legal/condiciones-plan-nube-ue`,
    subprocessors: `${STOREFRONT_URL}/es/legal/subencargados-plan-nube-ue`,
  },
};

/**
 * The plan sold in US dollars (English page, outside the 27 EU states): its own terms
 * (English only) and the processing agreement and sub-processor list it shares with the
 * euro plan.
 */
export const CLOUD_PLAN_LEGAL_URL = {
  terms: `${STOREFRONT_URL}/legal/cloud-plan-terms`,
  dpa: `${STOREFRONT_URL}/legal/eu-cloud-plan-dpa`,
  subprocessors: `${STOREFRONT_URL}/legal/eu-cloud-plan-subprocessors`,
} as const;

export type PricingLegalKey = "terms" | "dpa" | "subprocessors";

/** The legal links under the price row, for the currency the page shows. */
export function pricingLegalLinks(locale: LandingLocale, currency: Currency): { key: PricingLegalKey; href: string }[] {
  if (locale === "en" && currency === "USD") {
    return (["terms", "dpa", "subprocessors"] as const).map((key) => ({ key, href: CLOUD_PLAN_LEGAL_URL[key] }));
  }
  return (["terms", "subprocessors"] as const).map((key) => ({ key, href: PRICING_LEGAL_URL[locale][key] }));
}

/** The pilot's days, as the caps enforce them. */
export const PRICING_PILOT_DAYS = PILOT_DAYS;

export interface PricingCopy {
  nav: string;
  heading: string;
  /** The table's two column labels, as on the storefront home. */
  cols: [string, string];
  /** The row's left cell: what is offered. */
  offer: string;
  /** The row's right cell: what it costs, with the pilot's days, in the page's currency. */
  price: (days: number, currency: Currency) => string;
  start: string;
  subscribe: string;
  /** The small line under the price row: the legal links' labels. */
  legal: Record<PricingLegalKey, string>;
  /** The quiet line: the question, then the linked request. */
  contact: { question: string; link: string };
}

/** The plan's price in English, per currency. */
export const PLAN_PRICE_EN: Record<Currency, string> = {
  USD: "$179 a month or $1,800 a year",
  EUR: "€179 a month or €1,800 a year",
};

export const PRICING_COPY: Record<LandingLocale, PricingCopy> = {
  en: {
    nav: "Pricing",
    heading: "Pricing",
    cols: ["Product", "Price"],
    offer: "DPO Central, AI Sentinel and VendorWatch on the TODO.LAW cloud",
    price: (days, currency) => `Start free (${days}-day trial), then ${PLAN_PRICE_EN[currency]}`,
    start: "Start free",
    subscribe: "Subscribe",
    legal: { terms: "Terms", dpa: "DPA", subprocessors: "Sub-processors" },
    contact: { question: "Managed instance or your own hardware?", link: "Get a quotation." },
  },
  es: {
    nav: "Precios",
    heading: "Precios",
    cols: ["Producto", "Precio"],
    offer: "DPO Central, AI Sentinel y VendorWatch en la nube UE",
    price: (days) => `Empieza gratis (${days} días de prueba); después, 179 € al mes o 1.800 € al año`,
    start: "Empieza gratis",
    subscribe: "Contratar",
    legal: { terms: "Condiciones", dpa: "Encargo del tratamiento", subprocessors: "Subencargados" },
    contact: { question: "¿Instancia gestionada o tu propio hardware?", link: "Solicita una oferta." },
  },
};
