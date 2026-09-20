// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Things a user sends to us must reach us.
 *
 * A request for technical help used to go to the expert, when their record
 * carried an address, and back to the person who asked. Nothing reached us, so
 * we never learned that a firm had asked. These tests lock the contract: the
 * request is stored, our inbox is among the recipients, every user-supplied
 * value is escaped, and a mail failure — including an unconfigured mail
 * service — loses neither the record nor the log line.
 *
 * The same contract for the feedback control is in tests/feedback-inbox.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    expertEngagement: { create: vi.fn() },
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

import {
  internalInboxAddresses,
  sendInternalNotice,
  DEFAULT_INTERNAL_INBOX,
} from "@/server/services/notifications/internal-inbox";
import { expertsRouter } from "@/server/routers/privacy/experts";
import { callerFor, sessionFor } from "./helpers";

const session = sessionFor("user-1", "asker@firm.test");

const request = {
  expertId: "technical-help-1",
  organizationId: "org-1",
  requesterName: "Asking Person",
  requesterEmail: "asker@firm.test",
  subject: "Help with the self-host bundle",
  message: "The migrator container exits before the seed runs.",
};

/** The message body of the call that went to our inbox. */
function inboxCall() {
  return mocks.send.mock.calls
    .map(([payload]) => payload)
    .find((payload) =>
      (Array.isArray(payload.to) ? payload.to : [payload.to]).includes(
        DEFAULT_INTERNAL_INBOX
      )
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("ADMIN_EMAILS", "");
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

describe("where our inbox is", () => {
  it("is every address in ADMIN_EMAILS when that is set", () => {
    vi.stubEnv("ADMIN_EMAILS", " first@firm.test , second@firm.test ");
    expect(internalInboxAddresses()).toEqual(["first@firm.test", "second@firm.test"]);
  });

  it("falls back to the standing address when ADMIN_EMAILS is empty", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(internalInboxAddresses()).toEqual([DEFAULT_INTERNAL_INBOX]);
  });
});

describe("a notice to our inbox", () => {
  it("escapes every user-supplied value", async () => {
    await sendInternalNotice({
      subject: "Test",
      intro: "Someone wrote in.",
      fields: [{ label: "Who asked", value: '<script>alert("x")</script>' }],
      body: "<img src=x onerror=1>",
      record: {},
    });

    const html = mocks.send.mock.calls[0][0].html as string;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("reports failure and logs it at error level rather than throwing", async () => {
    mocks.send.mockRejectedValue(new Error("mail service down"));

    await expect(
      sendInternalNotice({ subject: "Test", intro: "x", fields: [], record: { id: "row-1" } })
    ).resolves.toEqual({ delivered: false, to: [DEFAULT_INTERNAL_INBOX] });
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it("treats an unconfigured mail service as a loud failure, not a quiet skip", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await sendInternalNotice({
      subject: "Test",
      intro: "x",
      fields: [],
      record: { id: "row-1" },
    });

    expect(result.delivered).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});

describe("a request for technical help", () => {
  const caller = () =>
    callerFor(expertsRouter, session) as ReturnType<typeof expertsRouter.createCaller>;

  it("is stored and copied to our inbox", async () => {
    await caller().contact(request);

    expect(mocks.prisma.expertEngagement.create).toHaveBeenCalledOnce();

    const copy = inboxCall();
    expect(copy).toBeDefined();
    expect(copy.replyTo).toBe(request.requesterEmail);
    expect(copy.subject).toContain(request.subject);
    expect(copy.html).toContain("Asking Person");
    expect(copy.html).toContain("Asking Firm");
    expect(copy.html).toContain("asker@firm.test");
    expect(copy.html).toContain("migrator container");
  });

  it("goes to ADMIN_EMAILS when that is set", async () => {
    vi.stubEnv("ADMIN_EMAILS", "ops@firm.test");
    await caller().contact(request);

    const recipients = mocks.send.mock.calls.flatMap(([payload]) =>
      Array.isArray(payload.to) ? payload.to : [payload.to]
    );
    expect(recipients).toContain("ops@firm.test");
  });

  it("keeps the stored record when the mail service is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(caller().contact(request)).resolves.toBeDefined();
    expect(mocks.prisma.expertEngagement.create).toHaveBeenCalledOnce();
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it("keeps the stored record when the mail service fails", async () => {
    mocks.send.mockRejectedValue(new Error("mail service down"));

    await expect(caller().contact(request)).resolves.toBeDefined();
    expect(mocks.prisma.expertEngagement.create).toHaveBeenCalledOnce();
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it("still copies the request to our inbox when nothing could be stored", async () => {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue(null);

    await caller().contact(request);

    expect(mocks.prisma.expertEngagement.create).not.toHaveBeenCalled();
    expect(inboxCall()).toBeDefined();
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});
