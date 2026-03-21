/**
 * Server-side i18n request configuration for next-intl
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isValidLocale, type Locale } from "./config";

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

  // 3. Final fallback to default
  if (!locale || !isValidLocale(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
