/**
 * Server-side i18n request configuration for next-intl
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, isValidLocale, locales, type Locale } from "./config";

function pickFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const base = tag.split("-")[0];
    if (base && (locales as readonly string[]).includes(base)) {
      return base as Locale;
    }
  }
  return null;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. Try the locale from middleware/[locale] segment
  let locale = await requestLocale;

  // 2. Fall back to cookie-based locale (set by LanguageSwitcher)
  if (!locale || !isValidLocale(locale)) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    if (cookieLocale && isValidLocale(cookieLocale)) {
      locale = cookieLocale;
    }
  }

  // 3. Detect from browser's Accept-Language header (public visitors with no cookie)
  if (!locale || !isValidLocale(locale)) {
    const headerStore = await headers();
    const detected = pickFromAcceptLanguage(headerStore.get("accept-language"));
    if (detected) locale = detected;
  }

  // 4. Final fallback to default
  if (!locale || !isValidLocale(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
