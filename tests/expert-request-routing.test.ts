// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A request for technical help goes to us and only to us.
 *
 * The directory record here deliberately carries an address, because the one
 * local entry has none: even when an address is known, nothing is mailed to
 * it, and it is never read back to a client. We keep it on our own row so we
 * can contact the person ourselves.
 *
 * Where our inbox is, and what happens when mail fails, is in
 * tests/internal-inbox.test.ts. What the directory returns is in
 * tests/expert-address-private.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const THE_ADDRESS = "private-address@example.test";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    expertEngagement: { create: vi.fn(), findMany: vi.fn() },
  },
  send: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

// A directory whose record carries an address. Only the two functions the
// contact mutation uses are needed.
vi.mock("@/server/services/dealroom/client", () => ({
  getExpertRecord: async () => ({
    id: "the-person",
    name: "The Person Listed",
    email: THE_ADDRESS,
    firm: "A Firm",
    title: null,
    bio: null,
    expertTypes: ["technical"],
    specializations: [],
    certifications: [],
    languages: ["en"],
    location: { city: null, country: null },
    jurisdictions: [],
    contactUrl: null,
    imageUrl: null,
    acceptingClients: true,
    profileCompleteness: 60,
  }),
  contactExpert: async () => ({
    requestId: "req-1",
    status: "pending",
    createdAt: new Date().toISOString(),
  }),
  searchExperts: async () => ({ results: [], total: 0, offset: 0 }),
  getExpertById: async () => null,
  getSpecializations: () => [],
  getCountries: () => [],
  getLanguages: () => [],
  getExpertTypes: () => [],
  getContactRequest: async () => null,
}));

import { expertsRouter } from "@/server/routers/privacy/experts";
import { callerFor, sessionFor } from "./helpers";

const session = sessionFor("user-1", "asker@firm.test");
const caller = () =>
  callerFor(expertsRouter, session) as ReturnType<typeof expertsRouter.createCaller>;

const request = {
  expertId: "the-person",
  organizationId: "org-1",
  requesterName: "Asking Person",
  requesterEmail: "asker@firm.test",
  subject: "Help with the self-host bundle",
  message: "The migrator container exits before the seed runs.",
};

/** Every address any mail was sent to. */
function recipients(): string[] {
  return mocks.send.mock.calls.flatMap(([payload]) =>
    Array.isArray(payload.to) ? payload.to : [payload.to]
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("CONTACT_EMAIL", "owner@firm.test");
  vi.stubEnv("ADMIN_EMAILS", "ops@firm.test");
  mocks.send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    organizationId: "org-1",
    userId: "user-1",
    role: "OWNER",
    organization: { name: "Asking Firm" },
  });
  mocks.prisma.expertEngagement.create.mockResolvedValue({ id: "eng-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a request for technical help", () => {
  it("goes to CONTACT_EMAIL, with the confirmation back to the person who asked", async () => {
    await caller().contact(request);

    expect(recipients()).toEqual(
      expect.arrayContaining(["owner@firm.test", "asker@firm.test"])
    );
    expect(recipients()).toHaveLength(2);
    expect(recipients()).not.toContain("ops@firm.test");
  });

  it("is mailed to nobody else, whatever address the record carries", async () => {
    await caller().contact(request);

    expect(recipients()).not.toContain(THE_ADDRESS);
    expect(JSON.stringify(mocks.send.mock.calls)).not.toContain(THE_ADDRESS);
  });

  it("carries who asked, their organisation, the subject and the date", async () => {
    await caller().contact(request);

    const notice = mocks.send.mock.calls
      .map(([payload]) => payload)
      .find((payload) => (payload.to as string[]).includes?.("owner@firm.test"));

    expect(notice.replyTo).toBe(request.requesterEmail);
    expect(notice.html).toContain("Asking Person");
    expect(notice.html).toContain("Asking Firm");
    expect(notice.html).toContain("asker@firm.test");
    expect(notice.html).toContain(request.subject);
    expect(notice.html).toContain("migrator container");
    expect(notice.html).toContain(new Date().getFullYear().toString());
  });

  it("escapes what the person who asked typed", async () => {
    await caller().contact({
      ...request,
      requesterName: '<script>alert("x")</script>',
      message: "<img src=x onerror=1>",
    });

    for (const [payload] of mocks.send.mock.calls) {
      expect(payload.html).not.toContain("<script>");
      expect(payload.html).not.toContain("<img");
    }
  });

  it("stores the address on our own row, so we can reach the person", async () => {
    await caller().contact(request);

    expect(mocks.prisma.expertEngagement.create.mock.calls[0][0]).toMatchObject({
      data: { expertEmail: THE_ADDRESS },
    });
  });

  it("never reads the address back to a client in the engagement history", async () => {
    mocks.prisma.expertEngagement.findMany.mockResolvedValue([]);

    await caller().listEngagements({ organizationId: "org-1" });

    const query = mocks.prisma.expertEngagement.findMany.mock.calls[0][0];
    expect(query.select).toBeDefined();
    expect(query.include).toBeUndefined();
    expect(query.select.expertEmail).toBeUndefined();
  });
});
