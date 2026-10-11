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

/**
 * Whether the browser prefers Spanish to English: the first of the two in the
 * Accept-Language list, by quality (es-ES, es-419 and plain es all count).
 */
export function prefersSpanish(acceptLanguage: string | null | undefined): boolean {
  if (!acceptLanguage) return false;
  const ranked = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { base: tag.split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((x) => (x.base === "es" || x.base === "en") && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked[0]?.base === "es";
}

/**
 * The language the landing shows, decided on the server so the first paint is
 * already in it (owner, 10 Oct 2026: a Spanish browser with no cookie saw English):
 * `?lang=` first, then the cookie's choice, then the browser's Accept-Language,
 * else English. The same rule as AI Sentinel's landing.
 */
export function landingLocale(
  lang: string | string[] | undefined,
  cookieLocale: Locale | null,
  acceptLanguage?: string | null,
): Locale {
  const v = Array.isArray(lang) ? lang[0] : lang;
  if (v === "es" || v === "en") return v;
  if (cookieLocale) return cookieLocale;
  return prefersSpanish(acceptLanguage) ? "es" : "en";
}
