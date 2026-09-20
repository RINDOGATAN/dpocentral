// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The feedback control used to write a row and stop, so every note anyone left
 * sat unread in the table. It now stores the row and copies it to our inbox,
 * with the page it came from, whether the sender was signed in, and the date.
 *
 * The row is the record. A mail failure — including an unconfigured mail
 * service — costs the copy, never the row, and is logged at error level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { feedback: { create: vi.fn() } },
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

import { DEFAULT_INTERNAL_INBOX } from "@/server/services/notifications/internal-inbox";
import { feedbackRouter } from "@/server/routers/feedback";
import { callerFor, sessionFor } from "./helpers";

const session = sessionFor("user-1", "asker@firm.test");

const anonymous = () =>
  callerFor(feedbackRouter, null) as ReturnType<typeof feedbackRouter.createCaller>;
const signedIn = () =>
  callerFor(feedbackRouter, session) as ReturnType<typeof feedbackRouter.createCaller>;

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
  mocks.prisma.feedback.create.mockResolvedValue({ id: "fb-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("in-app feedback", () => {
  it("is stored and copied to our inbox, with the page and the date", async () => {
    await signedIn().submit({
      message: "The vendor filter forgets itself.",
      page: "/privacy/vendors",
    });

    expect(mocks.prisma.feedback.create).toHaveBeenCalledOnce();

    const copy = inboxCall();
    expect(copy).toBeDefined();
    expect(copy.html).toContain("/privacy/vendors");
    expect(copy.html).toContain("The vendor filter forgets itself.");
    expect(copy.html).toContain(new Date().getFullYear().toString());
  });

  it("goes to ADMIN_EMAILS when that is set", async () => {
    vi.stubEnv("ADMIN_EMAILS", "ops@firm.test");
    await signedIn().submit({ message: "a" });

    const recipients = mocks.send.mock.calls.flatMap(([payload]) =>
      Array.isArray(payload.to) ? payload.to : [payload.to]
    );
    expect(recipients).toContain("ops@firm.test");
  });

  it("says whether the sender was signed in", async () => {
    await signedIn().submit({ message: "a" });
    expect(inboxCall().html).toContain(">yes</td>");

    vi.clearAllMocks();
    mocks.prisma.feedback.create.mockResolvedValue({ id: "fb-2" });
    mocks.send.mockResolvedValue({ data: { id: "mail-2" }, error: null });
    await anonymous().submit({ message: "a" });
    expect(inboxCall().html).toContain(">no</td>");
    expect(inboxCall().html).not.toContain(">yes</td>");
  });

  it("keeps the stored row when the mail service fails", async () => {
    mocks.send.mockRejectedValue(new Error("mail service down"));

    await expect(signedIn().submit({ message: "a" })).resolves.toEqual({ success: true });
    expect(mocks.prisma.feedback.create).toHaveBeenCalledOnce();
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it("keeps the stored row when the mail service is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(signedIn().submit({ message: "a" })).resolves.toEqual({ success: true });
    expect(mocks.prisma.feedback.create).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalled();
  });

  it("escapes what the sender wrote", async () => {
    await signedIn().submit({ message: '<script>alert("x")</script>', page: "/privacy" });
    expect(inboxCall().html).not.toContain("<script>");
  });
});
