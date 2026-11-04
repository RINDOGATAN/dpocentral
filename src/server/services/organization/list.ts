// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisations a person belongs to, as organization.list returns them.
 * Shared by the router and by the root layout, which reads the list on the
 * server so the signed-in shell renders at once instead of after a round
 * trip for it.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * The organisation without the operator's internal columns (planNote and
 * planStripeSubscriptionId).
 */
export function withoutPlanNote<
  T extends { planNote?: string | null; planStripeSubscriptionId?: string | null },
>(org: T): Omit<T, "planNote" | "planStripeSubscriptionId"> {
  const { planNote: _planNote, planStripeSubscriptionId: _sub, ...rest } = org;
  return rest;
}

type Db = Pick<typeof prisma, "organizationMember">;

export async function listOrganizationsFor(db: Db, userId: string) {
  const memberships = await db.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              members: true,
              dataAssets: true,
              dsarRequests: true,
              incidents: true,
              vendors: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  // planNote is an operator's internal note: never sent to the
  // organisation's members.
  return memberships.map((m) => ({
    ...withoutPlanNote(m.organization),
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

export type OrganizationListResult = Awaited<ReturnType<typeof listOrganizationsFor>>;

/**
 * The list for the root layout: null when the read fails, so a database
 * hiccup never breaks the page (the browser then asks as before).
 */
export async function listOrganizationsForLayout(userId: string): Promise<OrganizationListResult | null> {
  try {
    return await listOrganizationsFor(prisma, userId);
  } catch (error) {
    logger.error("Organisation list for the layout failed", error);
    return null;
  }
}
