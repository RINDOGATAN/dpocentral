/**
 * Cycle 12, F1: the organisation domain claim.
 *
 * An organisation's domain drives the sign-in auto-join, so a stranger who
 * could store any domain could collect every later sign-in from it. Locks:
 *
 *  - create and update store a domain only when it equals the domain of the
 *    owner's own PROVEN address and is not a public provider; anything else
 *    is saved WITHOUT a domain (never refused on create);
 *  - the auto-join re-checks the stored domain against the owner's address
 *    today, and joins nobody where two organisations store one domain.
 *
 * Prisma is module-mocked: the real router, the real middleware chain and the
 * real NextAuth signIn callback run over it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    customer: { findUnique: vi.fn(), create: vi.fn() },
    customerOrganization: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/defaultIntakeForm", () => ({ ensureDefaultIntakeForm: vi.fn() }));

import { organizationRouter } from "@/server/routers/privacy/organization";
import { authOptions } from "@/lib/auth";
import { callerFor, sessionFor } from "./helpers";

type UserRow = {
  email: string;
  emailVerified: Date | null;
  accounts: { id: string }[];
};

/** The users this product knows, keyed by id. */
let users: Record<string, UserRow>;

const proven = (email: string): UserRow => ({ email, emailVerified: new Date(), accounts: [] });
const viaGoogle = (email: string): UserRow => ({ email, emailVerified: null, accounts: [{ id: "acc" }] });
/** A row minted from a sibling's token: no proof was ever seen here. */
const unproven = (email: string): UserRow => ({ email, emailVerified: null, accounts: [] });

beforeEach(() => {
  vi.clearAllMocks();
  users = {};
  mocks.prisma.user.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => users[where.id] ?? null
  );
  mocks.prisma.organization.findUnique.mockResolvedValue(null); // slug is free
  mocks.prisma.organization.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "org-new", ...data, members: [] })
  );
  mocks.prisma.organization.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "org-a", ...data })
  );
  mocks.prisma.organizationMember.count.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

function createAs(userId: string) {
  return callerFor(organizationRouter, sessionFor(userId)) as ReturnType<
    typeof organizationRouter.createCaller
  >;
}

const storedDomainOnCreate = () =>
  mocks.prisma.organization.create.mock.calls[0][0].data.domain;
const storedDomainOnUpdate = () =>
  mocks.prisma.organization.update.mock.calls[0][0].data.domain;

describe("organization.create: the domain is never taken on the caller's word", () => {
  it("a stranger claiming someone else's domain gets an organisation WITHOUT a domain", async () => {
    users["stranger"] = proven("stranger@elsewhere.example");

    const org = await createAs("stranger").create({
      name: "Looks Legit",
      slug: "looks-legit",
      domain: "victim-corp.example",
    });

    expect(org.id).toBe("org-new"); // created, never refused
    expect(storedDomainOnCreate()).toBeNull();
  });

  it("the creator's own proven domain is stored (magic link, lower-cased)", async () => {
    users["founder"] = proven("founder@Victim-Corp.example");

    await createAs("founder").create({
      name: "Victim Corp",
      slug: "victim-corp",
      domain: "VICTIM-CORP.example",
    });

    expect(storedDomainOnCreate()).toBe("victim-corp.example");
  });

  it("a linked Google account counts as proof", async () => {
    users["founder"] = viaGoogle("founder@victim-corp.example");
    await createAs("founder").create({ name: "V", slug: "vc", domain: "victim-corp.example" });
    expect(storedDomainOnCreate()).toBe("victim-corp.example");
  });

  it("an address this product never saw proven carries no domain", async () => {
    users["jit"] = unproven("ceo@victim-corp.example");
    await createAs("jit").create({ name: "V", slug: "vc", domain: "victim-corp.example" });
    expect(storedDomainOnCreate()).toBeNull();
  });

  it("a public mail provider is never stored, even when it is the creator's own", async () => {
    users["someone"] = proven("someone@gmail.com");
    await createAs("someone").create({ name: "G", slug: "gg", domain: "gmail.com" });
    expect(storedDomainOnCreate()).toBeNull();
  });

  it("a missing user row fails closed: no domain", async () => {
    await createAs("ghost").create({ name: "G", slug: "gg", domain: "victim-corp.example" });
    expect(storedDomainOnCreate()).toBeNull();
  });
});

describe("organization.update: the same rule, against the OWNER's address", () => {
  function adminOfOrgA(ownerId: string | null) {
    // Membership resolution in the middleware (the caller is an ADMIN).
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "member-admin",
      userId: "admin",
      organizationId: "org-a",
      role: "ADMIN",
      organization: { id: "org-a", name: "Org A", slug: "org-a" },
    });
    // The oldest OWNER of the organisation.
    mocks.prisma.organizationMember.findFirst.mockResolvedValue(
      ownerId ? { userId: ownerId } : null
    );
    return createAs("admin");
  }

  it("a domain that is not the owner's is saved as no domain", async () => {
    users["owner"] = proven("owner@elsewhere.example");
    await adminOfOrgA("owner").update({ organizationId: "org-a", domain: "victim-corp.example" });
    expect(storedDomainOnUpdate()).toBeNull();
  });

  it("the owner's own proven domain is stored", async () => {
    users["owner"] = proven("owner@victim-corp.example");
    await adminOfOrgA("owner").update({ organizationId: "org-a", domain: "victim-corp.example" });
    expect(storedDomainOnUpdate()).toBe("victim-corp.example");
    expect(mocks.prisma.organizationMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-a", role: "OWNER" },
      })
    );
  });

  it("an organisation with no owner fails closed", async () => {
    await adminOfOrgA(null).update({ organizationId: "org-a", domain: "victim-corp.example" });
    expect(storedDomainOnUpdate()).toBeNull();
  });

  it("a public provider is refused on every build, not only with the private package", async () => {
    users["owner"] = proven("owner@gmail.com");
    await expect(
      adminOfOrgA("owner").update({ organizationId: "org-a", domain: "gmail.com" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.prisma.organization.update).not.toHaveBeenCalled();
  });

  it("an update that does not mention the domain leaves it alone", async () => {
    await adminOfOrgA("owner").update({ organizationId: "org-a", name: "Renamed" });
    expect(storedDomainOnUpdate()).toBeUndefined();
  });
});

describe("sign-in auto-join", () => {
  const signIn = (email: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (authOptions.callbacks!.signIn as any)({ user: { id: "newcomer", email } });

  /** Organisations storing the domain, and who owns each. */
  function world(orgs: { id: string; domain: string; ownerId: string | null }[]) {
    mocks.prisma.organization.findMany.mockResolvedValue(orgs);
    // main's lookup (findFirst, no ordering) sees the same rows
    mocks.prisma.organization.findFirst.mockResolvedValue(orgs[0] ?? null);
    mocks.prisma.organizationMember.findFirst.mockImplementation(
      async ({ where }: { where: { organizationId: string; role?: string } }) => {
        if (where.role !== "OWNER") return null; // "already a member?" lookup
        const org = orgs.find((o) => o.id === where.organizationId);
        return org?.ownerId ? { userId: org.ownerId } : null;
      }
    );
  }

  it("does NOT join a newcomer to a stranger's organisation that stores their domain", async () => {
    users["stranger"] = proven("stranger@elsewhere.example");
    world([{ id: "org-squat", domain: "victim-corp.example", ownerId: "stranger" }]);

    await expect(signIn("newhire@victim-corp.example")).resolves.toBe(true);
    expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it("joins a newcomer to the one organisation whose owner proves the domain", async () => {
    users["founder"] = proven("founder@victim-corp.example");
    world([{ id: "org-real", domain: "victim-corp.example", ownerId: "founder" }]);

    await expect(signIn("newhire@Victim-Corp.example")).resolves.toBe(true);
    expect(mocks.prisma.organizationMember.create).toHaveBeenCalledWith({
      data: { organizationId: "org-real", userId: "newcomer", role: "MEMBER" },
    });
  });

  it("joins nobody where two organisations store the same domain", async () => {
    users["founder"] = proven("founder@victim-corp.example");
    users["colleague"] = proven("colleague@victim-corp.example");
    world([
      { id: "org-1", domain: "victim-corp.example", ownerId: "founder" },
      { id: "org-2", domain: "victim-corp.example", ownerId: "colleague" },
    ]);

    await expect(signIn("newhire@victim-corp.example")).resolves.toBe(true);
    expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it("joins nobody when the owner's address was never proven here", async () => {
    users["jit"] = unproven("ceo@victim-corp.example");
    world([{ id: "org-jit", domain: "victim-corp.example", ownerId: "jit" }]);

    await signIn("newhire@victim-corp.example");
    expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it("never joins on a public mail provider, on the open-source build too", async () => {
    users["someone"] = proven("someone@gmail.com");
    world([{ id: "org-g", domain: "gmail.com", ownerId: "someone" }]);

    await signIn("anyone@gmail.com");
    expect(mocks.prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it("asks for the claimants in a deterministic order (oldest first)", async () => {
    users["founder"] = proven("founder@victim-corp.example");
    world([{ id: "org-real", domain: "victim-corp.example", ownerId: "founder" }]);

    await signIn("newhire@victim-corp.example");
    expect(mocks.prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    );
  });
});
