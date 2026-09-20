// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reads the colour a Tailwind class actually paints, and pairs the text and
 * background classes each screen puts together.
 *
 * The colours are not hard-coded anywhere here. Tailwind 4 declares its palette
 * in OKLCH in node_modules/tailwindcss/theme.css, and this product declares its
 * own tokens in src/app/globals.css; both are parsed, so what gets measured is
 * what the browser paints.
 *
 * Used by tests/contrast.test.ts.
 */

import { readFileSync, readdirSync } from "fs";
import path from "path";

import { blend, oklchToRgb, ratio, rgbToHex } from "../../src/lib/contrast";
import { SCREEN_SURFACE } from "../../src/config/status-palette";

export const ROOT = path.resolve(__dirname, "../..");

/** Tailwind's own palette, converted from the OKLCH the framework ships. */
export function loadTailwindPalette(): Record<string, string> {
  const css = readFileSync(path.join(ROOT, "node_modules/tailwindcss/theme.css"), "utf8");
  const palette: Record<string, string> = {};
  const decl = /--color-([a-z]+)-(\d+):\s*oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  for (const m of css.matchAll(decl)) {
    const [, hue, shade, l, c, h] = m;
    const lightness = parseFloat(l) > 1 ? parseFloat(l) / 100 : parseFloat(l);
    palette[`${hue}-${shade}`] = rgbToHex(oklchToRgb(lightness, parseFloat(c), parseFloat(h)));
  }
  palette.white = "#ffffff";
  palette.black = "#000000";
  return palette;
}

/** The product's own tokens, parsed out of the stylesheet that defines them. */
export function loadThemeTokens(): Record<string, string> {
  const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("/* No separate dark mode"));
  const found: Record<string, string> = {};
  for (const m of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
    found[m[1]] = m[2];
  }
  return found;
}

export const TW = loadTailwindPalette();
export const THEME = loadThemeTokens();

/** The hues that say good, careful or serious. Grey is decoration. */
export const MEANING_HUES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

/** Shades light enough to be a chip background rather than coloured text. */
const CHIP_BACKGROUND_SHADE = /^(?:50|100|200)$/;

const NOT_A_COLOUR =
  /^(xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|start|end|balance|pretty|nowrap|wrap|ellipsis|clip|top|bottom|cover|contain|repeat|no-repeat|fixed|local|scroll|auto|none|gradient-to-[a-z]+|clip-text|origin-[a-z]+)$/;

export interface ClassColour {
  klass: string;
  hex: string;
  alpha: number;
}

/**
 * `text-red-400`, `bg-amber-500/10`, `text-[#53aecc]`, `bg-card`.
 * `null` when the class names no colour, `"unknown"` when it looks like a
 * colour this table cannot resolve, which must fail rather than pass quietly.
 */
export function readColourClass(
  klass: string,
  kind: "text" | "bg" | "border"
): ClassColour | null | "unknown" {
  const prefix = `${kind}-`;
  if (!klass.startsWith(prefix)) return null;
  let rest = klass.slice(prefix.length);

  let alpha = 1;
  const slash = rest.lastIndexOf("/");
  if (slash !== -1) {
    const pct = Number(rest.slice(slash + 1));
    if (!Number.isFinite(pct)) return null;
    alpha = pct / 100;
    rest = rest.slice(0, slash);
  }

  if (rest === "transparent" || rest === "current" || rest === "inherit") return null;

  const arbitrary = rest.match(/^\[(#[0-9a-fA-F]{3,8})\]$/);
  if (arbitrary) return { klass, hex: arbitrary[1], alpha };
  if (rest.startsWith("[")) return null; // a var() or a calc(), out of scope

  const hex = THEME[rest] ?? TW[rest];
  if (hex) return { klass, hex, alpha };

  if (NOT_A_COLOUR.test(rest)) return null;
  if (/^\d/.test(rest) || rest.includes("(")) return null;

  return /^[a-z]+-\d{2,3}$/.test(rest) ? "unknown" : null;
}

/** Every string in a source file that looks like a list of class names. */
export function classNameStrings(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n$]*)`/g)) {
    const value = m[1] ?? m[2] ?? m[3] ?? "";
    if (/(?:^|\s)(?:[a-z-]+:)?(?:text|bg|border)-/.test(value)) out.push(value);
  }
  return out;
}

/** Files whose colours are the subject of the test rather than a use of it. */
const SWEEP_EXCLUDE = [
  "src/config/status-palette.ts",
  "src/lib/contrast.ts",
  "src/server/services/export/", // the printed report, measured on its own tokens
];

export function sweepFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) {
        const rel = path.relative(ROOT, full);
        if (!SWEEP_EXCLUDE.some((x) => rel.startsWith(x))) out.push(full);
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return out.sort();
}

export interface Pair {
  klass: string;
  state: string;
  fgHex: string;
  bgHex: string;
  bgLabel: string;
  measured: number;
  /** 4.5 for text, 3 for a mark such as an icon. */
  threshold: number;
  kind: "text" | "mark";
}

const CARD = SCREEN_SURFACE.card;

/**
 * A `-foreground` token exists to be painted on its partner surface, and that
 * surface is usually set on an ancestor rather than on the same element. Where
 * a string names no background of its own, these are measured against their
 * partner instead of against the card.
 */
const PAIRED_SURFACE: Record<string, string> = {
  "primary-foreground": "primary",
  "secondary-foreground": "secondary",
  "destructive-foreground": "destructive",
  "accent-foreground": "accent",
  "card-foreground": "card",
  "popover-foreground": "popover",
  "muted-foreground": "muted",
  "sidebar-foreground": "sidebar",
  "sidebar-primary-foreground": "sidebar-primary",
  "sidebar-accent-foreground": "sidebar-accent",
  "lime-foreground": "lime",
};

/** `hover:bg-primary` is the `hover` state; a bare class is the base state. */
function splitVariant(c: string): { state: string; bare: string } {
  const colon = c.lastIndexOf(":");
  return colon === -1
    ? { state: "", bare: c }
    : { state: c.slice(0, colon), bare: c.slice(colon + 1) };
}

/**
 * A class string that sizes a box and sets no font size is an icon, not text.
 * An icon that carries meaning is a mark, and a mark's threshold is 3 to 1.
 */
function isMark(classes: string[]): boolean {
  const sized = classes.some((c) => /^(?:[a-z-]+:)?(?:size-\d|w-\d)/.test(c));
  const tall = classes.some((c) => /^(?:[a-z-]+:)?(?:size-\d|h-\d)/.test(c));
  const hasFontSize = classes.some((c) =>
    /^(?:[a-z-]+:)?text-(?:xs|sm|base|lg|xl|[2-9]xl|\[)/.test(c)
  );
  return sized && tall && !hasFontSize;
}

/**
 * The pairs one class string puts together, state by state.
 *
 * Each variant is its own state: `hover:bg-x hover:text-y` is measured as the
 * hover pair, not crossed with the base pair. Where a state names no background
 * the text is measured against the card, the lightest surface a screen paints
 * text on.
 */
export function pairsInString(value: string): { pairs: Pair[]; unknown: string[] } {
  const classes = value.split(/\s+/).filter(Boolean);
  const unknown: string[] = [];
  const texts = new Map<string, ClassColour[]>();
  const backgrounds = new Map<string, ClassColour[]>();
  const push = (m: Map<string, ClassColour[]>, k: string, v: ClassColour) =>
    m.set(k, [...(m.get(k) ?? []), v]);

  for (const raw of classes) {
    const { state, bare } = splitVariant(raw);
    const t = readColourClass(bare, "text");
    if (t === "unknown") unknown.push(bare);
    else if (t) push(texts, state, { ...t, klass: raw });
    const b = readColourClass(bare, "bg");
    if (b === "unknown") unknown.push(bare);
    else if (b) push(backgrounds, state, { ...b, klass: raw });
  }

  if (texts.size === 0) return { pairs: [], unknown };

  const mark = isMark(classes);
  const states = new Set<string>([...texts.keys(), ...backgrounds.keys()]);
  const pairs: Pair[] = [];

  for (const state of states) {
    const stateTexts = texts.get(state) ?? texts.get("") ?? [];
    const stateBgs = backgrounds.get(state) ?? backgrounds.get("") ?? [];
    const grounds =
      stateBgs.length > 0
        ? stateBgs.map((b) => ({
            hex: b.alpha < 1 ? rgbToHex(blend(b.hex, CARD, b.alpha)) : b.hex,
            label: b.alpha < 1 ? `${b.klass} over the card` : b.klass,
          }))
        : [{ hex: CARD, label: "the card" }];

    for (const t of stateTexts) {
      const token = splitVariant(t.klass).bare.replace(/^text-/, "").replace(/\/\d+$/, "");
      const partner = stateBgs.length === 0 ? PAIRED_SURFACE[token] : undefined;
      const against =
        partner && THEME[partner]
          ? [{ hex: THEME[partner], label: `its own surface, ${partner}` }]
          : grounds;

      for (const g of against) {
        const fg = t.alpha < 1 ? rgbToHex(blend(t.hex, g.hex, t.alpha)) : t.hex;
        pairs.push({
          klass: t.klass,
          state,
          fgHex: fg,
          bgHex: g.hex,
          bgLabel: g.label,
          measured: ratio(fg, g.hex),
          threshold: mark ? 3 : 4.5,
          kind: mark ? "mark" : "text",
        });
      }
    }
  }
  return { pairs, unknown };
}

/**
 * Status hues used as text on a dark surface: the thing the owner ruled out.
 * A hue is allowed only as a chip, that is, dark text on a light tint named in
 * the same string.
 */
export function tintedTextInString(value: string): string[] {
  const classes = value.split(/\s+/).filter(Boolean).map((c) => splitVariant(c).bare);
  // An icon is a mark, not text; a tone is allowed to colour it.
  if (isMark(value.split(/\s+/).filter(Boolean))) return [];
  const hues = MEANING_HUES.join("|");
  const textHue = new RegExp(`^text-(${hues})-(\\d{2,3})(?:/\\d+)?$`);
  const lightBg = new RegExp(`^bg-(?:${hues}|neutral|gray|slate|stone|zinc|white)-?(\\d{2,3})?(?:/\\d+)?$`);

  const hasLightChipBackground = classes.some((c) => {
    const m = c.match(lightBg);
    if (!m) return false;
    return m[1] === undefined || CHIP_BACKGROUND_SHADE.test(m[1]);
  });

  const offenders: string[] = [];
  for (const c of classes) {
    const m = c.match(textHue);
    if (!m) continue;
    // Dark text on a light chip is the sanctioned shape and stays.
    if (hasLightChipBackground && Number(m[2]) >= 700) continue;
    offenders.push(c);
  }
  return offenders;
}
