// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Search and link-preview settings. The application is a signed-in tool: its
 * screens are kept out of search results; the public pages (the rights
 * request form, the licence page) follow the rules below.
 */

import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { brand } from "@/config/brand";

/** Open Graph locale codes. */
export const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_ES" };

/** Robots directive for screens that are not public content (sign-in, the app, previews). */
export const NOINDEX = { index: false, follow: false } as const;

/** Kept out of search results, while its links are still followed. */
export const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/**
 * The Search Console verification meta tag, only when
 * NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is set (nothing is rendered otherwise).
 */
export function siteVerification(): { google: string } | undefined {
  const token = (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "").trim();
  return token ? { google: token } : undefined;
}

/**
 * A public page's canonical address and hreflang pair, for the pages whose
 * language follows `?lang=` (src/i18n/locale-cookie.ts, langParamLocale):
 * English at the plain path, Spanish with `?lang=es`.
 */
export function pageAlternates(
  path: string,
  locale: Locale,
): { canonical: string; languages: Record<"en" | "es" | "x-default", string> } {
  const es = `${path}?lang=es`;
  return {
    canonical: locale === "es" ? es : path,
    languages: { en: path, es, "x-default": path },
  };
}

/** The metadata of a public page served in both languages. */
export function publicPageMetadata(
  path: string,
  locale: Locale,
  m: { title: string; description: string },
): Metadata {
  const alternates = pageAlternates(path, locale);
  return {
    title: m.title,
    description: m.description,
    alternates,
    openGraph: {
      type: "website",
      siteName: brand.nameUppercase,
      title: m.title,
      description: m.description,
      url: alternates.canonical,
      locale: OG_LOCALE[locale],
    },
  };
}

/** The request's language as one of the two the public pages serve. */
export function asLocale(value: string | null | undefined): Locale {
  return value === "es" ? "es" : "en";
}

/** A link to another public page in the language shown. */
export function localizedHref(path: string, locale: Locale): string {
  return locale === "es" ? `${path}?lang=es` : path;
}
