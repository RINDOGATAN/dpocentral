/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled in the application.
 * These can be used to disable features for specific deployments
 * or to gradually roll out new functionality.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export interface FeatureFlags {
  // Payment & Licensing
  stripeEnabled: boolean;
  selfServiceUpgrade: boolean;

  // Authentication
  googleAuthEnabled: boolean;
  emailAuthEnabled: boolean;
  devAuthEnabled: boolean;

  // Premium Features
  vendorCatalogEnabled: boolean;
  dpiaEnabled: boolean;
  piaEnabled: boolean;
  tiaEnabled: boolean;
  vendorAssessmentEnabled: boolean;

  // Expert Directory
  expertDirectoryEnabled: boolean;

  // New Features
  notificationsEnabled: boolean;
  complianceDashboardEnabled: boolean;
  dpiaAutoFillEnabled: boolean;
  transferComplianceEnabled: boolean;
  regulatoryTrackerEnabled: boolean;
  aiGovernanceEnabled: boolean;
  aiSentinelIntegrationEnabled: boolean;

  // Internationalization
  i18nEnabled: boolean;
  availableLocales: string[];
  defaultLocale: string;
}

/**
 * Default feature flags
 */
const defaultFeatures: FeatureFlags = {
  // Payment disabled by default (enabled via env for forks with Stripe)
  stripeEnabled: false,
  selfServiceUpgrade: false,

  // Auth methods
  googleAuthEnabled: true,
  emailAuthEnabled: true,
  devAuthEnabled: process.env.NODE_ENV === "development",

  // Premium features (require entitlements when enabled)
  vendorCatalogEnabled: true,
  dpiaEnabled: true,
  piaEnabled: true,
  tiaEnabled: true,
  vendorAssessmentEnabled: true,

  // Expert Directory
  expertDirectoryEnabled: true,

  // New Features
  notificationsEnabled: true,
  complianceDashboardEnabled: true,
  dpiaAutoFillEnabled: true,
  transferComplianceEnabled: true,
  regulatoryTrackerEnabled: true,
  aiGovernanceEnabled: true,
  aiSentinelIntegrationEnabled: true,

  // i18n
  i18nEnabled: true,
  availableLocales: ["en", "es"],
  defaultLocale: "en",
};

/**
 * Get feature flags with environment overrides
 *
 * Environment variables:
 * - NEXT_PUBLIC_STRIPE_ENABLED
 * - NEXT_PUBLIC_SELF_SERVICE_UPGRADE
 * - NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
 * - NEXT_PUBLIC_EMAIL_AUTH_ENABLED
 * - NEXT_PUBLIC_I18N_ENABLED
 * - NEXT_PUBLIC_AVAILABLE_LOCALES (comma-separated)
 * - NEXT_PUBLIC_DEFAULT_LOCALE
 */
export function getFeatureFlags(): FeatureFlags {
  const envLocales = process.env.NEXT_PUBLIC_AVAILABLE_LOCALES;

  return {
    stripeEnabled:
      process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" ||
      defaultFeatures.stripeEnabled,
    selfServiceUpgrade:
      process.env.NEXT_PUBLIC_SELF_SERVICE_UPGRADE === "true" ||
      defaultFeatures.selfServiceUpgrade,
    googleAuthEnabled:
      process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "false" &&
      defaultFeatures.googleAuthEnabled,
    emailAuthEnabled:
      process.env.NEXT_PUBLIC_EMAIL_AUTH_ENABLED !== "false" &&
      defaultFeatures.emailAuthEnabled,
    devAuthEnabled: defaultFeatures.devAuthEnabled,
    vendorCatalogEnabled: defaultFeatures.vendorCatalogEnabled,
    dpiaEnabled: defaultFeatures.dpiaEnabled,
    piaEnabled: defaultFeatures.piaEnabled,
    tiaEnabled: defaultFeatures.tiaEnabled,
    vendorAssessmentEnabled: defaultFeatures.vendorAssessmentEnabled,
    expertDirectoryEnabled:
      process.env.NEXT_PUBLIC_EXPERT_DIRECTORY_ENABLED !== "false" &&
      defaultFeatures.expertDirectoryEnabled,
    notificationsEnabled:
      process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED !== "false" &&
      defaultFeatures.notificationsEnabled,
    complianceDashboardEnabled:
      process.env.NEXT_PUBLIC_COMPLIANCE_DASHBOARD_ENABLED !== "false" &&
      defaultFeatures.complianceDashboardEnabled,
    dpiaAutoFillEnabled:
      process.env.NEXT_PUBLIC_DPIA_AUTO_FILL_ENABLED !== "false" &&
      defaultFeatures.dpiaAutoFillEnabled,
    transferComplianceEnabled:
      process.env.NEXT_PUBLIC_TRANSFER_COMPLIANCE_ENABLED !== "false" &&
      defaultFeatures.transferComplianceEnabled,
    regulatoryTrackerEnabled:
      process.env.NEXT_PUBLIC_REGULATORY_TRACKER_ENABLED !== "false" &&
      defaultFeatures.regulatoryTrackerEnabled,
    aiGovernanceEnabled:
      process.env.NEXT_PUBLIC_AI_GOVERNANCE_ENABLED !== "false" &&
      defaultFeatures.aiGovernanceEnabled,
    aiSentinelIntegrationEnabled:
      process.env.NEXT_PUBLIC_AI_SENTINEL_ENABLED !== "false" &&
      defaultFeatures.aiSentinelIntegrationEnabled,
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
 * Singleton feature flags instance
 */
export const features = getFeatureFlags();

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof Omit<FeatureFlags, "availableLocales" | "defaultLocale">
): boolean {
  return features[feature] as boolean;
}
