/**
 * Brand Configuration
 *
 * This file defines all branding-related settings that can be customized
 * for white-label deployments. All values can be overridden via environment
 * variables to support different deployments without code changes.
 *
 * Quick start: set individual NEXT_PUBLIC_* env vars to customize branding
 * for white-label deployments without code changes.
 *
 * AGPL-3.0 License - Part of the open-source core
 */

export interface BrandConfig {
  // Core identity
  name: string;
  nameUppercase: string;
  tagline: string;
  description: string;

  // Company/Provider info
  companyName: string;
  companyTrademark: string;
  companyWebsite: string;

  // Deployment
  appUrl: string;

  // Legal links
  termsOfUseUrl: string;
  privacyPolicyUrl: string;

  // Contact
  supportEmail: string;

  // Email
  emailFrom: string;

  // Assets
  logoPath: string;
  faviconPath: string;

  // Theme colors
  colors: {
    primary: string;
    primaryForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    border: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
  };
}

/**
 * Default brand configuration for DPO Central by TODO.LAW
 *
 * White-label deployments override these via NEXT_PUBLIC_* env vars.
 */
const defaultBrand: BrandConfig = {
  name: "DPO Central",
  nameUppercase: "DPO CENTRAL",
  tagline: "Privacy Management Made Simple",
  description:
    "A single source of truth for your privacy management program.",
  companyName: "TODO.LAW",
  companyTrademark: "TODO.LAW™",
  companyWebsite: "https://todo.law",
  appUrl: "https://dpocentral.todo.law",
  termsOfUseUrl: "https://todo.law/terms",
  privacyPolicyUrl: "https://todo.law/privacy",
  supportEmail: "hello@todo.law",
  emailFrom: "noreply@todo.law",
  logoPath: "/logo-icon.png",
  faviconPath: "/favicon.png",
  colors: {
    primary: "#53aecc",
    primaryForeground: "#1a1a1a",
    background: "#1a1a1a",
    foreground: "#fefeff",
    card: "#242424",
    cardForeground: "#fefeff",
    border: "#333333",
    muted: "#242424",
    mutedForeground: "#a0a0a0",
    accent: "#53aecc",
    accentForeground: "#fefeff",
  },
};

/**
 * Get brand configuration with preset + environment overrides
 *
 * Priority: env vars > defaults
 *
 * Environment variables:
 * - NEXT_PUBLIC_BRAND_NAME
 * - NEXT_PUBLIC_BRAND_NAME_UPPER
 * - NEXT_PUBLIC_BRAND_TAGLINE
 * - NEXT_PUBLIC_BRAND_DESCRIPTION
 * - NEXT_PUBLIC_COMPANY_NAME
 * - NEXT_PUBLIC_COMPANY_TRADEMARK
 * - NEXT_PUBLIC_COMPANY_WEBSITE
 * - NEXT_PUBLIC_APP_URL
 * - NEXT_PUBLIC_TERMS_URL
 * - NEXT_PUBLIC_PRIVACY_URL
 * - NEXT_PUBLIC_SUPPORT_EMAIL
 * - NEXT_PUBLIC_EMAIL_FROM
 * - NEXT_PUBLIC_LOGO_PATH
 * - NEXT_PUBLIC_FAVICON_PATH
 * - NEXT_PUBLIC_COLOR_PRIMARY
 * - NEXT_PUBLIC_COLOR_PRIMARY_FG
 * - NEXT_PUBLIC_COLOR_BACKGROUND
 * - NEXT_PUBLIC_COLOR_FOREGROUND
 * - NEXT_PUBLIC_COLOR_CARD
 * - NEXT_PUBLIC_COLOR_CARD_FG
 * - NEXT_PUBLIC_COLOR_BORDER
 * - NEXT_PUBLIC_COLOR_MUTED
 * - NEXT_PUBLIC_COLOR_MUTED_FG
 * - NEXT_PUBLIC_COLOR_ACCENT
 * - NEXT_PUBLIC_COLOR_ACCENT_FG
 */
export function getBrandConfig(): BrandConfig {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || defaultBrand.name,
    nameUppercase:
      process.env.NEXT_PUBLIC_BRAND_NAME_UPPER || defaultBrand.nameUppercase,
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || defaultBrand.tagline,
    description:
      process.env.NEXT_PUBLIC_BRAND_DESCRIPTION || defaultBrand.description,
    companyName:
      process.env.NEXT_PUBLIC_COMPANY_NAME || defaultBrand.companyName,
    companyTrademark:
      process.env.NEXT_PUBLIC_COMPANY_TRADEMARK || defaultBrand.companyTrademark,
    companyWebsite:
      process.env.NEXT_PUBLIC_COMPANY_WEBSITE || defaultBrand.companyWebsite,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || defaultBrand.appUrl,
    termsOfUseUrl:
      process.env.NEXT_PUBLIC_TERMS_URL || defaultBrand.termsOfUseUrl,
    privacyPolicyUrl:
      process.env.NEXT_PUBLIC_PRIVACY_URL || defaultBrand.privacyPolicyUrl,
    supportEmail:
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL || defaultBrand.supportEmail,
    emailFrom:
      process.env.NEXT_PUBLIC_EMAIL_FROM || defaultBrand.emailFrom,
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
      foreground:
        process.env.NEXT_PUBLIC_COLOR_FOREGROUND ||
        defaultBrand.colors.foreground,
      card: process.env.NEXT_PUBLIC_COLOR_CARD || defaultBrand.colors.card,
      cardForeground:
        process.env.NEXT_PUBLIC_COLOR_CARD_FG ||
        defaultBrand.colors.cardForeground,
      border:
        process.env.NEXT_PUBLIC_COLOR_BORDER || defaultBrand.colors.border,
      muted:
        process.env.NEXT_PUBLIC_COLOR_MUTED || defaultBrand.colors.muted,
      mutedForeground:
        process.env.NEXT_PUBLIC_COLOR_MUTED_FG ||
        defaultBrand.colors.mutedForeground,
      accent:
        process.env.NEXT_PUBLIC_COLOR_ACCENT || defaultBrand.colors.accent,
      accentForeground:
        process.env.NEXT_PUBLIC_COLOR_ACCENT_FG ||
        defaultBrand.colors.accentForeground,
    },
  };
}

/**
 * Singleton brand config instance
 * Use this for most cases to avoid repeated env reads
 */
export const brand = getBrandConfig();

/**
 * Generate email "from" field with friendly name
 */
export function emailFrom(): string {
  return `${brand.name} by ${brand.companyName} <${brand.emailFrom}>`;
}

/**
 * Generate footer text for emails
 */
export function emailFooterHtml(): string {
  return `${brand.companyTrademark} · ${brand.nameUppercase} · <a href="${brand.appUrl}" style="color: ${brand.colors.primary}; text-decoration: none;">${brand.appUrl.replace("https://", "")}</a>`;
}
