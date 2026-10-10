// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The landing's page title and description, in both languages.
 *
 * The root layout writes the title from the request's locale (the `locale`
 * cookie, then Accept-Language), so `?lang=es` without the cookie used to
 * show the English title over a Spanish page. The landing (src/app/page.tsx)
 * now picks the language the way the landing does in the browser: `?lang=`
 * first, then the cookie (last `locale` value wins). The landing also sets
 * document.title when the visitor toggles the language.
 *
 * English keeps the title and description the layout has always written.
 */

import type { Locale } from "@/i18n/config";
import { brand } from "@/config/brand";

export const LANDING_SEO: Record<Locale, { title: string; description: string }> = {
  en: {
    title: `${brand.nameUppercase} - Privacy Management Made Simple`,
    description:
      "Data inventory, DSAR management, assessments, incident tracking, and vendor management for GDPR programs, in one platform.",
  },
  es: {
    title: `${brand.nameUppercase}: gestión de la privacidad y la protección de datos, sin hojas de cálculo`,
    description:
      "Inventario de datos, ejercicio de derechos, evaluaciones, seguimiento de incidentes y gestión de proveedores para programas del RGPD, en una sola plataforma.",
  },
};

/** The language the landing shows: `?lang=` first, then the cookie's choice, else English. */
export function landingLocale(lang: string | string[] | undefined, cookieLocale: Locale | null): Locale {
  const v = Array.isArray(lang) ? lang[0] : lang;
  if (v === "es" || v === "en") return v;
  return cookieLocale ?? "en";
}
