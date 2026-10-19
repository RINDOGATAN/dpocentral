// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The PENDING notifications to the supervisory authority that an incident
 * flagged for notification starts with: one per jurisdiction the
 * organisation declares, due by that jurisdiction's breach-notification
 * hours from discovery. Shared by `incident.create`, `incident.update` and
 * the one-off recalculation (recalculate-notifications.ts).
 */

import { NotificationStatus } from "@prisma/client";
import { notificationDeadlineFor } from "./notification-assessment";

export type AuthorityNotificationDb = {
  organizationJurisdiction: {
    findMany(args: {
      where: { organizationId: string };
      include: { jurisdiction: true };
    }): Promise<Array<{ jurisdictionId: string; jurisdiction: { breachNotificationHours: number } }>>;
  };
  incidentNotification: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
};

export async function createPendingAuthorityNotifications(
  prisma: AuthorityNotificationDb,
  organizationId: string,
  incidentId: string,
  discoveredAt: Date,
): Promise<void> {
  const orgJurisdictions = await prisma.organizationJurisdiction.findMany({
    where: { organizationId },
    include: { jurisdiction: true },
  });
  for (const oj of orgJurisdictions) {
    await prisma.incidentNotification.create({
      data: {
        incidentId,
        jurisdictionId: oj.jurisdictionId,
        recipientType: "DPA",
        status: NotificationStatus.PENDING,
        deadline: notificationDeadlineFor(discoveredAt, oj.jurisdiction.breachNotificationHours),
      },
    });
  }
}
