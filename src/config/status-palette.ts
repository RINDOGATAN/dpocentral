// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { StatusTone } from "./status-tone";

/**
 * What a tone looks like on screen.
 *
 * This product ships one screen theme, the dark one in src/app/globals.css, so
 * every value below is chosen against those two surfaces and nothing else. The
 * second theme this product has is the printed report, which is a light
 * surface; its values stay in the PDF design system
 * (src/server/services/export/design-system/tokens.ts) and are measured by the
 * same test.
 *
 * A tone offers a mark and a chip, and deliberately offers no text colour. Body
 * text, headings and dates stay in the body text colour on every surface. That
 * is the whole point: red text on a near black card is not readable, so the
 * severity is carried by the icon, the border and the word instead.
 */

/** The opaque surfaces a tone can be painted on. Mirrors globals.css. */
export const SCREEN_SURFACE = {
  /** --background */
  background: "#1a1a1a",
  /** --card and --popover */
  card: "#242424",
} as const;

export type ScreenSurface = keyof typeof SCREEN_SURFACE;

export interface TonePaint {
  /**
   * Icon, border and status dot. A non-text mark that carries meaning, so it
   * has to reach 3 to 1 on both surfaces. Every value here reaches 5 to 1.
   */
  mark: { class: string; border: string; hex: string };
  /**
   * The chip: dark text on a light tint, so it reads as a label rather than as
   * coloured text on a dark card. Reaches 4.5 to 1 inside the chip.
   */
  chip: { class: string; bgHex: string; fgHex: string };
  /**
   * The wash behind a callout panel. Low alpha over the surface, so the body
   * text keeps its own contrast; measured blended, never neat.
   */
  tint: { class: string; alpha: number };
}

/**
 * Tailwind 4 states its palette in OKLCH. The hexes recorded here are the sRGB
 * those declarations resolve to, and the test recomputes them from
 * node_modules/tailwindcss/theme.css rather than trusting this comment.
 */
export const screenPalette: Record<StatusTone, TonePaint> = {
  success: {
    mark: { class: "text-green-400", border: "border-green-400", hex: "#05df72" },
    chip: { class: "bg-green-100 text-green-900", bgHex: "#dcfce7", fgHex: "#0d542b" },
    tint: { class: "bg-green-400/10", alpha: 0.1 },
  },
  warning: {
    mark: { class: "text-amber-400", border: "border-amber-400", hex: "#ffb900" },
    chip: { class: "bg-amber-100 text-amber-900", bgHex: "#fef3c6", fgHex: "#7b3306" },
    tint: { class: "bg-amber-400/10", alpha: 0.1 },
  },
  danger: {
    mark: { class: "text-red-400", border: "border-red-400", hex: "#ff6467" },
    chip: { class: "bg-red-100 text-red-900", bgHex: "#ffe2e2", fgHex: "#82181a" },
    tint: { class: "bg-red-400/10", alpha: 0.1 },
  },
  info: {
    mark: { class: "text-sky-400", border: "border-sky-400", hex: "#00bcff" },
    chip: { class: "bg-sky-100 text-sky-900", bgHex: "#dff2fe", fgHex: "#024a70" },
    tint: { class: "bg-sky-400/10", alpha: 0.1 },
  },
  neutral: {
    mark: { class: "text-neutral-400", border: "border-neutral-400", hex: "#a1a1a1" },
    chip: { class: "bg-neutral-200 text-neutral-900", bgHex: "#e5e5e5", fgHex: "#171717" },
    tint: { class: "bg-neutral-400/10", alpha: 0.1 },
  },
};

/** The chip classes for a tone: a light label, never coloured text on the card. */
export function toneChip(tone: StatusTone): string {
  return screenPalette[tone].chip.class;
}

/** The icon or dot colour for a tone. */
export function toneMark(tone: StatusTone): string {
  return screenPalette[tone].mark.class;
}

/** The border colour for a tone, for the edge of a callout or a card. */
export function toneBorder(tone: StatusTone): string {
  return screenPalette[tone].mark.border;
}

/** The wash behind a callout panel of this tone. */
export function toneTint(tone: StatusTone): string {
  return screenPalette[tone].tint.class;
}

/**
 * A solid fill for a progress bar or a chart series. Same colour as the mark,
 * so it clears 3 to 1 on both surfaces. A bar filled this way still needs its
 * value in words beside it; the fill is the shape, not the meaning.
 */
export function toneFill(tone: StatusTone): string {
  return screenPalette[tone].mark.class.replace(/^text-/, "bg-");
}

/** The same colour as an SVG stroke, for a ring or a line on a chart. */
export function toneStroke(tone: StatusTone): string {
  return screenPalette[tone].mark.class.replace(/^text-/, "stroke-");
}
