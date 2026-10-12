// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The e-mail policy at sign-in (src/lib/email-policy-server.ts):
 *  - the e-mail link and local sign-in POSTs answer 400 with the message key
 *    before next-auth runs (so no e-mail is sent, no account is made);
 *  - the signIn callback (Google, and the e-mail link as a second line)
 *    redirects to the error page with the key;
 *  - an address that already has an account is never refused.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  delete process.env.AUTH_COOKIE_DOMAIN;
  delete process.env.RESEND_API_KEY;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  return {
    prisma: {
      user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
      organization: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
      organizationMember: { findFirst: vi.fn(), count: vi.fn(async () => 0) },
    },
    nextAuthHandler: vi.fn(async () => new Response("{}", { status: 200 })),
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/config/features", () => ({ features: { devAuthEnabled: true } }));
vi.mock("next-auth", () => ({ default: () => mocks.nextAuthHandler, getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { authOptions } from "@/lib/auth";
import { POST } from "@/app/api/auth/[...nextauth]/route";

const signInCallback = authOptions.callbacks!.signIn! as (args: unknown) => Promise<boolean | string>;

function post(path: string, email: string, cookie = "") {
  return new Request(`https://app.test.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams({ email, csrfToken: "t", json: "true" }).toString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.findFirst.mockResolvedValue(null);
});

describe("the e-mail link and local sign-in", () => {
  it.each(["a.b.c.d@gmail.com", "SOMEONE@HOTMAIL.COM", "x@aol.co.uk"])(
    "answers 400 with the key for a new %s, before next-auth runs",
    async (email) => {
      const res = await POST(post("/api/auth/signin/email", email), {});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("email_not_accepted");
      expect(body.message).toBe(
        "Please use your work e-mail address, or a different personal address. We can't accept this one."
      );
      expect(new URL(body.url).searchParams.get("error")).toBe("email_not_accepted");
      expect(mocks.nextAuthHandler).not.toHaveBeenCalled();
    }
  );

  it("answers in Spanish for a Spanish reader", async () => {
    const res = await POST(post("/api/auth/signin/email", "x@hotmail.com", "locale=es"), {});
    expect((await res.json()).message).toBe(
      "Usa tu correo del trabajo u otra dirección personal. No podemos aceptar esta."
    );
  });

  it("refuses local sign-in the same way", async () => {
    const res = await POST(post("/api/auth/callback/dev-credentials", "x@aol.com"), {});
    expect(res.status).toBe(400);
  });

  it.each(["first.last@gmail.com", "FIRST.LAST@GMAIL.COM", "ana@firm.example"])(
    "passes %s through",
    async (email) => {
      const res = await POST(post("/api/auth/signin/email", email), {});
      expect(res.status).toBe(200);
      expect(mocks.nextAuthHandler).toHaveBeenCalledOnce();
    }
  );

  it("lets an existing account keep signing in", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({ id: "u-1" });
    const res = await POST(post("/api/auth/signin/email", "old@hotmail.com"), {});
    expect(res.status).toBe(200);
  });
});

describe("the signIn callback (Google)", () => {
  it("sends a new refused address to the error page with the key", async () => {
    const result = await signInCallback({ user: { id: "g-1", email: "X@HOTMAIL.FR" }, account: { provider: "google" } });
    expect(result).toBe("/auth-error?error=email_not_accepted");
  });

  it("refuses a new dotted Gmail address", async () => {
    const result = await signInCallback({
      user: { id: "g-1", email: "b.ake.r.miche.ll.eba.hpc.y.jx@gmail.com" },
      account: { provider: "google" },
    });
    expect(result).toBe("/auth-error?error=email_not_accepted");
  });

  it("accepts a usual address and an existing account", async () => {
    expect(
      await signInCallback({ user: { id: "g-1", email: "first.last@gmail.com" }, account: { provider: "google" } })
    ).toBe(true);
    mocks.prisma.user.findFirst.mockResolvedValue({ id: "u-1" });
    expect(
      await signInCallback({ user: { id: "u-1", email: "old@aol.com" }, account: { provider: "google" } })
    ).toBe(true);
  });
});
