// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's pricing section (owner, 11 Oct 2026): what the free pilot
 * allows, what the Cloud Plan costs and includes, and that a managed
 * instance or your own hardware is quoted. One currency per visitor, by the
 * landing's language: the Spanish page shows euros only, the English page US
 * dollars only (the rule Dealroom already uses). The same section, with the
 * same labels and in the same place, is on AI Sentinel's landing.
 *
 * Prices and payment links are the approved ones (storefront
 * src/content/plan-nube-ue.ts for the euro link; the dollar link is the
 * owner's). Only yearly payment links exist, so the button subscribes
 * yearly and the monthly price is stated as text only. The pilot's limits
 * are not written here: they are read from the values the service enforces
 * (src/server/services/pilot/limits.ts), so the two cannot drift.
 */

import { isDsarModuleEnabled } from "@/config/features";
import {
  PILOT_DAYS,
  PILOT_DPIA_LIMIT,
  PILOT_LIMITS,
  RESOURCE_LABELS,
  type PilotResource,
} from "@/server/services/pilot/limits";
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
export const PRICING_LINKS: Record<
  LandingLocale,
  { terms: string; subprocessors: string; managed: string; deployment: string }
> = {
  en: {
    terms: `${STOREFRONT_URL}/legal/eu-cloud-plan-terms`,
    subprocessors: `${STOREFRONT_URL}/legal/eu-cloud-plan-subprocessors`,
    managed: `${STOREFRONT_URL}/contact/managed`,
    deployment: `${STOREFRONT_URL}/contact/deployment`,
  },
  es: {
    terms: `${STOREFRONT_URL}/es/legal/condiciones-plan-nube-ue`,
    subprocessors: `${STOREFRONT_URL}/es/legal/subencargados-plan-nube-ue`,
    managed: `${STOREFRONT_URL}/es/contact/managed`,
    deployment: `${STOREFRONT_URL}/es/contact/deployment`,
  },
};

/** The pilot's limits as the page shows them. */
export interface PilotFacts {
  days: number;
  /** DPIAs free for a limited time, per organisation. */
  dpias: number;
  limits: { key: string; limit: number; label: Record<LandingLocale, string> }[];
}

/**
 * The pilot's limits, from the values the caps enforce: the same list as the
 * docs' hosted-pilot section (rights requests left out while that module is off).
 */
export function pilotFacts(): PilotFacts {
  const dsarOn = isDsarModuleEnabled();
  return {
    days: PILOT_DAYS,
    dpias: PILOT_DPIA_LIMIT,
    limits: (Object.keys(PILOT_LIMITS) as PilotResource[])
      .filter((resource) => dsarOn || resource !== "dsarRequests")
      .map((resource) => ({ key: resource, limit: PILOT_LIMITS[resource], label: RESOURCE_LABELS[resource] })),
  };
}

export interface PricingCopy {
  nav: string;
  label: string;
  heading: string;
  sub: string;
  pilot: {
    title: string;
    price: string;
    lead: string;
    window: (days: number) => string;
    oneOrg: string;
    dpias: (n: number) => string;
    modules: string;
    testData: string;
    limitsTitle: string;
    limitsIntro: string;
    cta: string;
  };
  plan: {
    badge: string;
    title: string;
    price: string;
    monthly: string;
    per: string;
    included: string;
    items: string[];
    addon: string;
    cta: string;
  };
  quote: {
    title: string;
    price: string;
    managed: { title: string; desc: string };
    own: { title: string; desc: string };
    cta: string;
  };
  how: { title: string; text: string };
  vat: { title: string; text: string };
  legal: { intro: string; terms: string; subprocessors: string };
}

export const PRICING_COPY: Record<LandingLocale, PricingCopy> = {
  en: {
    nav: "Pricing",
    label: "Pricing",
    heading: "Prices and how the cloud works",
    sub: "Start with the free pilot. For real data, move to the Cloud Plan, a managed instance or your own hardware. Prices are in US dollars.",
    pilot: {
      title: "Free pilot",
      price: "Free",
      lead: "To try the product with test records.",
      window: (days) => `${days} days of editing from your organization's first sign-in, then read-only with export`,
      oneOrg: "One organization per account",
      dpias: (n) => `${n} DPIAs free for a limited time`,
      modules: "Every module open",
      testData: "Use test records, not real personal data",
      limitsTitle: "Record limits",
      limitsIntro: "An organization can hold up to:",
      cta: "Try it free",
    },
    plan: {
      badge: "For real data",
      title: "Cloud Plan",
      price: "$1,800 a year",
      monthly: "or $179 a month",
      per: "per organization",
      included: "What is included",
      items: [
        "DPO Central, AI Sentinel and VendorWatch (Monitor plan)",
        "Unlimited users",
        "Your data stored in EU data centers (Frankfurt)",
        "No editing window and no record limits",
        "AI off by default; your administrator turns it on",
        "Export your whole program at any time",
        "For businesses and professionals only",
      ],
      addon: "Rights-request module: $49 a month, when available.",
      cta: "Subscribe yearly",
    },
    quote: {
      title: "Managed instance or your own hardware",
      price: "On quotation",
      managed: {
        title: "Managed instance",
        desc: "An isolated instance we run for you, with a tailored service level.",
      },
      own: {
        title: "Your own hardware",
        desc: "The TODO.LAW suite on a machine in your organization.",
      },
      cta: "See prices and documentation",
    },
    how: {
      title: "How you pay and what happens to your records",
      text: "You pay in advance, by card, through our payment processor. Your organization and its records carry over when you subscribe. After payment, we activate the paid plan on your organization and the pilot limits stop applying. The plan renews automatically until you cancel; cancelling takes effect at the end of the period already paid.",
    },
    vat: {
      title: "VAT",
      text: "The seller, Rindogatan LLC, is established in the United States and does not charge you Spanish VAT: the price shown is the total amount we charge. If you are a business or professional established in the European Union, you account for any VAT due under the reverse-charge rules of your own country.",
    },
    legal: {
      intro: "Before you subscribe:",
      terms: "Cloud Plan terms",
      subprocessors: "Sub-processors",
    },
  },
  es: {
    nav: "Precios",
    label: "Precios",
    heading: "Precios y cómo funciona la nube",
    sub: "Empieza con el piloto gratuito. Para datos reales, pasa al Plan nube UE, a una instancia gestionada o a tu propio hardware. Los precios se muestran en euros.",
    pilot: {
      title: "Piloto gratuito",
      price: "Gratis",
      lead: "Para probar el producto con registros de prueba.",
      window: (days) =>
        `${days} días de edición desde el primer inicio de sesión de tu organización y, después, solo lectura con exportación`,
      oneOrg: "Una organización por cuenta",
      dpias: (n) => `${n} EIPD gratuitas por tiempo limitado`,
      modules: "Todos los módulos abiertos",
      testData: "Usa registros de prueba, no datos personales reales",
      limitsTitle: "Límites de registros",
      limitsIntro: "Una organización puede tener como máximo:",
      cta: "Pruébalo gratis",
    },
    plan: {
      badge: "Para datos reales",
      title: "Plan nube UE",
      price: "1.800 € al año",
      monthly: "o 179 € al mes",
      per: "por organización",
      included: "Qué incluye",
      items: [
        "DPO Central, AI Sentinel y VendorWatch (plan Monitor)",
        "Sin límite de personas usuarias",
        "Tus datos, guardados en centros de datos de la UE (Fráncfort)",
        "Sin plazo de edición ni tope de registros",
        "La IA está desactivada por defecto y solo la activa la persona administradora",
        "Exporta todo tu programa cuando quieras",
        "Solo para empresas y profesionales",
      ],
      addon: "Módulo de solicitudes de derechos: 49 € al mes, cuando esté disponible.",
      cta: "Contratar el plan anual",
    },
    quote: {
      title: "Instancia gestionada o tu propio hardware",
      price: "Bajo presupuesto",
      managed: {
        title: "Instancia gestionada",
        desc: "Una instancia aislada que operamos para ti, con un nivel de servicio a medida.",
      },
      own: {
        title: "Tu propio hardware",
        desc: "La suite de TODO.LAW en un equipo de tu organización.",
      },
      cta: "Ver precios y documentación",
    },
    how: {
      title: "Cómo pagas y qué pasa con tus registros",
      text: "Pagas por adelantado, con tarjeta, a través de nuestro procesador de pagos. Tu organización y sus registros se mantienen al contratar. Tras el pago, activamos el plan de pago en tu organización y dejan de aplicarse los límites del piloto. El plan se renueva automáticamente hasta que te des de baja; la baja surte efecto al final del periodo ya pagado.",
    },
    vat: {
      title: "IVA",
      text: "Rindogatan LLC, que vende el plan, está establecida en Estados Unidos y no te cobra el IVA español: el precio que ves es el importe total que te cobramos. Si eres una empresa o un profesional establecido en la Unión Europea, liquidas el IVA que, en su caso, corresponda conforme a las reglas de inversión del sujeto pasivo de tu propio país.",
    },
    legal: {
      intro: "Antes de contratar:",
      terms: "Condiciones del Plan nube UE",
      subprocessors: "Subencargados",
    },
  },
};
