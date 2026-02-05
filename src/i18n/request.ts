/**
 * Server-side i18n request configuration for next-intl
 *
 * AGPL-3.0 License - Part of the open-source core
 */

import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isValidLocale, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically comes from the [locale] segment
  let locale = await requestLocale;

  // Ensure locale is valid, fallback to default
  if (!locale || !isValidLocale(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
