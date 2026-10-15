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
 * One plan per paying customer: the change applies to every organisation of
 * the named organisation's group (same billing owner, umbrella.ts), each with
 * its own audit entry. The operator's note is kept on the named organisation
 * only.
 *
 * A dry run computes and returns the same before and after, and writes
 * nothing.
 */

import type { PrismaClient } from "@prisma/client";
import { groupWhere } from "./umbrella";

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

export type PlanOrgRow = PlanState & {
  id: string;
  slug: string;
  name: string;
  billingOwnerId?: string | null;
};

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
  /** The other organisations of the group whose plan this changes (or would, on a dry run). */
  groupChanged: number;
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

/**
 * The audit-trail entry of a plan change (action PLAN_CHANGE), shared by the
 * operator's script and the automatic upgrade (plan-sync.ts) so both write the
 * same shape. The operator's note is never copied into it, only whether it
 * changed, because the organisation's owners can read the audit trail.
 */
export function planChangeAuditData(
  organizationId: string,
  before: PlanState,
  after: PlanState,
  metadata: Record<string, string>
) {
  return {
    organizationId,
    userId: null,
    entityType: "Organization",
    entityId: organizationId,
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
    metadata,
  };
}

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
      billingOwnerId: true,
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
  const organization = { id: row.id, slug: row.slug, name: row.name };

  // The rest of the group follows the named organisation's plan and dates;
  // each keeps its own note.
  const siblings = row.billingOwnerId
    ? (
        await db.organization.findMany({
          where: groupWhere(row),
          select: { id: true, plan: true, planStartedAt: true, planRenewsAt: true, planNote: true },
        })
      ).filter((o) => o.id !== row.id)
    : [];
  const siblingChanges = siblings
    .map((o) => {
      const b: PlanState = {
        plan: o.plan,
        planStartedAt: o.planStartedAt,
        planRenewsAt: o.planRenewsAt,
        planNote: o.planNote,
      };
      const a: PlanState = { ...after, planNote: o.planNote };
      return { id: o.id, before: b, after: a };
    })
    .filter((c) => !same(c.before, c.after));

  const changed = !same(before, after);
  const groupChanged = siblingChanges.length;

  if (input.dryRun || (!changed && groupChanged === 0)) {
    return { organization, before, after, changed, written: false, groupChanged };
  }

  const metadata = { source: "scripts/set-org-plan.ts", operator: input.operator };
  await db.$transaction(async (tx) => {
    if (changed) {
      await tx.organization.update({ where: { id: row.id }, data: after });
      await tx.auditLog.create({ data: planChangeAuditData(row.id, before, after, metadata) });
    }
    for (const c of siblingChanges) {
      await tx.organization.update({ where: { id: c.id }, data: c.after });
      await tx.auditLog.create({ data: planChangeAuditData(c.id, c.before, c.after, metadata) });
    }
  });

  return { organization, before, after, changed, written: true, groupChanged };
}
