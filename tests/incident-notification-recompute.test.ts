// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GDPR Art. 33: the breach notification flag and the deadline follow the
 * facts. incident.update recomputes `notificationRequired` and
 * `notificationDeadline` whenever severity, data categories, records
 * affected, discovery time or jurisdiction change; creates the PENDING
 * authority notifications when the incident becomes notifiable with none
 * recorded; moves the deadline of notifications still PENDING when the
 * discovery time is corrected; and records the change on the timeline.
 * An update of other fields leaves the flag alone.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    organizationMember: { findUnique: vi.fn() },
    incident: { findFirst: vi.fn(), updateMany: vi.fn() },
    jurisdiction: { findUnique: vi.fn(), findMany: vi.fn() },
    organizationJurisdiction: { findMany: vi.fn() },
    incidentNotification: { create: vi.fn(), updateMany: vi.fn() },
    incidentTimelineEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma, prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/security", () => ({ getSecurityModule: () => null }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { incidentRouter } from "@/server/routers/privacy/incident";
import {
  mergeNotificationFacts,
  notificationRequiredFor,
  recomputeNotification,
  touchesNotificationFacts,
} from "@/server/services/incidents/notification-assessment";
import { parseSystemTimelineTitle } from "@/lib/incident-timeline";
import { callerFor, sessionFor } from "./helpers";

const ORG = { id: "org-a", name: "Org A", slug: "org-a" };
const DISCOVERED = new Date("2026-10-01T10:00:00Z");
const H = 60 * 60 * 1000;

type Stored = {
  severity: string;
  dataCategories: string[];
  affectedRecords: number | null;
  discoveredAt: Date;
  jurisdictionId: string | null;
  notificationRequired: boolean;
  notificationDeadline: Date | null;
  notifications: { id: string; jurisdictionId: string; status: string; deadline: Date }[];
};

function stored(over: Partial<Stored> = {}): Stored {
  return {
    severity: "LOW",
    dataCategories: ["IDENTIFIERS"],
    affectedRecords: 10,
    discoveredAt: DISCOVERED,
    jurisdictionId: "j-gdpr",
    notificationRequired: false,
    notificationDeadline: null,
    notifications: [],
    ...over,
  };
}

function caller() {
  return callerFor(incidentRouter, sessionFor("user-a")) as ReturnType<typeof incidentRouter.createCaller>;
}

function updateData() {
  return mocks.prisma.incident.updateMany.mock.calls[0][0].data as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.incident.findFirst.mockReset();
  mocks.prisma.organizationMember.findUnique.mockResolvedValue({
    id: "member-a",
    userId: "user-a",
    organizationId: "org-a",
    role: "PRIVACY_OFFICER",
    organization: ORG,
  });
  mocks.prisma.incident.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.jurisdiction.findUnique.mockResolvedValue({ breachNotificationHours: 72 });
  mocks.prisma.jurisdiction.findMany.mockResolvedValue([{ id: "j-gdpr", breachNotificationHours: 72 }]);
  mocks.prisma.organizationJurisdiction.findMany.mockResolvedValue([
    { jurisdictionId: "j-gdpr", jurisdiction: { breachNotificationHours: 72 } },
  ]);
  mocks.prisma.incidentNotification.create.mockResolvedValue({});
  mocks.prisma.incidentNotification.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.incidentTimelineEntry.create.mockResolvedValue({});
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe("incident.update recomputes the Art. 33 flag and deadline", () => {
  it("raising the severity to CRITICAL flags the incident and sets the 72-hour deadline", async () => {
    mocks.prisma.incident.findFirst.mockResolvedValueOnce(stored()).mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", severity: "CRITICAL" });
    const data = updateData();
    expect(data.notificationRequired).toBe(true);
    expect((data.notificationDeadline as Date).getTime()).toBe(DISCOVERED.getTime() + 72 * H);
    // No notification recorded yet: the PENDING authority notification is created.
    expect(mocks.prisma.incidentNotification.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.incidentNotification.create.mock.calls[0][0].data).toMatchObject({
      incidentId: "inc-1",
      jurisdictionId: "j-gdpr",
      recipientType: "DPA",
      status: "PENDING",
      deadline: new Date(DISCOVERED.getTime() + 72 * H),
    });
    const entry = mocks.prisma.incidentTimelineEntry.create.mock.calls[0][0].data;
    expect(parseSystemTimelineTitle(entry.title)).toEqual({ kind: "notificationNowRequired" });
    // The audit entry carries the recomputed values.
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.changes).toMatchObject({ notificationRequired: true });
  });

  it("adding a special category flags the incident", async () => {
    mocks.prisma.incident.findFirst.mockResolvedValueOnce(stored()).mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", dataCategories: ["IDENTIFIERS", "HEALTH"] });
    expect(updateData().notificationRequired).toBe(true);
  });

  it("raising the records affected to 500 flags the incident", async () => {
    mocks.prisma.incident.findFirst.mockResolvedValueOnce(stored()).mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", affectedRecords: 500 });
    expect(updateData().notificationRequired).toBe(true);
  });

  it("a corrected discovery time moves the incident deadline and every PENDING notification, not a drafted one", async () => {
    const corrected = new Date("2026-09-29T08:00:00Z");
    mocks.prisma.incident.findFirst
      .mockResolvedValueOnce(
        stored({
          severity: "HIGH",
          notificationRequired: true,
          notificationDeadline: new Date(DISCOVERED.getTime() + 72 * H),
          notifications: [
            { id: "n-pending", jurisdictionId: "j-gdpr", status: "PENDING", deadline: new Date(DISCOVERED.getTime() + 72 * H) },
            { id: "n-drafted", jurisdictionId: "j-gdpr", status: "DRAFTED", deadline: new Date(DISCOVERED.getTime() + 72 * H) },
          ],
        }),
      )
      .mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", discoveredAt: corrected });
    const data = updateData();
    expect(data.notificationRequired).toBe(true);
    expect((data.notificationDeadline as Date).getTime()).toBe(corrected.getTime() + 72 * H);
    expect(mocks.prisma.incidentNotification.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.incidentNotification.updateMany.mock.calls[0][0]).toEqual({
      where: { id: "n-pending", incidentId: "inc-1", status: "PENDING" },
      data: { deadline: new Date(corrected.getTime() + 72 * H) },
    });
    // Rows exist already: none is added.
    expect(mocks.prisma.incidentNotification.create).not.toHaveBeenCalled();
    const entry = mocks.prisma.incidentTimelineEntry.create.mock.calls[0][0].data;
    expect(parseSystemTimelineTitle(entry.title)).toEqual({ kind: "notificationDeadlineRecalculated" });
  });

  it("lowering the facts below the rule clears the flag and the deadline, and keeps recorded notifications", async () => {
    mocks.prisma.incident.findFirst
      .mockResolvedValueOnce(
        stored({
          severity: "HIGH",
          notificationRequired: true,
          notificationDeadline: new Date(DISCOVERED.getTime() + 72 * H),
          notifications: [{ id: "n1", jurisdictionId: "j-gdpr", status: "PENDING", deadline: DISCOVERED }],
        }),
      )
      .mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", severity: "LOW" });
    const data = updateData();
    expect(data.notificationRequired).toBe(false);
    expect(data.notificationDeadline).toBeNull();
    const entry = mocks.prisma.incidentTimelineEntry.create.mock.calls[0][0].data;
    expect(parseSystemTimelineTitle(entry.title)).toEqual({ kind: "notificationNoLongerRequired" });
  });

  it("without a jurisdiction the flag is set and the deadline left to the 72-hour window", async () => {
    mocks.prisma.incident.findFirst
      .mockResolvedValueOnce(stored({ jurisdictionId: null }))
      .mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", severity: "HIGH" });
    expect(updateData()).toMatchObject({ notificationRequired: true, notificationDeadline: null });
  });

  it("an update of other fields leaves the flag and the notifications alone", async () => {
    mocks.prisma.incident.findFirst.mockResolvedValueOnce(stored()).mockResolvedValueOnce({ id: "inc-1" });
    await caller().update({ organizationId: "org-a", id: "inc-1", title: "Renamed", rootCause: "Phishing" });
    const data = updateData();
    expect(data).not.toHaveProperty("notificationRequired");
    expect(data).not.toHaveProperty("notificationDeadline");
    expect(mocks.prisma.incidentNotification.create).not.toHaveBeenCalled();
    expect(mocks.prisma.incidentTimelineEntry.create).not.toHaveBeenCalled();
  });

  it("an incident of another organisation is not found and nothing is written", async () => {
    mocks.prisma.incident.findFirst.mockResolvedValueOnce(null);
    await expect(caller().update({ organizationId: "org-a", id: "inc-b", severity: "HIGH" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.prisma.incident.findFirst.mock.calls[0][0].where).toEqual({ id: "inc-b", organizationId: "org-a" });
    expect(mocks.prisma.incident.updateMany).not.toHaveBeenCalled();
  });
});

describe("the pure rule", () => {
  it("is the rule create applies", () => {
    expect(notificationRequiredFor({ severity: "MEDIUM", dataCategories: [], affectedRecords: 499 })).toBe(false);
    expect(notificationRequiredFor({ severity: "MEDIUM", dataCategories: [], affectedRecords: 500 })).toBe(true);
    expect(notificationRequiredFor({ severity: "HIGH", dataCategories: [], affectedRecords: null })).toBe(true);
    expect(notificationRequiredFor({ severity: "LOW", dataCategories: ["BIOMETRIC"] })).toBe(true);
  });

  it("merges an update over the stored facts (null clears, undefined keeps)", () => {
    const s = stored({ affectedRecords: 900 });
    expect(mergeNotificationFacts(s, { affectedRecords: null }).affectedRecords).toBeNull();
    expect(mergeNotificationFacts(s, {}).affectedRecords).toBe(900);
    expect(recomputeNotification(mergeNotificationFacts(s, { affectedRecords: null }), 72).notificationRequired).toBe(false);
  });

  it("knows which fields matter", () => {
    expect(touchesNotificationFacts({ title: "x" })).toBe(false);
    expect(touchesNotificationFacts({ discoveredAt: new Date() })).toBe(true);
    expect(touchesNotificationFacts({ jurisdictionId: null })).toBe(true);
  });
});
