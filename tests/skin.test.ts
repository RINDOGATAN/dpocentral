// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import {
  cookieAssignment,
  isDashboardPath,
  parseMenuCollapsed,
  parseSkin,
  skinFromQuery,
} from "@/lib/skin";

describe("the layout choice", () => {
  it("is Guided unless the cookie says exactly classic", () => {
    expect(parseSkin(undefined)).toBe("guided");
    expect(parseSkin(null)).toBe("guided");
    expect(parseSkin("")).toBe("guided");
    expect(parseSkin("Classic")).toBe("guided");
    expect(parseSkin("anything")).toBe("guided");
    expect(parseSkin("guided")).toBe("guided");
    expect(parseSkin("classic")).toBe("classic");
  });

  it("reads ?skin= only for the two known values", () => {
    expect(skinFromQuery("guided")).toBe("guided");
    expect(skinFromQuery("classic")).toBe("classic");
    expect(skinFromQuery("dark")).toBeNull();
    expect(skinFromQuery(null)).toBeNull();
  });

  it("collapses the menu only when asked", () => {
    expect(parseMenuCollapsed("collapsed")).toBe(true);
    expect(parseMenuCollapsed("open")).toBe(false);
    expect(parseMenuCollapsed(undefined)).toBe(false);
  });

  it("honours ?skin= on dashboard addresses only", () => {
    expect(isDashboardPath("/privacy")).toBe(true);
    expect(isDashboardPath("/privacy/data-inventory/abc")).toBe(true);
    expect(isDashboardPath("/privacy-x")).toBe(false);
    expect(isDashboardPath("/dsar")).toBe(false);
    expect(isDashboardPath("/sign-in")).toBe(false);
  });

  it("writes a host-only cookie for a year", () => {
    const c = cookieAssignment("dpc_skin", "guided");
    expect(c).toMatch(/^dpc_skin=guided;/);
    expect(c).toMatch(/Path=\//);
    expect(c).toMatch(/Max-Age=31536000/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).not.toMatch(/Domain/i);
  });
});
