/**
 * Cycle 12, F4: a sibling's token may identify the person; it never carries
 * platform-admin rights or any role across.
 *
 * The suite shares one signing secret, so a session minted by a sibling
 * decodes here and is re-attached to the local account with the same
 * address (the shared login, which stays). What it must NOT do is make that
 * session a platform admin: those rights require a sign-in this product
 * performed itself, and the address on the LOCAL user row.
 *
 * The real NextAuth callbacks and the real adminProcedure run over a mocked
 * Prisma.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

const ADMIN = "operator@admin.example";

const mocks = vi.hoisted(() => {
  process.env.ADMIN_EMAILS = "operator@admin.example";
  return {
    prisma: {
      user: { findUnique: vi.fn(), upsert: vi.fn() },
      skillPackage: { findMany: vi.fn() },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { authOptions } from "@/lib/auth";
import { platformAdminRouter } from "@/server/routers/platformAdmin";
import { callerFor } from "./helpers";

/** This product's own users table: one row, the operator's. */
const LOCAL_ROWS: Record<string, { id: string; email: string; userType: null }> = {
  "local-operator": { id: "local-operator", email: ADMIN, userType: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => LOCAL_ROWS[where.id] ?? null
  );
  // JIT: upsert by e-mail returns the existing local row
  mocks.prisma.user.upsert.mockResolvedValue({ id: "local-operator" });
  mocks.prisma.skillPackage.findMany.mockResolvedValue([]);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jwt = (args: Record<string, unknown>) => (authOptions.callbacks!.jwt as any)(args) as Promise<JWT>;
const sessionFrom = (token: JWT) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (authOptions.callbacks!.session as any)({
    session: { user: { email: token.email, name: null, image: null }, expires: "2099-01-01" },
    token,
  }) as Promise<Session>;

const admin = (session: Session) =>
  callerFor(platformAdminRouter, session) as ReturnType<typeof platformAdminRouter.createCaller>;

describe("a session minted by a sibling", () => {
  /** Signed with the shared secret, user id unknown here, the operator's address. */
  const siblingToken = (extra: Partial<JWT> = {}): JWT => ({
    sub: "user-id-from-a-sibling",
    email: ADMIN,
    name: "Whoever the sibling says",
    ...extra,
  });

  it("identifies the person (the shared login stays) but is refused platform admin", async () => {
    const token = await jwt({ token: siblingToken() });
    expect(token.sub).toBe("local-operator"); // re-attached by address
    expect(token.dpoSignIn).toBe(false);

    const session = await sessionFrom(token);
    expect(session.user.id).toBe("local-operator");
    expect(session.user.signedInHere).toBe(false);

    await expect(admin(session).listSkillPackages()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.skillPackage.findMany).not.toHaveBeenCalled();
    await expect(admin(session).isAdmin()).resolves.toEqual({ isAdmin: false });
  });

  it("cannot bring the stamp with it", async () => {
    const token = await jwt({ token: siblingToken({ dpoSignIn: true }) });
    expect(token.dpoSignIn).toBe(false);
    await expect(admin(await sessionFrom(token)).listSkillPackages()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("cannot bring an account type with it: it is re-read from the local row", async () => {
    const token = await jwt({
      token: siblingToken({ userType: "PRIVACY_PROFESSIONAL" as JWT["userType"] }),
    });
    expect(token.userType).toBeNull();
  });
});

describe("a sign-in this product performed itself", () => {
  it("is a platform admin when the LOCAL row's address is listed", async () => {
    const token = await jwt({
      token: { sub: "local-operator", email: ADMIN },
      user: { id: "local-operator", email: ADMIN },
    });
    expect(token.dpoSignIn).toBe(true);

    const session = await sessionFrom(token);
    await expect(admin(session).listSkillPackages()).resolves.toEqual([]);
    await expect(admin(session).isAdmin()).resolves.toEqual({ isAdmin: true });
  });

  it("keeps the stamp on later requests (no user object, known id)", async () => {
    const token = await jwt({ token: { sub: "local-operator", email: ADMIN, dpoSignIn: true } });
    expect(token.dpoSignIn).toBe(true);
  });

  it("is refused when only the token claims the address and the local row says otherwise", async () => {
    LOCAL_ROWS["local-other"] = { id: "local-other", email: "someone@else.example", userType: null };
    const session = await sessionFrom({ sub: "local-other", email: ADMIN, dpoSignIn: true });
    await expect(admin(session).listSkillPackages()).rejects.toMatchObject({ code: "FORBIDDEN" });
    delete LOCAL_ROWS["local-other"];
  });

  it("a session from before this release (no stamp) is refused until the next sign-in", async () => {
    const session = await sessionFrom({ sub: "local-operator", email: ADMIN });
    await expect(admin(session).listSkillPackages()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
