// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing section (owner, 11 Oct 2026, second version): only
 * the TODO.LAW hosted mode is priced here, in two cards (the free pilot and
 * the Cloud Plan); for a managed instance or your own hardware, one line
 * sends the visitor to the storefront's contact wizard. One currency per
 * visitor, by the landing's language: the Spanish page shows euros only,
 * the English page US dollars only. The same section, with the same copy
 * and design, is on AI Sentinel's landing.
 *
 * Prices and payment links are the approved ones (storefront
 * src/content/plan-nube-ue.ts for the euro link; the dollar link is the
 * owner's). Only yearly payment links exist, so the button subscribes
 * yearly and the monthly price is stated as text only. The pilot's editing
 * days are read from the value the service enforces
 * (src/server/services/pilot/limits.ts), so the two cannot drift.
 */

import { PILOT_DAYS } from "@/server/services/pilot/limits";
import { STOREFRONT_URL, type LandingLocale } from "./storefront";

/**
 * The languages whose landing shows the pricing link and section. Spanish
 * only for now (owner, 11 Oct 2026: the English prices are still in review).
 * To switch English on, add "en" here, or set the Vercel variable
 * NEXT_PUBLIC_PRICING_SECTION_LOCALES=es,en (comma-separated; it replaces
 * this default when set, and needs a redeploy because it is read at build).
 */
export const PRICING_SECTION_LOCALES: readonly LandingLocale[] = ["es"];

/** Whether the landing in this language shows the pricing link and section. */
export function pricingShownFor(
  locale: LandingLocale,
  env: string | undefined = process.env.NEXT_PUBLIC_PRICING_SECTION_LOCALES,
): boolean {
  const locales =
    env && env.trim()
      ? env.split(",").map((l) => l.trim().toLowerCase())
      : (PRICING_SECTION_LOCALES as readonly string[]);
  return locales.includes(locale);
}

/** The section's anchor, per language; the other language's anchor also lands on it. */
export const PRICING_ANCHOR: Record<LandingLocale, string> = { en: "pricing", es: "precios" };

/** The yearly payment link, per currency (one currency per language). */
export const PLAN_PAYMENT_LINK: Record<LandingLocale, string> = {
  en: "https://buy.stripe.com/aFa9AU73h3UV26v7ur4sE05",
  es: "https://buy.stripe.com/fZubJ273hbnnbH56qn4sE04",
};

/** The storefront's pages the section links to, per language. */
export const PRICING_LINKS: Record<LandingLocale, { terms: string; subprocessors: string; contact: string }> = {
  en: {
    terms: `${STOREFRONT_URL}/legal/eu-cloud-plan-terms`,
    subprocessors: `${STOREFRONT_URL}/legal/eu-cloud-plan-subprocessors`,
    contact: `${STOREFRONT_URL}/contact/managed`,
  },
  es: {
    terms: `${STOREFRONT_URL}/es/legal/condiciones-plan-nube-ue`,
    subprocessors: `${STOREFRONT_URL}/es/legal/subencargados-plan-nube-ue`,
    contact: `${STOREFRONT_URL}/es/contact/managed`,
  },
};

/** The pilot's editing days, as the caps enforce them. */
export const PRICING_PILOT_DAYS = PILOT_DAYS;

export interface PricingCopy {
  nav: string;
  heading: string;
  lead: string;
  pilot: {
    title: string;
    price: string;
    window: (days: number) => string;
    after: string;
    cta: string;
  };
  plan: {
    title: string;
    /** The full price line; shown as the amount (large) and the period (smaller). */
    price: string;
    amount: string;
    period: string;
    monthly: string;
    items: [string, string, string];
    cta: string;
    /** The small line under the button: the tax note, then "terms and sub-processors" as two links. */
    note: { tax: string; terms: string; and: string; subprocessors: string; end: string };
  };
  contact: { question: string; link: string };
}

export const PRICING_COPY: Record<LandingLocale, PricingCopy> = {
  en: {
    nav: "Pricing",
    heading: "Pricing",
    lead: "Start free. When you need it, move to the paid plan with all your records.",
    pilot: {
      title: "Free pilot",
      price: "Free",
      window: (days) => `${days} days of editing`,
      after: "Then read-only with export",
      cta: "Start free",
    },
    plan: {
      title: "Cloud Plan",
      price: "$1,800 a year",
      amount: "$1,800",
      period: "a year",
      monthly: "or $179 a month",
      items: [
        "DPO Central, AI Sentinel and VendorWatch",
        "No limits on users or records",
        "Data stored in the EU (Frankfurt)",
      ],
      cta: "Subscribe",
      note: { tax: "No VAT charged.", terms: "Terms", and: "and", subprocessors: "sub-processors", end: "." },
    },
    contact: { question: "Managed instance or your own hardware?", link: "Contact us" },
  },
  es: {
    nav: "Precios",
    heading: "Precios",
    lead: "Empieza gratis. Cuando lo necesites, pasa al plan de pago con todos tus registros.",
    pilot: {
      title: "Piloto gratuito",
      price: "Gratis",
      window: (days) => `${days} días de edición`,
      after: "Después, solo lectura con exportación",
      cta: "Empieza gratis",
    },
    plan: {
      title: "Plan nube UE",
      price: "1.800 € al año",
      amount: "1.800 €",
      period: "al año",
      monthly: "o 179 € al mes",
      items: [
        "DPO Central, AI Sentinel y VendorWatch",
        "Sin límite de usuarios ni de registros",
        "Datos en la UE (Fráncfort)",
      ],
      cta: "Contratar",
      note: {
        tax: "Sin IVA español (inversión del sujeto pasivo para empresas de la UE).",
        terms: "Condiciones",
        and: "y",
        subprocessors: "subencargados",
        end: ".",
      },
    },
    contact: { question: "¿Instancia gestionada o tu propio hardware?", link: "Escríbenos" },
  },
};
