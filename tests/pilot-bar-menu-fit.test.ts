// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The left menu fits the viewport while the pilot bar is on screen: the bar
 * publishes its visible height as a CSS variable and the menu panel takes it
 * off its height.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PILOT_BAR_VISIBLE_VAR, visibleTopBandHeight } from "@/components/pilot/hosted-pilot";

describe("pilot bar and the left menu", () => {
  it("counts only the part of the bar still on screen", () => {
    expect(visibleTopBandHeight(36, 36)).toBe(36); // page at the top
    expect(visibleTopBandHeight(12.4, 36)).toBe(12); // partly scrolled away
    expect(visibleTopBandHeight(-20, 36)).toBe(0); // scrolled past
    expect(visibleTopBandHeight(500, 36)).toBe(36); // never more than the bar
    expect(visibleTopBandHeight(Number.NaN, 36)).toBe(0);
  });

  it("takes the bar's visible height off the menu panel", () => {
    const layout = readFileSync("src/components/guided/guided-layout.tsx", "utf-8");
    expect(PILOT_BAR_VISIBLE_VAR).toBe("--pilot-bar-visible");
    expect(layout).toContain("calc(100dvh - 3.5rem - var(--pilot-bar-visible, 0px))");
  });
});
