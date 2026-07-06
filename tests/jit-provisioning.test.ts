/**
 * Hermetic unit tests for JIT user provisioning (identity model A).
 * Prisma is mocked — no database, no network. Asserts the upsert-by-email
 * contract: existing rows untouched, absent rows minted from claims.
 */

import { describe, it, expect, vi } from "vitest";
import { ensureDpoUser } from "@/lib/jit-provisioning";

function mockPrisma(upsertImpl: (args: unknown) => Promise<{ id: string }>) {
  const upsert = vi.fn(upsertImpl);
  // Only the `user.upsert` surface is exercised by ensureDpoUser.
  return { prisma: { user: { upsert } } as never, upsert };
}

describe("ensureDpoUser", () => {
  it("upserts by email and returns the local user id", async () => {
    const { prisma, upsert } = mockPrisma(async () => ({ id: "dpo-user-1" }));

    const result = await ensureDpoUser(prisma, {
      email: "sso@example.com",
      name: "SSO User",
      picture: "https://cdn.example.com/a.png",
    });

    expect(result).toEqual({ id: "dpo-user-1" });
    expect(upsert).toHaveBeenCalledTimes(1);

    const arg = upsert.mock.calls[0][0] as {
      where: { email: string };
      update: Record<string, unknown>;
      create: { email: string; name: string | null; image: string | null };
      select: { id: true };
    };
    // Keyed by email; existing rows left untouched (empty update).
    expect(arg.where).toEqual({ email: "sso@example.com" });
    expect(arg.update).toEqual({});
    // New rows minted from the token claims.
    expect(arg.create).toEqual({
      email: "sso@example.com",
      name: "SSO User",
      image: "https://cdn.example.com/a.png",
    });
    expect(arg.select).toEqual({ id: true });
  });

  it("normalizes missing name/picture claims to null", async () => {
    const { prisma, upsert } = mockPrisma(async () => ({ id: "dpo-user-2" }));

    await ensureDpoUser(prisma, { email: "bare@example.com" });

    const arg = upsert.mock.calls[0][0] as {
      create: { email: string; name: string | null; image: string | null };
    };
    expect(arg.create).toEqual({
      email: "bare@example.com",
      name: null,
      image: null,
    });
  });
});
