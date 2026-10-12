// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The local (passwordless credentials) sign-in is refused on the hosted
 * production deployment, whatever the build flag says; the self-host kit
 * (no VERCEL_ENV) keeps it. Same runtime rule as AI Sentinel and Dealroom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  delete process.env.AUTH_COOKIE_DOMAIN;
  delete process.env.RESEND_API_KEY;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/config/features", () => ({
  features: { devAuthEnabled: true, emailAuthEnabled: true, googleAuthEnabled: true },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { localSignInAllowed, signInMethods } from "@/lib/sign-in-methods";

const flags = { devAuthEnabled: true, emailAuthEnabled: true, googleAuthEnabled: true };

type Authorize = (credentials: unknown, request: unknown) => Promise<unknown>;
// NextAuth keeps the caller's options (id, authorize) under `options`.
type Provider = { id: string; options?: { id?: string; authorize?: Authorize } };

async function loadAuth(vercelEnv: string | undefined) {
  vi.resetModules();
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  const { authOptions } = await import("@/lib/auth");
  return (authOptions.providers as unknown as Provider[]).find(
    (p) => (p.options?.id ?? p.id) === "dev-credentials",
  );
}

const savedVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => {
  mocks.prisma.user.findUnique.mockReset();
  mocks.prisma.user.create.mockReset();
});

afterEach(() => {
  if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = savedVercelEnv;
});

describe("localSignInAllowed", () => {
  it("is refused on the hosted production deployment even with the build flag on", () => {
    expect(localSignInAllowed({ VERCEL_ENV: "production" }, true)).toBe(false);
  });

  it("stays on for the self-host kit and for dev", () => {
    expect(localSignInAllowed({}, true)).toBe(true);
    expect(localSignInAllowed({ NODE_ENV: "production" }, true)).toBe(true);
  });

  it("stays off when the build flag is off", () => {
    expect(localSignInAllowed({}, false)).toBe(false);
  });
});

describe("the sign-in page", () => {
  it("does not offer the local form on the hosted production deployment", () => {
    expect(signInMethods({ VERCEL_ENV: "production" }, flags).local).toBe(false);
    expect(signInMethods({}, flags).local).toBe(true);
  });
});

describe("the NextAuth provider", () => {
  it("is not registered on the hosted production deployment", async () => {
    expect(await loadAuth("production")).toBeUndefined();
  });

  it("is registered on the self-host kit and signs a user in", async () => {
    const provider = await loadAuth(undefined);
    expect(provider).toBeDefined();
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@example.test", name: "a" });
    const user = await provider!.options!.authorize!({ email: "a@example.test" }, {});
    expect(user).toMatchObject({ id: "u1" });
  });

  it("refuses every attempt once the runtime is the hosted production deployment", async () => {
    const provider = await loadAuth(undefined);
    process.env.VERCEL_ENV = "production";
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@example.test", name: "a" });
    const user = await provider!.options!.authorize!({ email: "a@example.test" }, {});
    expect(user).toBeNull();
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});
