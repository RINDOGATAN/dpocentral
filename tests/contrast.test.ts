// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Colour must never carry meaning on its own, and text must be readable.
 *
 * This file computes the contrast ratio of every foreground and background pair
 * the product actually uses and fails below the threshold. A visual claim
 * without a computed ratio is not proof, so nothing here is asserted by eye.
 * Every pair is named, so a failure says which one and where.
 *
 * Two themes are measured, because this product has two:
 *
 *   - the screen, which ships one theme, the dark one in src/app/globals.css;
 *   - the printed report, which is a light surface, in the PDF design system.
 *
 * Where the pairs come from:
 *
 *   1. The tone palette in src/config/status-palette.ts, the theme tokens in
 *      src/app/globals.css and the report tokens, pair by named pair.
 *   2. A sweep of every .tsx file under src/. Class names are read out of each
 *      string, a text colour is paired with a background colour named in the
 *      same string, and where a string names no background the pair is measured
 *      against the card, the lightest surface the app paints text on. A colour
 *      class the table cannot resolve fails rather than passing quietly.
 *
 * The thresholds are 4.5 to 1 for text and 3 to 1 for a non-text mark that
 * carries meaning. The large-text allowance of 3 to 1 is deliberately not
 * claimed anywhere: a class string does not reliably say how big the text is,
 * so the stricter number is applied to all of it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

import { CONTRAST, blend, ratio, rgbToHex } from "../src/lib/contrast";
import { STATUS_TONES } from "../src/config/status-tone";
import { SCREEN_SURFACE, screenPalette } from "../src/config/status-palette";
import { tokens } from "../src/server/services/export/design-system/tokens";
import {
  ROOT,
  THEME,
  TW,
  classNameStrings,
  pairsInString,
  sweepFiles,
  tintedTextInString,
} from "./helpers/class-colours";

/* ------------------------------------------------------------------ *
 * 1. The tone palette, pair by named pair.
 * ------------------------------------------------------------------ */

describe("screen tones", () => {
  for (const tone of STATUS_TONES) {
    const paint = screenPalette[tone];

    it(`${tone}: the recorded hexes are what Tailwind paints`, () => {
      const markClass = paint.mark.class.replace(/^text-/, "");
      const [chipBgClass, chipFgClass] = paint.chip.class.split(/\s+/);
      expect(TW[markClass], `${tone} mark ${markClass}`).toBe(paint.mark.hex);
      expect(TW[chipBgClass.replace(/^bg-/, "")], `${tone} chip background`).toBe(paint.chip.bgHex);
      expect(TW[chipFgClass.replace(/^text-/, "")], `${tone} chip text`).toBe(paint.chip.fgHex);
    });

    for (const [surfaceName, surface] of Object.entries(SCREEN_SURFACE)) {
      it(`${tone}: mark on the ${surfaceName} reaches ${CONTRAST.mark} to 1`, () => {
        const r = ratio(paint.mark.hex, surface);
        expect(
          r,
          `${tone} mark ${paint.mark.hex} on ${surfaceName} ${surface}: ${r} to 1`
        ).toBeGreaterThanOrEqual(CONTRAST.mark);
      });

      it(`${tone}: the chip stands off the ${surfaceName}`, () => {
        const r = ratio(paint.chip.bgHex, surface);
        expect(
          r,
          `${tone} chip ${paint.chip.bgHex} on ${surfaceName} ${surface}: ${r} to 1`
        ).toBeGreaterThanOrEqual(CONTRAST.mark);
      });

      it(`${tone}: body text stays readable through the tint on the ${surfaceName}`, () => {
        const tinted = rgbToHex(blend(paint.mark.hex, surface, paint.tint.alpha));
        const body = ratio(THEME.foreground, tinted);
        const muted = ratio(THEME["muted-foreground"], tinted);
        expect(
          body,
          `foreground ${THEME.foreground} on the ${tone} tint over the ${surfaceName} (${tinted}): ${body} to 1`
        ).toBeGreaterThanOrEqual(CONTRAST.text);
        expect(
          muted,
          `muted-foreground ${THEME["muted-foreground"]} on the ${tone} tint over the ${surfaceName} (${tinted}): ${muted} to 1`
        ).toBeGreaterThanOrEqual(CONTRAST.text);
      });
    }

    it(`${tone}: chip text reaches ${CONTRAST.text} to 1 inside the chip`, () => {
      const r = ratio(paint.chip.fgHex, paint.chip.bgHex);
      expect(
        r,
        `${tone} chip text ${paint.chip.fgHex} on ${paint.chip.bgHex}: ${r} to 1`
      ).toBeGreaterThanOrEqual(CONTRAST.text);
    });
  }
});

/* ------------------------------------------------------------------ *
 * 2. The theme tokens the whole app is built on.
 * ------------------------------------------------------------------ */

describe("theme tokens", () => {
  const surfaces = ["background", "card", "popover", "muted", "secondary", "sidebar"];
  const textTokens = ["foreground", "muted-foreground", "primary"];

  for (const surface of surfaces) {
    for (const text of textTokens) {
      it(`${text} on ${surface} reaches ${CONTRAST.text} to 1`, () => {
        const r = ratio(THEME[text], THEME[surface]);
        expect(
          r,
          `${text} ${THEME[text]} on ${surface} ${THEME[surface]}: ${r} to 1`
        ).toBeGreaterThanOrEqual(CONTRAST.text);
      });
    }
  }

  const onSolid: Array<[string, string]> = [
    ["primary-foreground", "primary"],
    ["destructive-foreground", "destructive"],
    ["secondary-foreground", "secondary"],
    ["sidebar-foreground", "sidebar"],
    ["sidebar-primary-foreground", "sidebar-primary"],
    ["sidebar-accent-foreground", "sidebar-accent"],
    ["lime-foreground", "lime"],
  ];

  for (const [fg, bg] of onSolid) {
    it(`${fg} on ${bg} reaches ${CONTRAST.text} to 1`, () => {
      expect(THEME[fg], `${fg} is not defined in globals.css`).toBeDefined();
      expect(THEME[bg], `${bg} is not defined in globals.css`).toBeDefined();
      const r = ratio(THEME[fg], THEME[bg]);
      expect(r, `${fg} ${THEME[fg]} on ${bg} ${THEME[bg]}: ${r} to 1`).toBeGreaterThanOrEqual(
        CONTRAST.text
      );
    });
  }

  it("the focus ring is visible on both surfaces", () => {
    for (const [name, surface] of Object.entries(SCREEN_SURFACE)) {
      const r = ratio(THEME.ring, surface);
      expect(r, `ring ${THEME.ring} on the ${name} ${surface}: ${r} to 1`).toBeGreaterThanOrEqual(
        CONTRAST.mark
      );
    }
  });

  it("the chart series are distinguishable as marks on both surfaces", () => {
    for (const key of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]) {
      for (const [name, surface] of Object.entries(SCREEN_SURFACE)) {
        const r = ratio(THEME[key], surface);
        expect(r, `${key} ${THEME[key]} on the ${name} ${surface}: ${r} to 1`).toBeGreaterThanOrEqual(
          CONTRAST.mark
        );
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * 3. The printed report, the product's light surface.
 * ------------------------------------------------------------------ */

describe("report tones", () => {
  for (const [tone, paint] of Object.entries(tokens.color.semantic)) {
    it(`${tone}: text on its own tint reaches ${CONTRAST.text} to 1`, () => {
      const r = ratio(paint.fg, paint.bg);
      expect(r, `report ${tone} ${paint.fg} on ${paint.bg}: ${r} to 1`).toBeGreaterThanOrEqual(
        CONTRAST.text
      );
    });

    it(`${tone}: text on the page reaches ${CONTRAST.text} to 1`, () => {
      const r = ratio(paint.fg, tokens.color.surface.page);
      expect(
        r,
        `report ${tone} ${paint.fg} on the page ${tokens.color.surface.page}: ${r} to 1`
      ).toBeGreaterThanOrEqual(CONTRAST.text);
    });

    it(`${tone}: the solid mark reaches ${CONTRAST.mark} to 1 on the page`, () => {
      const r = ratio(paint.solid, tokens.color.surface.page);
      expect(
        r,
        `report ${tone} mark ${paint.solid} on the page: ${r} to 1`
      ).toBeGreaterThanOrEqual(CONTRAST.mark);
    });
  }

  for (const [level, hex] of Object.entries(tokens.color.criticality)) {
    it(`criticality ${level} reaches ${CONTRAST.mark} to 1 on the page`, () => {
      const r = ratio(hex, tokens.color.surface.page);
      expect(r, `criticality ${level} ${hex} on the page: ${r} to 1`).toBeGreaterThanOrEqual(
        CONTRAST.mark
      );
    });
  }

  for (const [name, hex] of Object.entries(tokens.color.text)) {
    if (name === "inverse") continue;
    for (const [surfaceName, surface] of Object.entries(tokens.color.surface)) {
      it(`report text ${name} on ${surfaceName} reaches ${CONTRAST.text} to 1`, () => {
        const r = ratio(hex, surface);
        expect(
          r,
          `report text ${name} ${hex} on ${surfaceName} ${surface}: ${r} to 1`
        ).toBeGreaterThanOrEqual(CONTRAST.text);
      });
    }
  }

  it("inverse text is readable on the brand navy it is printed on", () => {
    const r = ratio(tokens.color.text.inverse, tokens.color.brand.navy);
    expect(
      r,
      `report inverse ${tokens.color.text.inverse} on navy ${tokens.color.brand.navy}: ${r} to 1`
    ).toBeGreaterThanOrEqual(CONTRAST.text);
  });
});

/* ------------------------------------------------------------------ *
 * 4. The sweep: every pair the screens actually use.
 * ------------------------------------------------------------------ */

describe("every text and background pair the screens use", () => {
  const files = sweepFiles();

  it("sweeps the screens", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const strings = classNameStrings(readFileSync(file, "utf8"));
    if (strings.length === 0) continue;

    it(`reaches ${CONTRAST.text} to 1 everywhere in ${rel}`, () => {
      const failures = new Set<string>();
      const unknowns = new Set<string>();
      for (const value of strings) {
        const { pairs, unknown } = pairsInString(value);
        unknown.forEach((u) => unknowns.add(u));
        for (const p of pairs) {
          if (p.measured < CONTRAST.text) {
            failures.add(`${p.klass} on ${p.bgLabel}: ${p.fgHex} on ${p.bgHex} is ${p.measured} to 1`);
          }
        }
      }
      expect(
        [...unknowns],
        `${rel}: colour classes this test cannot resolve, so it cannot vouch for them`
      ).toEqual([]);
      expect([...failures], `${rel}: below ${CONTRAST.text} to 1`).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------ *
 * 5. Colour never carries meaning on its own.
 * ------------------------------------------------------------------ */

describe("colour never carries meaning on its own", () => {
  const files = sweepFiles();

  it("no status hue is used as text on a dark surface", () => {
    // The owner ruled this out: a headline, a date line, a metric number or a
    // link tinted red, green or amber on a near black card. A hue may only be
    // a chip, which is dark text on a light tint, or a mark, which is an icon
    // or a border. The tone palette is the only place that decides which.
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      for (const value of classNameStrings(readFileSync(file, "utf8"))) {
        for (const klass of tintedTextInString(value)) {
          offenders.push(`${rel}: ${klass}`);
        }
      }
    }
    expect([...new Set(offenders)], "status hue used as text on a dark surface").toEqual([]);
  });

  it("severity is never mapped straight onto a hue", () => {
    // A screen that maps a tier onto Tailwind classes carries no word and no
    // shape with it. Severity goes through toneForRiskTier and StatusChip.
    const offenders: string[] = [];
    const map =
      /(?:CRITICAL|HIGH|MEDIUM|LOW)\s*:\s*["'`][^"'`\n]*\b(?:bg|text|border)-(?:red|orange|amber|yellow|green|emerald|blue|sky|purple|violet|indigo|rose|pink|teal|cyan)-\d{2,3}/;
    for (const file of files) {
      if (map.test(readFileSync(file, "utf8"))) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders, "severity mapped straight onto a hue").toEqual([]);
  });

  it("an alert carries its severity in the icon, the border and the heading word", () => {
    // Not in the sentence. `text-destructive` inside a bordered or tinted panel
    // is the tinted sentence the owner photographed.
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      for (const value of classNameStrings(readFileSync(file, "utf8"))) {
        const classes = value.split(/\s+/);
        const tinted = classes.some((c) => /^(?:[a-z-]+:)?text-destructive(?:\/\d+)?$/.test(c));
        const panel = classes.some((c) =>
          /^(?:[a-z-]+:)?(?:border(?:-[lrtbxy])?(?:-\d)?|bg-[a-z]|rounded)/.test(c)
        );
        if (tinted && panel) offenders.push(`${rel}: ${value.trim()}`);
      }
    }
    expect([...new Set(offenders)], "a panel whose sentence is tinted with the severity colour").toEqual(
      []
    );
  });
});
