// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A jurisdiction whose catalogue entry records 0 breach-notification hours
 * (the US state laws, among others) sets no fixed window for notifying the
 * authority. Such a jurisdiction must never produce a deadline at the time
 * of discovery, which reads as "overdue" the moment the incident is recorded:
 * no pending authority notification is created for it, and the incident-level
 * deadline stays empty so the 72-hour view applies.
 */

import { describe, it, expect, vi } from "vitest";
import {
  hasFixedAuthorityWindow,
  recomputeNotification,
} from "@/server/services/incidents/notification-assessment";
import { createPendingAuthorityNotifications } from "@/server/services/incidents/authority-notifications";

const facts = {
  severity: "HIGH",
  dataCategories: ["IDENTIFIERS"],
  affectedRecords: 1200,
  discoveredAt: new Date("2026-10-30T09:30:00Z"),
  jurisdictionId: "ccpa",
};

describe("hasFixedAuthorityWindow", () => {
  it("is true only for a positive number of hours", () => {
    expect(hasFixedAuthorityWindow(72)).toBe(true);
    expect(hasFixedAuthorityWindow(0)).toBe(false);
    expect(hasFixedAuthorityWindow(null)).toBe(false);
    expect(hasFixedAuthorityWindow(undefined)).toBe(false);
  });
});

describe("recomputeNotification with a zero-hour jurisdiction", () => {
  it("keeps the flag but sets no deadline", () => {
    const derived = recomputeNotification(facts, 0);
    expect(derived.notificationRequired).toBe(true);
    expect(derived.notificationDeadline).toBeNull();
  });

  it("still computes the deadline for a jurisdiction with a window", () => {
    const derived = recomputeNotification(facts, 72);
    expect(derived.notificationDeadline?.toISOString()).toBe("2026-11-02T09:30:00.000Z");
  });
});

describe("createPendingAuthorityNotifications", () => {
  it("skips jurisdictions with no fixed window and keeps the others", async () => {
    const create = vi.fn(async () => ({}));
    const prisma = {
      organizationJurisdiction: {
        findMany: async () => [
          { jurisdictionId: "gdpr", jurisdiction: { breachNotificationHours: 72 } },
          { jurisdictionId: "ccpa", jurisdiction: { breachNotificationHours: 0 } },
        ],
      },
      incidentNotification: { create },
    };
    await createPendingAuthorityNotifications(prisma, "org-1", "inc-1", facts.discoveredAt);
    expect(create).toHaveBeenCalledTimes(1);
    const data = (create.mock.calls[0] as unknown as [{ data: { jurisdictionId: string; deadline: Date } }])[0].data;
    expect(data.jurisdictionId).toBe("gdpr");
    expect(data.deadline.toISOString()).toBe("2026-11-02T09:30:00.000Z");
  });
});
