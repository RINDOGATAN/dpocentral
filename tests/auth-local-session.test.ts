// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Self-host session hygiene (port of Dealroom's fix, commit e31ed96 there).
 *
 * On the suite, all apps run on localhost (cookies are per-host, not per
 * port) and share one NEXTAUTH_SECRET, so a sibling app's JWT decodes here
 * carrying a user id that only exists in the sibling's database. Before the
 * fix, DB writes for such a session died on foreign-key violations.
 *
 * Two defenses on the local-auth posture:
 *  1. App-prefixed cookie names (`dpocentral.session-token`) so sibling apps
 *     can no longer overwrite our session cookie at all.
 *  2. The jwt callback re-anchors a token whose sub is unknown locally by
 *     email (JIT provisioning, which already existed for hosted SSO) and now
 *     also clears the sub when there is nothing to re-anchor with.
 * Plus a runtime guard: a session without a user id is UNAUTHORIZED.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  // authOptions reads these at module load — pin the self-host posture
  // before the import graph is evaluated.
  delete process.env.AUTH_COOKIE_DOMAIN;
  delete process.env.RESEND_API_KEY;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/config/features", () => ({
  features: { devAuthEnabled: true },
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { authOptions } from "@/lib/auth";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

type JwtCallback = NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>;
const jwtCallback = authOptions.callbacks!.jwt! as JwtCallback;

function runJwt(token: Record<string, unknown>, user?: { id: string }) {
  return jwtCallback({ token, user, trigger: undefined } as never);
}

/**
 * The jwt callback issues two distinct user.findUnique shapes: the local-
 * existence check (select { id }) and the userType backfill (select
 * { userType }). Route both through one mock keyed on the arguments.
 */
function mockUsers(db: Record<string, { id: string; userType?: string | null }>) {
  mocks.prisma.user.findUnique.mockImplementation(async (args: unknown) => {
    const { where } = args as { where: { id?: string } };
    const row = where.id ? db[where.id] : undefined;
    if (!row) return null;
    return { id: row.id, userType: row.userType ?? null };
  });
}

beforeEach(() => {
  mocks.prisma.user.findUnique.mockReset();
  mocks.prisma.user.upsert.mockReset();
});

describe("self-host cookie scoping", () => {
  it("uses dpocentral-prefixed cookie names under the local-auth posture", () => {
    expect(authOptions.cookies?.sessionToken?.name).toBe("dpocentral.session-token");
    expect(authOptions.cookies?.callbackUrl?.name).toBe("dpocentral.callback-url");
    expect(authOptions.cookies?.csrfToken?.name).toBe("dpocentral.csrf-token");
  });

  it("keeps cookies non-secure off https (suite serves plain http)", () => {
    expect(authOptions.cookies?.sessionToken?.options?.secure).toBe(false);
    expect(authOptions.cookies?.csrfToken?.options?.secure).toBe(false);
  });
});

describe("jwt callback re-anchoring", () => {
  it("leaves a token alone when its sub exists locally", async () => {
    mockUsers({ "local-1": { id: "local-1", userType: "COMPANY" } });
    const token = await runJwt({ sub: "local-1", email: "a@nel.test" });
    expect(token.sub).toBe("local-1");
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("remaps a foreign sub to the local user with the same email (JIT)", async () => {
    mockUsers({ "local-1": { id: "local-1", userType: "DPO" } });
    mocks.prisma.user.upsert.mockResolvedValueOnce({ id: "local-1" });
    const token = await runJwt({ sub: "foreign-1", email: "a@nel.test" });
    expect(token.sub).toBe("local-1");
    expect(token.id).toBe("local-1");
    // JIT upsert keyed by email, existing rows untouched.
    const upsertArg = mocks.prisma.user.upsert.mock.calls[0][0] as {
      where: { email: string };
      update: Record<string, unknown>;
    };
    expect(upsertArg.where).toEqual({ email: "a@nel.test" });
    expect(upsertArg.update).toEqual({});
  });

  it("clears the sub when a foreign token has no email to re-anchor with", async () => {
    mockUsers({});
    const token = await runJwt({ sub: "foreign-1" });
    expect(token.sub).toBeUndefined();
    expect(token.id).toBeUndefined();
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("skips the guard on fresh sign-in (the provider just verified the user)", async () => {
    mockUsers({ "local-1": { id: "local-1", userType: null } });
    const token = await runJwt(
      { sub: "local-1", email: "a@nel.test" },
      { id: "local-1" }
    );
    expect(token.sub).toBe("local-1");
    expect(mocks.prisma.user.upsert).not.toHaveBeenCalled();
    // Only the userType backfill hit the database — no existence check.
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledTimes(1);
    const arg = mocks.prisma.user.findUnique.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    expect(arg.select).toEqual({ userType: true });
  });
});

describe("protectedProcedure runtime id guard", () => {
  const router = createTRPCRouter({
    ping: protectedProcedure.query(() => "pong"),
  });

  it("rejects a session whose user has no id", async () => {
    const caller = router.createCaller({
      session: { user: { email: "a@nel.test" }, expires: "" },
      prisma: mocks.prisma,
      getCookie: () => undefined,
    } as never);
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("admits a session with a user id", async () => {
    const caller = router.createCaller({
      session: { user: { id: "local-1", email: "a@nel.test" }, expires: "" },
      prisma: mocks.prisma,
      getCookie: () => undefined,
    } as never);
    await expect(caller.ping()).resolves.toBe("pong");
  });
});
