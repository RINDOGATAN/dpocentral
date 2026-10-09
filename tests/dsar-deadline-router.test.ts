// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The DSAR router sets due dates with the primary jurisdiction's rule:
 * calendar months for GDPR / UK GDPR, days for laws stated in days. A
 * statutory extension (no extensionDays given) applies the law's further
 * period. Stored due dates of existing requests are only read, never
 * recomputed.
 *
 * Prisma is module-mocked: we assert on what the router writes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    organizationJurisdiction: { findFirst: vi.fn() },
    dSARRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    dSARAuditLog: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({
  sendDSARConfirmationEmail: vi.fn(),
}));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({
  sendDSARCommunicationEmail: vi.fn(),
}));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { callerFor, sessionFor } from "./helpers";

const d = (y: number, m: number, day: number, h = 10) => new Date(y, m - 1, day, h, 0, 0);

function caller() {
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role: "OWNER",
    organization: { id: "org-a", name: "Org A", slug: "org-a" },
  });
  return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
}

function primary(code: string, dsarDeadlineDays: number) {
  mocks.prisma.organizationJurisdiction.findFirst.mockResolvedValue({
    isPrimary: true,
    jurisdiction: { code, dsarDeadlineDays },
  });
}

const NEW_REQUEST = {
  organizationId: "org-a",
  type: "ACCESS" as const,
  requesterName: "Requester",
  requesterEmail: "requester@test.example",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dSARRequest.create.mockImplementation(async ({ data }) => ({ id: "dsar-1", publicId: "P1", ...data }));
  mocks.prisma.dSARRequest.update.mockImplementation(async ({ data }) => ({ id: "dsar-1", ...data }));
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("create", () => {
  it("GDPR: one calendar month from receipt (31 January -> 28 February)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d(2026, 1, 31));
    primary("GDPR", 30);
    await caller().create(NEW_REQUEST);
    const { data } = mocks.prisma.dSARRequest.create.mock.calls[0][0];
    expect(data.dueDate).toEqual(d(2026, 2, 28));
  });

  it("UK GDPR in a leap year (31 January 2028 -> 29 February 2028)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d(2028, 1, 31));
    primary("UK-GDPR", 30);
    await caller().create(NEW_REQUEST);
    expect(mocks.prisma.dSARRequest.create.mock.calls[0][0].data.dueDate).toEqual(d(2028, 2, 29));
  });

  it("CCPA/CPRA keeps 45 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d(2026, 1, 31));
    primary("CCPA", 45);
    await caller().create(NEW_REQUEST);
    expect(mocks.prisma.dSARRequest.create.mock.calls[0][0].data.dueDate).toEqual(d(2026, 3, 17));
  });

  it("no primary jurisdiction: the GDPR rule, one month", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d(2026, 3, 31));
    mocks.prisma.organizationJurisdiction.findFirst.mockResolvedValue(null);
    await caller().create(NEW_REQUEST);
    expect(mocks.prisma.dSARRequest.create.mock.calls[0][0].data.dueDate).toEqual(d(2026, 4, 30));
  });
});

describe("extendDeadline", () => {
  function existing(receivedAt: Date, dueDate: Date) {
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
      id: "dsar-1",
      organizationId: "org-a",
      receivedAt,
      dueDate,
    });
  }

  it("GDPR statutory extension: three months from receipt", async () => {
    primary("GDPR", 30);
    existing(d(2026, 1, 31), d(2026, 2, 28));
    await caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "Complex request" });
    const { data } = mocks.prisma.dSARRequest.update.mock.calls[0][0];
    expect(data.dueDate).toEqual(d(2026, 4, 30));
    expect(data.extendedDueDate).toEqual(d(2026, 4, 30));
  });

  it("an existing request stored at receipt + 30 days: extended under the new rule, not rewritten otherwise", async () => {
    primary("GDPR", 30);
    existing(d(2026, 3, 1), d(2026, 3, 31));
    await caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "Complex request" });
    expect(mocks.prisma.dSARRequest.update.mock.calls[0][0].data.dueDate).toEqual(d(2026, 6, 1));
  });

  it("CCPA/CPRA statutory extension: 45 further days", async () => {
    primary("CCPA", 45);
    existing(d(2026, 1, 1), d(2026, 2, 15));
    await caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "Reasonably necessary" });
    expect(mocks.prisma.dSARRequest.update.mock.calls[0][0].data.dueDate).toEqual(d(2026, 4, 1));
  });

  it("a law without extension refuses the statutory extension", async () => {
    primary("LGPD", 15);
    existing(d(2026, 1, 1), d(2026, 1, 16));
    await expect(
      caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "x" })
    ).rejects.toThrow(/allows no extension/);
    expect(mocks.prisma.dSARRequest.update).not.toHaveBeenCalled();
  });

  it("a second statutory extension is refused", async () => {
    primary("GDPR", 30);
    existing(d(2026, 1, 31), d(2026, 4, 30));
    await expect(
      caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "x" })
    ).rejects.toThrow(/longest period/);
  });

  it("a request already extended is refused, and so is a closed one", async () => {
    primary("GDPR", 30);
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
      id: "dsar-1",
      organizationId: "org-a",
      status: "IN_PROGRESS",
      receivedAt: d(2026, 1, 31),
      dueDate: d(2026, 2, 28),
      extendedDueDate: d(2026, 3, 5),
    });
    await expect(
      caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "x" })
    ).rejects.toThrow(/longest period/);
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
      id: "dsar-1",
      organizationId: "org-a",
      status: "COMPLETED",
      receivedAt: d(2026, 1, 31),
      dueDate: d(2026, 2, 28),
      extendedDueDate: null,
    });
    await expect(
      caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "x" })
    ).rejects.toThrow(/closed/);
    expect(mocks.prisma.dSARRequest.update).not.toHaveBeenCalled();
  });

  it("the reason is required and recorded in the request's audit log", async () => {
    primary("GDPR", 30);
    existing(d(2026, 1, 31), d(2026, 2, 28));
    await expect(
      caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "" })
    ).rejects.toThrow();
    await caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", reason: "Several systems" });
    expect(mocks.prisma.dSARAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "DEADLINE_EXTENDED",
          details: expect.objectContaining({ reason: "Several systems", statutoryExtension: true }),
        }),
      })
    );
  });

  it("explicit extensionDays still adds days to the current due date", async () => {
    existing(d(2026, 1, 1), d(2026, 2, 1));
    await caller().extendDeadline({ organizationId: "org-a", id: "dsar-1", extensionDays: 10, reason: "x" });
    expect(mocks.prisma.dSARRequest.update.mock.calls[0][0].data.dueDate).toEqual(d(2026, 2, 11));
    expect(mocks.prisma.organizationJurisdiction.findFirst).not.toHaveBeenCalled();
  });
});
