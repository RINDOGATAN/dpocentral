/**
 * Internationalization Configuration
 *
 * Defines available locales and the default locale.
 * These can be overridden via environment variables.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
