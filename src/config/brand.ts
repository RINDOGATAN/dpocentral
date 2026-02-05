/**
 * Brand Configuration
 *
 * This file defines all branding-related settings that can be customized
 * for white-label deployments. All values can be overridden via environment
 * variables to support different deployments without code changes.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export interface BrandConfig {
  // Core identity
  name: string;
  tagline: string;
  description: string;

  // Company/Provider info
  companyName: string;
  companyWebsite: string;

  // Legal links
  termsOfUseUrl: string;
  privacyPolicyUrl: string;

  // Contact
  supportEmail: string;

  // Assets
  logoPath: string;
  faviconPath: string;

  // Theme colors (CSS custom property values)
  colors: {
    primary: string;
    primaryForeground: string;
    background: string;
    card: string;
    accent: string;
  };
}

/**
 * Default brand configuration for DPO Central
 */
const defaultBrand: BrandConfig = {
  name: "DPO Central",
  tagline: "Privacy Management Made Simple",
  description:
    "A single source of truth for your privacy management program.",
  companyName: "North End Law",
  companyWebsite: "https://northend.law",
  termsOfUseUrl: "https://northend.law/terms-of-use",
  privacyPolicyUrl: "https://northend.law/privacy-policy",
  supportEmail: "hello@northend.law",
  logoPath: "/nel-icon.png",
  faviconPath: "/logos/favicon.png",
  colors: {
    primary: "#13e9d1",
    primaryForeground: "#1c1f37",
    background: "#1c1f37",
    card: "#232742",
    accent: "#13e9d1",
  },
};

/**
 * Get brand configuration with environment overrides
 *
 * Environment variables:
 * - NEXT_PUBLIC_BRAND_NAME
 * - NEXT_PUBLIC_BRAND_TAGLINE
 * - NEXT_PUBLIC_BRAND_DESCRIPTION
 * - NEXT_PUBLIC_COMPANY_NAME
 * - NEXT_PUBLIC_COMPANY_WEBSITE
 * - NEXT_PUBLIC_TERMS_URL
 * - NEXT_PUBLIC_PRIVACY_URL
 * - NEXT_PUBLIC_SUPPORT_EMAIL
 * - NEXT_PUBLIC_LOGO_PATH
 * - NEXT_PUBLIC_FAVICON_PATH
 * - NEXT_PUBLIC_COLOR_PRIMARY
 * - NEXT_PUBLIC_COLOR_PRIMARY_FG
 * - NEXT_PUBLIC_COLOR_BACKGROUND
 * - NEXT_PUBLIC_COLOR_CARD
 * - NEXT_PUBLIC_COLOR_ACCENT
 */
export function getBrandConfig(): BrandConfig {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || defaultBrand.name,
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || defaultBrand.tagline,
    description:
      process.env.NEXT_PUBLIC_BRAND_DESCRIPTION || defaultBrand.description,
    companyName:
      process.env.NEXT_PUBLIC_COMPANY_NAME || defaultBrand.companyName,
    companyWebsite:
      process.env.NEXT_PUBLIC_COMPANY_WEBSITE || defaultBrand.companyWebsite,
    termsOfUseUrl:
      process.env.NEXT_PUBLIC_TERMS_URL || defaultBrand.termsOfUseUrl,
    privacyPolicyUrl:
      process.env.NEXT_PUBLIC_PRIVACY_URL || defaultBrand.privacyPolicyUrl,
    supportEmail:
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL || defaultBrand.supportEmail,
    logoPath: process.env.NEXT_PUBLIC_LOGO_PATH || defaultBrand.logoPath,
    faviconPath:
      process.env.NEXT_PUBLIC_FAVICON_PATH || defaultBrand.faviconPath,
    colors: {
      primary:
        process.env.NEXT_PUBLIC_COLOR_PRIMARY || defaultBrand.colors.primary,
      primaryForeground:
        process.env.NEXT_PUBLIC_COLOR_PRIMARY_FG ||
        defaultBrand.colors.primaryForeground,
      background:
        process.env.NEXT_PUBLIC_COLOR_BACKGROUND ||
        defaultBrand.colors.background,
      card: process.env.NEXT_PUBLIC_COLOR_CARD || defaultBrand.colors.card,
      accent:
        process.env.NEXT_PUBLIC_COLOR_ACCENT || defaultBrand.colors.accent,
    },
  };
}

/**
 * Singleton brand config instance
 * Use this for most cases to avoid repeated env reads
 */
export const brand = getBrandConfig();
