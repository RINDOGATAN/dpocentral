/**
 * Design tokens for the rebuilt PDF reports (Privacy Program, ROPA, Vendor Register).
 * Single source of truth for color, typography, spacing, radii, page geometry.
 *
 * Legacy reports (Assessment, Assessment Portfolio, DSAR Performance, Regulatory
 * Landscape, Breach Register) still consume pdf-styles.tsx and are unaffected.
 */

export const tokens = {
  color: {
    brand: {
      navy:       "#0e4a6e",
      navyDeep:   "#083249",
      navyInk:    "#0b1f2a",
      tealAccent: "#53aecc",
    },
    semantic: {
      success: { bg: "#ecfdf5", fg: "#065f46", solid: "#059669" },
      warning: { bg: "#fffbeb", fg: "#92400e", solid: "#d97706" },
      danger:  { bg: "#fef2f2", fg: "#991b1b", solid: "#dc2626" },
      info:    { bg: "#eff6ff", fg: "#1e3a8a", solid: "#2563eb" },
      neutral: { bg: "#f8fafc", fg: "#475569", solid: "#64748b" },
    },
    surface: {
      page:      "#ffffff",
      subtle:    "#f8fafc",
      subtleAlt: "#f1f5f9",
      tint:      "#f0f9ff",
      tintAmber: "#fffbeb",
      tintRed:   "#fef2f2",
      tintGreen: "#ecfdf5",
    },
    text: {
      primary:   "#0b1f2a",
      secondary: "#475569",
      muted:     "#64748b",
      inverse:   "#ffffff",
    },
    border: {
      hairline: "#e2e8f0",
      rule:     "#0e4a6e",
    },
    criticality: {
      CRITICAL: "#dc2626",
      HIGH:     "#d97706",
      MEDIUM:   "#2563eb",
      LOW:      "#059669",
    },
    assetType: {
      APPLICATION:   "#0e4a6e",
      CLOUD_SERVICE: "#2563eb",
      DATABASE:      "#4338ca",
      FILE_SYSTEM:   "#64748b",
      THIRD_PARTY:   "#d97706",
      PHYSICAL:      "#78716c",
      OTHER:         "#94a3b8",
    },
  },
  typography: {
    family: { sans: "Inter" },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 } as const,
    size: {
      micro:    7,
      caption:  8,
      body:     9,
      bodyLg:  10,
      h4:      11,
      h3:      13,
      h2:      16,
      h1:      22,
      display: 32,
    },
    letterSpacing: {
      tight:    -0.5,
      normal:    0,
      caps:      1.2,
      capsWide:  2,
    },
    lineHeight: { tight: 1.2, normal: 1.45, relaxed: 1.6 },
  },
  space: {
    0: 0,
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 12,
    6: 16,
    7: 20,
    8: 24,
    9: 32,
    10: 40,
    11: 56,
  },
  radius: { none: 0, sm: 2, md: 4, lg: 8, pill: 999 },
  page: {
    size: "A4" as const,
    margin: { top: 48, right: 48, bottom: 56, left: 48 },
  },
  chart: {
    donut: { size: 120, thickness: 14 },
    bar:   { height: 14, gap: 6, pillRadius: 2, trackOpacity: 0.12 },
  },
} as const;

export type Tokens = typeof tokens;
export type SemanticTone = keyof typeof tokens.color.semantic;
export type CriticalityLevel = keyof typeof tokens.color.criticality;
