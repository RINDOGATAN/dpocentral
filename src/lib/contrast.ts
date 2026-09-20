// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Colour maths for the contrast rule.
 *
 * Every piece of text in this product has to meet 4.5 to 1 against the surface
 * it actually sits on, and every non-text mark that carries meaning (an icon, a
 * border, a status dot) has to meet 3 to 1. Those are numbers, not opinions, so
 * they are computed here and asserted in tests/contrast.test.ts.
 *
 * The functions are pure and dependency free. sRGB relative luminance and the
 * contrast ratio follow WCAG 2.1. The OKLCH conversion is here because
 * Tailwind 4 states its default palette in OKLCH, so the only honest way to
 * know what a class such as `text-red-500` paints is to convert the value the
 * framework actually ships.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa`. Alpha is ignored; blend first. */
export function hexToRgb(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3 || raw.length === 4
      ? raw
          .slice(0, 3)
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex colour: ${hex}`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.round(clamp01(n / 255) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * OKLCH to sRGB, as CSS Color 4 defines it.
 *
 * Out-of-gamut results are clamped per channel rather than gamut mapped. A
 * browser maps them, which moves a colour slightly towards the gamut boundary;
 * clamping lands in the same place for the palette values this product uses and
 * never reports a colour as lighter than it is painted.
 */
export function oklchToRgb(l: number, c: number, hDegrees: number): Rgb {
  const h = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const bb = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = l - 0.0894841775 * a - 1.291485548 * bb;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const linear = [
    +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map(clamp01);

  const encode = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

  return {
    r: Math.round(clamp01(encode(linear[0])) * 255),
    g: Math.round(clamp01(encode(linear[1])) * 255),
    b: Math.round(clamp01(encode(linear[2])) * 255),
  };
}

/** WCAG 2.1 relative luminance of an sRGB colour. */
export function relativeLuminance(colour: Rgb | string): number {
  const { r, g, b } = typeof colour === "string" ? hexToRgb(colour) : colour;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1 to 21. Order of the two colours does not matter. */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** Round the way a report should read it: two decimals, never rounded up. */
export function ratio(a: Rgb | string, b: Rgb | string): number {
  return Math.floor(contrastRatio(a, b) * 100) / 100;
}

/**
 * A translucent colour painted over an opaque one. Tailwind's `/10`, `/20` and
 * `/50` suffixes produce exactly this, and a tinted panel is only readable if
 * the blended result is what we measure.
 */
export function blend(over: Rgb | string, under: Rgb | string, alpha: number): Rgb {
  const o = typeof over === "string" ? hexToRgb(over) : over;
  const u = typeof under === "string" ? hexToRgb(under) : under;
  const a = clamp01(alpha);
  return {
    r: Math.round(o.r * a + u.r * (1 - a)),
    g: Math.round(o.g * a + u.g * (1 - a)),
    b: Math.round(o.b * a + u.b * (1 - a)),
  };
}

/** The two thresholds this product holds itself to. */
export const CONTRAST = {
  /** Body text, and any text below 24px (or below 19px bold). */
  text: 4.5,
  /** Icons, borders, status dots, chart marks: anything non-text that means something. */
  mark: 3,
} as const;
