// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One plan per paying customer (owner's decision, 15 Oct 2026).
 *
 * On the hosted service an account may manage up to ORGANIZATIONS_PER_ACCOUNT
 * organisations. The account that creates an organisation is its billing
 * owner (Organization.billingOwnerId). Every organisation with the same
 * billing owner forms one group, and the group, not the single organisation,
 * carries:
 *   - the plan (plan, planStartedAt, planRenewsAt, planStripeSubscriptionId):
 *     one payment covers every organisation of the group;
 *   - the pilot window (pilotStartedAt): it starts once and ends on the same
 *     date for every organisation, whenever each was created;
 *   - the pilot allowances (record ceilings and the free DPIAs): counted over
 *     the whole group, so opening another organisation never multiplies them.
 *
 * The group's state is kept on each organisation row, equal across the group:
 * a new organisation copies it (inheritedGroupState), and every write applies
 * to the whole group (plan-sync.ts, plan.ts, caps.ts recordPilotFirstSignIn).
 * Readers therefore keep reading the organisation row as before. An
 * organisation without a billing owner (its creator's account was deleted, or
 * a row made outside the app) is a group of one.
 *
 * Invited members (staff, the consultant's colleagues) are never billing
 * owners of the organisations they join, and are never charged.
 */

/** The paid plan (Prisma enum OrganizationPlan); caps.ts exports the same value. */
const PAID_PLAN = "EU_CLOUD";

/** Where-clause that selects an organisation's whole group. */
export type GroupWhere = { billingOwnerId: string } | { id: string };

export function groupWhere(org: { id: string; billingOwnerId?: string | null }): GroupWhere {
  return org.billingOwnerId ? { billingOwnerId: org.billingOwnerId } : { id: org.id };
}

type IdDb = {
  organization?: {
    findUnique?: (args: {
      where: { id: string };
      select: { billingOwnerId: true };
    }) => Promise<{ billingOwnerId: string | null } | null | undefined>;
    findMany?: (args: { where: GroupWhere; select: { id: true } }) => Promise<{ id: string }[]>;
  };
};

/**
 * The ids of every organisation in the group of `org` (always including
 * `org` itself). `org` is an id, or a row the caller holds; a row that
 * carries billingOwnerId saves one query. A database handle without the
 * organisations model (a test double) answers the organisation alone.
 */
export async function groupOrganizationIds(
  db: IdDb,
  org: string | { id: string; billingOwnerId?: string | null }
): Promise<string[]> {
  const id = typeof org === "string" ? org : org.id;
  const model = db.organization;
  if (!model || typeof model.findMany !== "function") return [id];
  let owner: string | null | undefined =
    typeof org === "string" ? undefined : org.billingOwnerId;
  if (owner === undefined) {
    if (typeof model.findUnique !== "function") return [id];
    const row = await model.findUnique({ where: { id }, select: { billingOwnerId: true } });
    owner = row?.billingOwnerId ?? null;
  }
  if (!owner) return [id];
  const rows = (await model.findMany({ where: { billingOwnerId: owner }, select: { id: true } })) ?? [];
  const ids = rows.map((r) => r.id);
  return ids.includes(id) ? ids : [id, ...ids];
}

/** The group state a row carries. */
export type GroupState = {
  plan: string;
  planStartedAt: Date | null;
  planRenewsAt: Date | null;
  planStripeSubscriptionId: string | null;
  pilotStartedAt: Date | null;
};

const ms = (d: Date | null) => (d ? new Date(d).getTime() : null);

/**
 * The state a new organisation of a group starts with, from the group's
 * existing organisations:
 *   - the paid plan when any of them is paid (the one with the latest
 *     renewal; no renewal date, an operator's open-ended plan, counts as the
 *     latest), else the pilot;
 *   - the earliest recorded pilot start, so a later organisation never
 *     extends or restarts the window (null when none has started yet: the
 *     next sign-in starts it for the whole group).
 * Null when the group has no organisation yet (the account's first).
 */
export function inheritedGroupState(rows: GroupState[]): GroupState | null {
  if (rows.length === 0) return null;
  const starts = rows.map((r) => ms(r.pilotStartedAt)).filter((t): t is number => t !== null);
  const pilotStartedAt = starts.length ? new Date(Math.min(...starts)) : null;
  const paid = rows
    .filter((r) => r.plan === PAID_PLAN)
    .sort((a, b) => {
      const ra = ms(a.planRenewsAt) ?? Number.POSITIVE_INFINITY;
      const rb = ms(b.planRenewsAt) ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return rb - ra;
      return (ms(a.planStartedAt) ?? Number.POSITIVE_INFINITY) - (ms(b.planStartedAt) ?? Number.POSITIVE_INFINITY);
    })[0];
  if (!paid) {
    return {
      plan: "PILOT",
      planStartedAt: null,
      planRenewsAt: null,
      planStripeSubscriptionId: null,
      pilotStartedAt,
    };
  }
  return {
    plan: PAID_PLAN,
    planStartedAt: paid.planStartedAt,
    planRenewsAt: paid.planRenewsAt,
    planStripeSubscriptionId: paid.planStripeSubscriptionId,
    pilotStartedAt,
  };
}

export const GROUP_STATE_SELECT = {
  plan: true,
  planStartedAt: true,
  planRenewsAt: true,
  planStripeSubscriptionId: true,
  pilotStartedAt: true,
} as const;
