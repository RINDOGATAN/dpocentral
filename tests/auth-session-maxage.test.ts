// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The signed-in session lasts 12 hours from sign-in (owner's decision). The
 * JWT must carry the same lifetime, or the token could outlive the session it
 * stands for. No real database is touched.
 */

import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => {
  delete process.env.AUTH_COOKIE_DOMAIN;
  delete process.env.RESEND_API_KEY;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  return {
    prisma: {
      user: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn() },
      organizationMember: { findFirst: vi.fn() },
    },
  };
});
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));

import { authOptions } from "@/lib/auth";

const TWELVE_HOURS = 12 * 60 * 60;

describe("session lifetime", () => {
  it("ends 12 hours after sign-in", () => {
    expect(authOptions.session?.maxAge).toBe(TWELVE_HOURS);
  });

  it("gives the JWT the same 12-hour lifetime", () => {
    expect(authOptions.jwt?.maxAge).toBe(TWELVE_HOURS);
  });
});
