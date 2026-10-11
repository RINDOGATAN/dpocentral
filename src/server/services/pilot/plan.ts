// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Setting an organisation's hosted plan (Organization.plan), for the
 * operator's script scripts/set-org-plan.ts. There is no screen for this and
 * nothing in the app sells it: payment is collected outside the app (a
 * payment link or an invoice), and an operator then records the plan here.
 *
 * Each change writes one audit-trail entry on the organisation (action
 * PLAN_CHANGE) with the plan and the dates before and after. The operator's
 * note (planNote, e.g. an invoice id) is kept on the organisation for the
 * operator; the audit entry says only whether it changed, because the
 * organisation's owners can read its audit trail.
 *
 * A dry run computes and returns the same before and after, and writes
 * nothing.
 */

import type { PrismaClient } from "@prisma/client";

export const PLANS = ["PILOT", "EU_CLOUD"] as const;
export type Plan = (typeof PLANS)[number];

/** The audit action of a plan change. */
export const PLAN_CHANGE = "PLAN_CHANGE";

export type PlanState = {
  plan: Plan;
  planStartedAt: Date | null;
  planRenewsAt: Date | null;
  planNote: string | null;
};

export type PlanOrgRow = PlanState & { id: string; slug: string; name: string };

export interface SetPlanInput {
  /** Organisation id or slug. */
  org: string;
  plan: Plan;
  /** undefined: keep or default (see resolvePlanState); null: clear. */
  startedAt?: Date | null;
  renewsAt?: Date | null;
  note?: string | null;
  /** Who made the change, recorded in the audit entry. */
  operator: string;
  dryRun: boolean;
}

export interface SetPlanResult {
  organization: { id: string; slug: string; name: string };
  before: PlanState;
  after: PlanState;
  changed: boolean;
  written: boolean;
}

/** The Prisma client (tests pass a stand-in). */
type SetPlanDb = Pick<PrismaClient, "organization" | "$transaction">;

export class PlanInputError extends Error {}

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

/**
 * The plan state to write:
 *  - EU_CLOUD: the start date given, else the one already recorded for a
 *    paid organisation, else now; the renewal date given, else the one
 *    already recorded;
 *  - PILOT: both dates cleared unless given;
 *  - the note: the one given, else the one already recorded.
 * The renewal date must fall after the start date.
 */
export function resolvePlanState(
  before: PlanState,
  input: Pick<SetPlanInput, "plan" | "startedAt" | "renewsAt" | "note">,
  now: Date = new Date()
): PlanState {
  const stayingPaid = before.plan === "EU_CLOUD" && input.plan === "EU_CLOUD";
  let planStartedAt: Date | null;
  let planRenewsAt: Date | null;
  if (input.plan === "EU_CLOUD") {
    planStartedAt =
      input.startedAt !== undefined
        ? input.startedAt
        : stayingPaid && before.planStartedAt
          ? before.planStartedAt
          : now;
    planRenewsAt =
      input.renewsAt !== undefined ? input.renewsAt : stayingPaid ? before.planRenewsAt : null;
  } else {
    planStartedAt = input.startedAt ?? null;
    planRenewsAt = input.renewsAt ?? null;
  }
  if (planStartedAt && planRenewsAt && planRenewsAt.getTime() <= planStartedAt.getTime()) {
    throw new PlanInputError("The renewal date must fall after the start date.");
  }
  const planNote = input.note !== undefined ? input.note : before.planNote;
  return { plan: input.plan, planStartedAt, planRenewsAt, planNote };
}

function same(a: PlanState, b: PlanState): boolean {
  const t = (d: Date | null) => (d ? d.getTime() : null);
  return (
    a.plan === b.plan &&
    t(a.planStartedAt) === t(b.planStartedAt) &&
    t(a.planRenewsAt) === t(b.planRenewsAt) &&
    a.planNote === b.planNote
  );
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function setOrganizationPlan(
  db: SetPlanDb,
  input: SetPlanInput,
  now: Date = new Date()
): Promise<SetPlanResult> {
  const key = input.org.trim();
  if (!key) throw new PlanInputError("Give the organization's id or slug.");
  if (!isPlan(input.plan)) throw new PlanInputError(`Unknown plan: ${String(input.plan)}.`);

  const row: PlanOrgRow | null = await db.organization.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      planStartedAt: true,
      planRenewsAt: true,
      planNote: true,
    },
  });
  if (!row) throw new PlanInputError(`No organization with the id or slug "${key}".`);

  const before: PlanState = {
    plan: row.plan,
    planStartedAt: row.planStartedAt,
    planRenewsAt: row.planRenewsAt,
    planNote: row.planNote,
  };
  const after = resolvePlanState(before, input, now);
  const changed = !same(before, after);
  const organization = { id: row.id, slug: row.slug, name: row.name };

  if (input.dryRun || !changed) {
    return { organization, before, after, changed, written: false };
  }

  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: row.id }, data: after });
    await tx.auditLog.create({
      data: {
        organizationId: row.id,
        userId: null,
        entityType: "Organization",
        entityId: row.id,
        action: PLAN_CHANGE,
        changes: {
          before: {
            plan: before.plan,
            planStartedAt: iso(before.planStartedAt),
            planRenewsAt: iso(before.planRenewsAt),
          },
          after: {
            plan: after.plan,
            planStartedAt: iso(after.planStartedAt),
            planRenewsAt: iso(after.planRenewsAt),
          },
          planNoteChanged: before.planNote !== after.planNote,
        },
        metadata: { source: "scripts/set-org-plan.ts", operator: input.operator },
      },
    });
  });

  return { organization, before, after, changed, written: true };
}
