/**
 * Brand Configuration
 *
 * This file defines all branding-related settings that can be customized
 * for white-label deployments. All values can be overridden via environment
 * variables to support different deployments without code changes.
 *
 * Quick start: set NEXT_PUBLIC_BRAND=nel to switch to North End Law branding.
 * Or set individual NEXT_PUBLIC_* vars to customize further.
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
 * Brand presets — selectable via NEXT_PUBLIC_BRAND env var
 */
const presets: Record<string, BrandConfig> = {
  todolaw: {
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
    logoPath: "/nel-icon.png",
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
  },
  nel: {
    name: "DPO Central",
    nameUppercase: "DPO CENTRAL",
    tagline: "Privacy Program Management",
    description:
      "A single source of truth for your privacy management program.",
    companyName: "North End Law",
    companyTrademark: "North End Law",
    companyWebsite: "https://northend.law",
    appUrl: "https://privacysuite-ten.vercel.app",
    termsOfUseUrl: "https://northend.law/terms-of-use",
    privacyPolicyUrl: "https://northend.law/privacy-policy",
    supportEmail: "hello@northend.law",
    emailFrom: "noreply@northend.law",
    logoPath: "/nel-icon.png",
    faviconPath: "/favicon.png",
    colors: {
      primary: "#13e9d1",
      primaryForeground: "#1c1f37",
      background: "#1c1f37",
      foreground: "#e5e5e5",
      card: "#232742",
      cardForeground: "#e5e5e5",
      border: "#2d3154",
      muted: "#232742",
      mutedForeground: "#a0a0a0",
      accent: "#13e9d1",
      accentForeground: "#1c1f37",
    },
  },
};

/**
 * Get brand configuration with preset + environment overrides
 *
 * Priority: individual env vars > preset > todolaw default
 *
 * Environment variables:
 * - NEXT_PUBLIC_BRAND             — preset name ("todolaw" | "nel")
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
  const presetKey = process.env.NEXT_PUBLIC_BRAND || "todolaw";
  const base = presets[presetKey] || presets.todolaw;

  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || base.name,
    nameUppercase:
      process.env.NEXT_PUBLIC_BRAND_NAME_UPPER || base.nameUppercase,
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || base.tagline,
    description:
      process.env.NEXT_PUBLIC_BRAND_DESCRIPTION || base.description,
    companyName:
      process.env.NEXT_PUBLIC_COMPANY_NAME || base.companyName,
    companyTrademark:
      process.env.NEXT_PUBLIC_COMPANY_TRADEMARK || base.companyTrademark,
    companyWebsite:
      process.env.NEXT_PUBLIC_COMPANY_WEBSITE || base.companyWebsite,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || base.appUrl,
    termsOfUseUrl:
      process.env.NEXT_PUBLIC_TERMS_URL || base.termsOfUseUrl,
    privacyPolicyUrl:
      process.env.NEXT_PUBLIC_PRIVACY_URL || base.privacyPolicyUrl,
    supportEmail:
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL || base.supportEmail,
    emailFrom:
      process.env.NEXT_PUBLIC_EMAIL_FROM || base.emailFrom,
    logoPath: process.env.NEXT_PUBLIC_LOGO_PATH || base.logoPath,
    faviconPath:
      process.env.NEXT_PUBLIC_FAVICON_PATH || base.faviconPath,
    colors: {
      primary:
        process.env.NEXT_PUBLIC_COLOR_PRIMARY || base.colors.primary,
      primaryForeground:
        process.env.NEXT_PUBLIC_COLOR_PRIMARY_FG ||
        base.colors.primaryForeground,
      background:
        process.env.NEXT_PUBLIC_COLOR_BACKGROUND ||
        base.colors.background,
      foreground:
        process.env.NEXT_PUBLIC_COLOR_FOREGROUND ||
        base.colors.foreground,
      card: process.env.NEXT_PUBLIC_COLOR_CARD || base.colors.card,
      cardForeground:
        process.env.NEXT_PUBLIC_COLOR_CARD_FG ||
        base.colors.cardForeground,
      border:
        process.env.NEXT_PUBLIC_COLOR_BORDER || base.colors.border,
      muted:
        process.env.NEXT_PUBLIC_COLOR_MUTED || base.colors.muted,
      mutedForeground:
        process.env.NEXT_PUBLIC_COLOR_MUTED_FG ||
        base.colors.mutedForeground,
      accent:
        process.env.NEXT_PUBLIC_COLOR_ACCENT || base.colors.accent,
      accentForeground:
        process.env.NEXT_PUBLIC_COLOR_ACCENT_FG ||
        base.colors.accentForeground,
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
