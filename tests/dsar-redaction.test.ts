// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Redaction of a closed rights request clears every field that can hold the
 * data subject's personal data, through both doors: the manual action
 * (dsar.redactDSAR) and the nightly retention cron. JSON columns are cleared
 * with Prisma.DbNull: `undefined` means "leave unchanged" to Prisma, which is
 * how attachments and data exports used to survive.
 *
 * Kept for the audit trail: type, status, dates, public reference, task titles
 * and statuses, and `redactedAt` as the marker. The 90-day retention rule is
 * unchanged.
 *
 * Prisma is module-mocked: we assert on what is written.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    organization: { findMany: vi.fn() },
    dSARIntakeForm: { findFirst: vi.fn() },
    dSARRequest: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    dSARCommunication: { updateMany: vi.fn() },
    dSARTask: { updateMany: vi.fn() },
    dSARAuditLog: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/services/dsar/sendConfirmationEmail", () => ({ sendDSARConfirmationEmail: vi.fn() }));
vi.mock("@/server/services/dsar/sendCommunicationEmail", () => ({ sendDSARCommunicationEmail: vi.fn() }));

import { dsarRouter } from "@/server/routers/privacy/dsar";
import { GET as cronGET } from "@/app/api/cron/dsar-redaction/route";
import { callerFor, sessionFor } from "./helpers";

/** Every DSARRequest column that can hold personal data, and what it becomes. */
const REQUEST_CLEARED = {
  requesterName: "REDACTED",
  requesterEmail: "redacted@redacted",
  requesterPhone: null,
  requesterAddress: null,
  relationship: null,
  description: null,
  requestedData: null,
  verificationMethod: null,
  extensionReason: null,
  responseNotes: null,
  metadata: Prisma.DbNull,
};
const COMMUNICATION_CLEARED = {
  content: "REDACTED",
  subject: null,
  attachments: Prisma.DbNull,
  metadata: Prisma.DbNull,
};
const TASK_CLEARED = { dataExport: Prisma.DbNull, notes: null, description: null };

/** Columns the audit trail keeps: never written by a redaction. */
const KEPT = [
  "type", "status", "publicId", "receivedAt", "acknowledgedAt", "dueDate", "completedAt",
  "verifiedAt", "extendedDueDate", "responseMethod", "organizationId", "createdAt",
];

/** No Prisma write in a redaction may carry `undefined` (it means "unchanged"). */
function expectNoUndefined(data: Record<string, unknown>) {
  for (const [k, v] of Object.entries(data)) expect(v, `field ${k}`).not.toBeUndefined();
}

function expectFullRedaction(id: string, at: Date) {
  // The request row: every personal field, and the marker.
  const reqUpdate = mocks.prisma.dSARRequest.update.mock.calls.find((c) => c[0].where.id === id)?.[0];
  expect(reqUpdate).toBeDefined();
  expect(reqUpdate.data).toEqual({ ...REQUEST_CLEARED, redactedAt: at });
  expectNoUndefined(reqUpdate.data);
  for (const k of KEPT) expect(reqUpdate.data).not.toHaveProperty(k);

  // Messages: content, subject, attachment links, metadata.
  expect(mocks.prisma.dSARCommunication.updateMany).toHaveBeenCalledWith({
    where: { dsarRequestId: id },
    data: COMMUNICATION_CLEARED,
  });
  // Tasks: the gathered data export, notes, description.
  expect(mocks.prisma.dSARTask.updateMany).toHaveBeenCalledWith({
    where: { dsarRequestId: id },
    data: TASK_CLEARED,
  });
  for (const call of [
    ...mocks.prisma.dSARCommunication.updateMany.mock.calls,
    ...mocks.prisma.dSARTask.updateMany.mock.calls,
  ]) {
    expectNoUndefined(call[0].data);
  }

  // Free text in the request's own trail.
  expect(mocks.prisma.dSARAuditLog.update).toHaveBeenCalledWith({
    where: { id: "log-status" },
    data: { details: { from: "IN_PROGRESS", to: "COMPLETED", notes: "REDACTED" } },
  });
  expect(mocks.prisma.dSARAuditLog.update).toHaveBeenCalledWith({
    where: { id: "log-extend" },
    data: {
      details: { originalDue: "2026-01-01", newDue: "2026-03-01", reason: "REDACTED", statutoryExtension: true },
    },
  });
  // An entry with no free text is left alone.
  expect(mocks.prisma.dSARAuditLog.update).not.toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "log-plain" } })
  );

  // The organisation log's "created" entry copied the whole form.
  expect(mocks.prisma.auditLog.updateMany).toHaveBeenCalledWith({
    where: { organizationId: "org-a", entityType: "DSARRequest", entityId: id, action: "CREATE" },
    data: { changes: { redacted: true } },
  });

  // The marker is written after the related rows (a half-done run is redone).
  const requestOrder = mocks.prisma.dSARRequest.update.mock.invocationCallOrder[0];
  expect(requestOrder).toBeGreaterThan(mocks.prisma.dSARCommunication.updateMany.mock.invocationCallOrder[0]);
  expect(requestOrder).toBeGreaterThan(mocks.prisma.dSARTask.updateMany.mock.invocationCallOrder[0]);
  expect(requestOrder).toBeGreaterThan(mocks.prisma.auditLog.updateMany.mock.invocationCallOrder[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.dSARRequest.update.mockResolvedValue({});
  mocks.prisma.dSARCommunication.updateMany.mockResolvedValue({ count: 2 });
  mocks.prisma.dSARTask.updateMany.mockResolvedValue({ count: 2 });
  mocks.prisma.dSARAuditLog.findMany.mockResolvedValue([
    { id: "log-status", details: { from: "IN_PROGRESS", to: "COMPLETED", notes: "Called the requester at home" } },
    {
      id: "log-extend",
      details: { originalDue: "2026-01-01", newDue: "2026-03-01", reason: "Requester's records in archive", statutoryExtension: true },
    },
    { id: "log-plain", details: { from: "SUBMITTED", to: "IN_PROGRESS", notes: null } },
  ]);
  mocks.prisma.dSARAuditLog.update.mockResolvedValue({});
  mocks.prisma.dSARAuditLog.create.mockResolvedValue({});
  mocks.prisma.auditLog.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("manual redaction (dsar.redactDSAR)", () => {
  function asOwner() {
    mocks.prisma.organizationMember.findUnique.mockResolvedValue({
      id: "member-a",
      userId: "user-a",
      organizationId: "org-a",
      role: "OWNER",
      organization: { id: "org-a", name: "Org A", slug: "org-a", pilotStartedAt: null },
    });
    return callerFor(dsarRouter, sessionFor("user-a")) as ReturnType<typeof dsarRouter.createCaller>;
  }

  it("clears every personal field of the request, its messages, its tasks and its trail", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-10-09T12:00:00Z");
    vi.setSystemTime(now);
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({
      id: "dsar-1",
      organizationId: "org-a",
      status: "COMPLETED",
      redactedAt: null,
    });
    await asOwner().redactDSAR({ organizationId: "org-a", id: "dsar-1" });
    vi.useRealTimers();

    expectFullRedaction("dsar-1", now);
    expect(mocks.prisma.dSARAuditLog.create).toHaveBeenCalledWith({
      data: {
        dsarRequestId: "dsar-1",
        action: "PII_REDACTED",
        performedBy: "user-a",
        details: { reason: "manual_redaction" },
      },
    });
  });

  it("still refuses an open request and a request already redacted", async () => {
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({ id: "dsar-1", status: "IN_PROGRESS", redactedAt: null });
    await expect(asOwner().redactDSAR({ organizationId: "org-a", id: "dsar-1" })).rejects.toThrow();
    mocks.prisma.dSARRequest.findFirst.mockResolvedValue({ id: "dsar-1", status: "COMPLETED", redactedAt: new Date() });
    await expect(asOwner().redactDSAR({ organizationId: "org-a", id: "dsar-1" })).rejects.toThrow();
    expect(mocks.prisma.dSARRequest.update).not.toHaveBeenCalled();
    expect(mocks.prisma.dSARTask.updateMany).not.toHaveBeenCalled();
  });
});

describe("nightly retention cron", () => {
  const SECRET = "test-cron-secret";

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    mocks.prisma.organization.findMany.mockResolvedValue([{ id: "org-a" }]);
  });

  it("clears every personal field, the same as the manual action", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-10-09T03:00:00Z");
    vi.setSystemTime(now);
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue(null);
    mocks.prisma.dSARRequest.findMany.mockResolvedValue([{ id: "dsar-9" }]);

    const res = await cronGET(
      new Request("http://localhost/api/cron/dsar-redaction", { headers: { authorization: `Bearer ${SECRET}` } })
    );
    vi.useRealTimers();
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toEqual({ dsarRedacted: 1, errors: 0 });

    expectFullRedaction("dsar-9", now);
    expect(mocks.prisma.dSARAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ dsarRequestId: "dsar-9", action: "PII_AUTO_REDACTED", performedBy: "SYSTEM" }),
    });
  });

  it("keeps the retention rule: 90 days after closing by default, unredacted closed requests only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const now = new Date("2026-10-09T03:00:00Z");
    vi.setSystemTime(now);
    mocks.prisma.dSARIntakeForm.findFirst.mockResolvedValue(null);
    mocks.prisma.dSARRequest.findMany.mockResolvedValue([]);
    await cronGET(
      new Request("http://localhost/api/cron/dsar-redaction", { headers: { authorization: `Bearer ${SECRET}` } })
    );
    vi.useRealTimers();
    expect(mocks.prisma.dSARRequest.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-a",
        status: { in: ["COMPLETED", "CANCELLED", "REJECTED"] },
        completedAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        redactedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.prisma.dSARRequest.update).not.toHaveBeenCalled();
  });

  it("still fails closed without the secret", async () => {
    delete process.env.CRON_SECRET;
    const res = await cronGET(new Request("http://localhost/api/cron/dsar-redaction"));
    expect(res.status).toBe(503);
    expect(mocks.prisma.dSARRequest.update).not.toHaveBeenCalled();
  });
});
