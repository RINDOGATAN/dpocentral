// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled in the application. NEXT_PUBLIC_*
 * values are baked into the build: changing one takes a rebuild.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export interface FeatureFlags {
  // Authentication
  googleAuthEnabled: boolean;
  emailAuthEnabled: boolean;
  devAuthEnabled: boolean;

  // Rights-request (DSAR) module: dashboard pages, public request form and
  // status pages, reminders, reports. On by default on every build.
  dsarEnabled: boolean;

  // Internationalization
  i18nEnabled: boolean;
  availableLocales: string[];
  defaultLocale: string;
}

/**
 * Default feature flags
 */
const defaultFeatures: FeatureFlags = {
  // Auth methods
  googleAuthEnabled: true,
  emailAuthEnabled: true,
  // Local credentials login (email only, no password). Always on in dev;
  // self-hosted deployments enable it in production builds via
  // NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true (behind the firm's own network).
  devAuthEnabled:
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED === "true",

  dsarEnabled: true,

  // Internationalization: the language switch is shown.
  i18nEnabled: true,
  availableLocales: ["en", "es"],
  defaultLocale: "en",
};

/**
 * Get feature flags with environment overrides
 *
 * Environment variables:
 * - NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
 * - NEXT_PUBLIC_EMAIL_AUTH_ENABLED
 * - NEXT_PUBLIC_LOCAL_AUTH_ENABLED
 * - NEXT_PUBLIC_I18N_ENABLED
 * - NEXT_PUBLIC_AVAILABLE_LOCALES (comma-separated)
 * - NEXT_PUBLIC_DEFAULT_LOCALE
 * - NEXT_PUBLIC_DSAR_ENABLED (=false turns the rights-request module off)
 */
export function getFeatureFlags(): FeatureFlags {
  const envLocales = process.env.NEXT_PUBLIC_AVAILABLE_LOCALES;

  return {
    googleAuthEnabled:
      process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "false" &&
      defaultFeatures.googleAuthEnabled,
    emailAuthEnabled:
      process.env.NEXT_PUBLIC_EMAIL_AUTH_ENABLED !== "false" &&
      defaultFeatures.emailAuthEnabled,
    devAuthEnabled: defaultFeatures.devAuthEnabled,
    dsarEnabled: isDsarModuleEnabled(),
    i18nEnabled:
      process.env.NEXT_PUBLIC_I18N_ENABLED === "true" ||
      defaultFeatures.i18nEnabled,
    availableLocales: envLocales
      ? envLocales.split(",").map((l) => l.trim())
      : defaultFeatures.availableLocales,
    defaultLocale:
      process.env.NEXT_PUBLIC_DEFAULT_LOCALE || defaultFeatures.defaultLocale,
  };
}

/**
 * Whether the rights-request (DSAR) module is part of this deployment.
 *
 * On unless NEXT_PUBLIC_DSAR_ENABLED is exactly "false". When off, the
 * module's menu entry, dashboard pages, documentation and report sections
 * are hidden; the public request form and status pages answer 404; the
 * module's API refuses every call; new organisations get no public form; the
 * deadline-reminder cron does nothing. The records an organisation already
 * holds are not touched (the rights-request export stays available to its
 * owners and admins).
 *
 * Read at call time so server code and tests see the current environment.
 */
export function isDsarModuleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DSAR_ENABLED !== "false" && defaultFeatures.dsarEnabled;
}

/** The note shown where the rights-request module would have been. */
export const DSAR_MODULE_OFF_MESSAGE = "Rights requests are switched off in this installation.";

/**
 * Singleton feature flags instance
 */
export const features = getFeatureFlags();
