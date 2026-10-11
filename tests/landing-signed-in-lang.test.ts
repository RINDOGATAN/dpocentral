// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The in-app pilot bar's "See pricing" link opens the landing's pricing block
 * (/?lang=en#pricing, /?lang=es#precios). A signed-in visitor is normally sent
 * to the application; with `?lang=` the landing is shown instead.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next-auth", () => ({ getServerSession: async () => mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/landing/LandingPage", () => ({ default: () => null }));

const { default: HomePage } = await import("@/app/page");
const open = (search: Record<string, string> = {}) => HomePage({ searchParams: Promise.resolve(search) });

beforeEach(() => {
  mocks.session = null;
  mocks.redirect.mockClear();
});

describe("the landing for a signed-in visitor", () => {
  it("sends a signed-in visitor without ?lang= to the application", async () => {
    mocks.session = { user: { id: "u1" } };
    await expect(open()).rejects.toThrow("redirect:/privacy");
  });

  it.each(["en", "es"])("shows the landing to a signed-in visitor with ?lang=%s", async (lang) => {
    mocks.session = { user: { id: "u1" } };
    const page = await open({ lang });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toBeTruthy();
  });

  it("shows the landing to a signed-out visitor", async () => {
    await open();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
