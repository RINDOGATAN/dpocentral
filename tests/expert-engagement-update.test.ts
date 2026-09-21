/**
 * Cycle 12, F5: experts.updateEngagement answers with the same withheld shape
 * as the list, and is a write.
 *
 * The engagement row carries the listed person's private address
 * (expertEmail). listEngagements names its columns so the address never
 * leaves; updateEngagement returned the whole row, and any member, a VIEWER
 * included, could call it.
 *
 * The mocked `update` behaves as the database would: it hands back the whole
 * row unless the query names the columns it wants.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const THE_ADDRESS = "private-address@example.test";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    expertEngagement: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { expertsRouter } from "@/server/routers/privacy/experts";
import { callerFor, sessionFor } from "./helpers";

const ROW: Record<string, unknown> = {
  id: "eng-1",
  organizationId: "org-a",
  expertId: "expert-1",
  expertName: "The listed person",
  expertFirm: null,
  expertEmail: THE_ADDRESS,
  contactedById: "user-a",
  subject: "Help with a DPIA",
  message: "Hello",
  notes: null,
  status: "CONTACTED",
  contactedAt: new Date("2026-09-01"),
  updatedAt: new Date("2026-09-01"),
  closedAt: null,
  externalRequestId: null,
};

function memberOfOrgA(role: string) {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role,
    organization: { id: "org-a", name: "Org A", slug: "org-a" },
  });
  return callerFor(expertsRouter, sessionFor("user-a")) as ReturnType<
    typeof expertsRouter.createCaller
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.expertEngagement.findFirst.mockImplementation(
    async ({ where }: { where: { id: string; organizationId: string } }) =>
      where.id === ROW.id && where.organizationId === ROW.organizationId ? { id: ROW.id } : null
  );
  mocks.prisma.expertEngagement.update.mockImplementation(
    async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const row = { ...ROW, ...data };
      if (!select) return row; // the whole row, address included
      return Object.fromEntries(Object.keys(select).map((k) => [k, row[k] ?? null]));
    }
  );
});

const input = { organizationId: "org-a", engagementId: "eng-1", notes: "Called back" };

describe("experts.updateEngagement", () => {
  it("never returns the listed person's address", async () => {
    const result = await memberOfOrgA("MEMBER").updateEngagement(input);

    expect(result).not.toHaveProperty("expertEmail");
    expect(JSON.stringify(result)).not.toContain(THE_ADDRESS);
    expect(result).toMatchObject({ id: "eng-1", notes: "Called back" });
  });

  it("answers with exactly the columns the list answers with", async () => {
    mocks.prisma.expertEngagement.findMany.mockResolvedValue([]);
    const caller = memberOfOrgA("MEMBER");
    await caller.listEngagements({ organizationId: "org-a" });
    await caller.updateEngagement(input);

    const listSelect = mocks.prisma.expertEngagement.findMany.mock.calls[0][0].select;
    const updateSelect = mocks.prisma.expertEngagement.update.mock.calls[0][0].select;
    expect(updateSelect).toEqual(listSelect);
    expect(updateSelect).not.toHaveProperty("expertEmail");
  });

  it("refuses a VIEWER: reading the history is not permission to change it", async () => {
    await expect(memberOfOrgA("VIEWER").updateEngagement(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.prisma.expertEngagement.update).not.toHaveBeenCalled();
  });

  it("refuses someone who is not a member at all", async () => {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue(null);
    const stranger = callerFor(expertsRouter, sessionFor("stranger")) as ReturnType<
      typeof expertsRouter.createCaller
    >;
    await expect(stranger.updateEngagement(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.prisma.expertEngagement.update).not.toHaveBeenCalled();
  });

  it("an engagement of another organisation reads as not found", async () => {
    await expect(
      memberOfOrgA("OWNER").updateEngagement({ ...input, engagementId: "eng-in-org-b" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.prisma.expertEngagement.update).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER"])(
    "%s can still update, and closing stamps closedAt",
    async (role) => {
      const result = await memberOfOrgA(role).updateEngagement({ ...input, status: "COMPLETED" });
      expect(result.status).toBe("COMPLETED");
      expect(mocks.prisma.expertEngagement.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    }
  );
});
