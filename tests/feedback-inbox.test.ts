// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * In-app feedback is stored and nothing else.
 *
 * The storefront's daily digest reads the feedback table and mails it to
 * CONTACT_EMAIL, which is the inbox the operator already reads. An instant
 * copy was added on 2026-09-20 and removed the same day: it told that inbox
 * the same thing twice. These tests lock both halves of that decision — the
 * row is always written, and nothing is mailed from the mutation.
 *
 * A request for technical help is different and keeps its instant mail, since
 * a person is waiting for an answer. That contract is in
 * tests/internal-inbox.test.ts.
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

import { feedbackRouter } from "@/server/routers/feedback";
import { callerFor, sessionFor } from "./helpers";

const session = sessionFor("user-1", "asker@firm.test");

const anonymous = () =>
  callerFor(feedbackRouter, null) as ReturnType<typeof feedbackRouter.createCaller>;
const signedIn = () =>
  callerFor(feedbackRouter, session) as ReturnType<typeof feedbackRouter.createCaller>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("CONTACT_EMAIL", "owner@firm.test");
  vi.stubEnv("ADMIN_EMAILS", "ops@firm.test");
  mocks.send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
  mocks.prisma.feedback.create.mockResolvedValue({ id: "fb-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("in-app feedback", () => {
  it("stores the row, with the page it came from", async () => {
    await expect(
      signedIn().submit({
        message: "The vendor filter forgets itself.",
        page: "/privacy/vendors",
      })
    ).resolves.toEqual({ success: true });

    expect(mocks.prisma.feedback.create).toHaveBeenCalledOnce();
    expect(mocks.prisma.feedback.create.mock.calls[0][0]).toMatchObject({
      data: { message: "The vendor filter forgets itself.", page: "/privacy/vendors" },
    });
  });

  it("stores a note left by someone who is not signed in", async () => {
    await expect(anonymous().submit({ message: "a" })).resolves.toEqual({ success: true });
    expect(mocks.prisma.feedback.create).toHaveBeenCalledOnce();
  });

  it("sends no mail, so the daily digest is the only report of it", async () => {
    await signedIn().submit({ message: "a", page: "/privacy" });
    await anonymous().submit({ message: "b" });

    expect(mocks.send).not.toHaveBeenCalled();
  });
});
