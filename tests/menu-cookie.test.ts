// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import {
  cookieAssignment,
  isDashboardPath,
  parseMenuCollapsed,
  retiredClassicRedirect,
} from "@/lib/menu-cookie";

describe("the left menu cookie", () => {
  it("collapses the menu only when asked", () => {
    expect(parseMenuCollapsed("collapsed")).toBe(true);
    expect(parseMenuCollapsed("open")).toBe(false);
    expect(parseMenuCollapsed(undefined)).toBe(false);
  });

  it("knows the dashboard addresses", () => {
    expect(isDashboardPath("/privacy")).toBe(true);
    expect(isDashboardPath("/privacy/data-inventory/abc")).toBe(true);
    expect(isDashboardPath("/privacy-x")).toBe(false);
    expect(isDashboardPath("/dsar")).toBe(false);
    expect(isDashboardPath("/sign-in")).toBe(false);
  });

  it("writes a host-only cookie for a year", () => {
    const c = cookieAssignment("dpc_menu", "collapsed");
    expect(c).toMatch(/^dpc_menu=collapsed;/);
    expect(c).toMatch(/Path=\//);
    expect(c).toMatch(/Max-Age=31536000/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).not.toMatch(/Domain/i);
  });
});

describe("old Classic addresses", () => {
  it("drop the retired ?skin= parameter and keep the rest", () => {
    expect(retiredClassicRedirect("/privacy", "?skin=classic")).toBe("/privacy");
    expect(retiredClassicRedirect("/privacy", "?skin=guided")).toBe("/privacy");
    expect(retiredClassicRedirect("/privacy/vendors", "?view=due-diligence&skin=classic")).toBe(
      "/privacy/vendors?view=due-diligence",
    );
    expect(retiredClassicRedirect("/privacy/clients", "skin=classic")).toBe("/privacy/clients");
  });

  it("leave current addresses alone", () => {
    expect(retiredClassicRedirect("/privacy", "")).toBeNull();
    expect(retiredClassicRedirect("/privacy/vendors", "?view=due-diligence")).toBeNull();
    // Only the dashboard: a public page with the same parameter is not ours to change.
    expect(retiredClassicRedirect("/sign-in", "?skin=classic")).toBeNull();
  });
});
