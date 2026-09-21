/**
 * Cycle 12, found during the F2 sweep: experts.getContactRequest.
 *
 * The upstream record of a request holds the requester's name, address,
 * company and message, and is fetched with this product's own key. Any
 * signed-in account could read any of them by id, and the id went into the
 * URL path as typed. Now only a request recorded on an engagement of an
 * organisation the caller belongs to may be looked up.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { expertEngagement: { findFirst: vi.fn() } },
  getContactRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dealroom/client", async (original) => ({
  ...(await original<typeof import("@/server/services/dealroom/client")>()),
  getContactRequest: mocks.getContactRequest,
}));

import { expertsRouter } from "@/server/routers/privacy/experts";
import { callerFor, sessionFor } from "./helpers";

const as = (userId: string) =>
  callerFor(expertsRouter, sessionFor(userId)) as ReturnType<typeof expertsRouter.createCaller>;

beforeEach(() => {
  vi.clearAllMocks();
  // req-1 was recorded by an organisation that user-a belongs to.
  mocks.prisma.expertEngagement.findFirst.mockImplementation(
    async ({
      where,
    }: {
      where: { externalRequestId: string; organization: { members: { some: { userId: string } } } };
    }) =>
      where.externalRequestId === "req-1" && where.organization.members.some.userId === "user-a"
        ? { id: "eng-1" }
        : null
  );
  mocks.getContactRequest.mockResolvedValue({ requestId: "req-1", requesterEmail: "a@org-a.example" });
});

describe("experts.getContactRequest", () => {
  it("a stranger cannot read another organisation's request, and nothing is fetched upstream", async () => {
    await expect(as("stranger").getContactRequest({ requestId: "req-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.getContactRequest).not.toHaveBeenCalled();
  });

  it("an id typed to walk the upstream path is refused before any request is made", async () => {
    await expect(
      as("user-a").getContactRequest({ requestId: "../../admin/keys" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.getContactRequest).not.toHaveBeenCalled();
  });

  it("a member of the organisation that made the request can still read it", async () => {
    await expect(as("user-a").getContactRequest({ requestId: "req-1" })).resolves.toMatchObject({
      requestId: "req-1",
    });
    expect(mocks.getContactRequest).toHaveBeenCalledWith("req-1");
  });
});
