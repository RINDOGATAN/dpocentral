// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The automatic plan change from a confirmed payment (owner's decision,
 * 11 Oct 2026). Called by POST /api/plan/stripe-sync with a notice the
 * storefront's Stripe webhook relays (src/lib/plan-upgrade.ts).
 *
 * One plan per paying customer (owner's decision, 15 Oct 2026): a payment is
 * attached to a group, every organisation with the same billing owner
 * (umbrella.ts), never to a single organisation of it.
 *
 * "paid" (a first payment or a renewal):
 *   1. organisations already paid by this subscription, and the rest of their
 *      groups: plan EU_CLOUD and the renewal date brought up to date (nothing
 *      written where already so);
 *   2. otherwise the signed reference for this app names an organisation
 *      (rule "reference"), and the payment covers its whole group. If an
 *      organisation of that group is already paid under another subscription
 *      nothing changes ("already-paid-other-subscription"); a plan an operator
 *      set without a subscription gets the subscription attached;
 *   3. otherwise (no reference, one for another app of the suite, or a bad
 *      signature) the e-mail rule (rule "email"): the payer's own group when
 *      the person with the payer's e-mail is a billing owner here; else the
 *      one group of the organisations they own or administer. None
 *      ("no-account") or organisations of several customers
 *      ("several-customers") changes nothing.
 * "ended" (the subscription is over): organisations paid by this subscription
 *   go back to PILOT. One set paid by an operator without a subscription is
 *   never touched. No record is deleted: the organisation returns to the pilot
 *   limits, and its pilot clock (pilotStartedAt) was never changed, so it is
 *   read-only with export if its window has passed.
 *
 * Every change writes one PLAN_CHANGE audit entry per organisation, in the
 * same transaction as its update. A notice that changes nothing writes
 * nothing, so a repeated notice is harmless.
 */

import {
  planChangeAuditData,
  type Plan,
  type PlanState,
} from "@/server/services/pilot/plan";
import { parseOrgReference, type PlanSyncNotice } from "@/lib/plan-upgrade";
import { logger } from "@/lib/logger";
import { groupWhere, type GroupWhere } from "@/server/services/pilot/umbrella";

const PAID: Plan = "EU_CLOUD";

type SyncOrgRow = PlanState & {
  id: string;
  planStripeSubscriptionId: string | null;
  billingOwnerId: string | null;
};

const ORG_SELECT = {
  id: true,
  billingOwnerId: true,
  plan: true,
  planStartedAt: true,
  planRenewsAt: true,
  planNote: true,
  planStripeSubscriptionId: true,
} as const;

type OrgData = {
  plan: Plan;
  planStartedAt: Date | null;
  planRenewsAt: Date | null;
  planStripeSubscriptionId: string | null;
};

/** The database calls this service makes (Prisma in production, a stand-in in tests). */
export interface PlanSyncDb {
  organization: {
    findMany(args: {
      where: { planStripeSubscriptionId: string } | GroupWhere;
      select: typeof ORG_SELECT;
    }): Promise<SyncOrgRow[]>;
    findUnique(args: { where: { id: string }; select: typeof ORG_SELECT }): Promise<SyncOrgRow | null>;
  };
  organizationMember: {
    findMany(args: {
      where: {
        role: { in: ("OWNER" | "ADMIN")[] };
        user: { email: { equals: string; mode: "insensitive" } };
      };
      select: { organizationId: true; userId: true; organization: { select: { billingOwnerId: true } } };
    }): Promise<{ organizationId: string; userId: string; organization: { billingOwnerId: string | null } | null }[]>;
  };
  $transaction<T>(fn: (tx: PlanSyncTx) => Promise<T>): Promise<T>;
}

export interface PlanSyncTx {
  organization: { update(args: { where: { id: string }; data: OrgData }): Promise<unknown> };
  auditLog: { create(args: { data: ReturnType<typeof planChangeAuditData> }): Promise<unknown> };
}

export type SyncRule = "subscription" | "reference" | "email";

export interface SyncResult {
  organizationId: string | null;
  rule: SyncRule | null;
  changed: boolean;
  reason?: string;
}

const t = (d: Date | null) => (d ? d.getTime() : null);

function sameData(row: SyncOrgRow, data: OrgData): boolean {
  return (
    row.plan === data.plan &&
    t(row.planStartedAt) === t(data.planStartedAt) &&
    t(row.planRenewsAt) === t(data.planRenewsAt) &&
    row.planStripeSubscriptionId === data.planStripeSubscriptionId
  );
}

async function write(
  db: PlanSyncDb,
  row: SyncOrgRow,
  data: OrgData,
  notice: PlanSyncNotice,
  rule: SyncRule
): Promise<SyncResult> {
  if (sameData(row, data)) return { organizationId: row.id, rule, changed: false };
  const before: PlanState = {
    plan: row.plan,
    planStartedAt: row.planStartedAt,
    planRenewsAt: row.planRenewsAt,
    planNote: row.planNote,
  };
  const after: PlanState = { ...before, ...data };
  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: row.id }, data });
    await tx.auditLog.create({
      data: planChangeAuditData(row.id, before, after, {
        source: "stripe-auto-upgrade",
        eventId: notice.eventId,
        subscriptionId: notice.subscriptionId,
        rule,
      }),
    });
  });
  logger.info("Plan changed by payment", {
    organizationId: row.id,
    from: row.plan,
    to: data.plan,
    rule,
    eventId: notice.eventId,
    subscriptionId: notice.subscriptionId,
  });
  return { organizationId: row.id, rule, changed: true };
}

function paidData(row: SyncOrgRow, notice: PlanSyncNotice, now: Date): OrgData {
  return {
    plan: PAID,
    planStartedAt: row.plan === PAID && row.planStartedAt ? row.planStartedAt : now,
    planRenewsAt: notice.periodEnd ? new Date(notice.periodEnd) : row.planRenewsAt,
    planStripeSubscriptionId: notice.subscriptionId,
  };
}

/** Every organisation of the groups of `rows`, each once, in a stable order. */
async function wholeGroups(db: PlanSyncDb, rows: SyncOrgRow[]): Promise<SyncOrgRow[]> {
  const seen = new Map<string, SyncOrgRow>();
  const groups = new Map<string, GroupWhere>();
  for (const r of rows) {
    seen.set(r.id, r);
    const g = groupWhere(r);
    groups.set(JSON.stringify(g), g);
  }
  for (const g of groups.values()) {
    if ("id" in g) continue;
    for (const r of await db.organization.findMany({ where: g, select: ORG_SELECT })) {
      if (!seen.has(r.id)) seen.set(r.id, r);
    }
  }
  return [...seen.values()];
}

/**
 * The group the payer's e-mail points to: the payer's own group when they are
 * a billing owner here; else the single group of the organisations they own
 * or administer. Invited staff are never billing owners, so a payment by a
 * consultant who also administers a client's own organisation still lands on
 * the consultant's group.
 */
async function groupByEmail(
  db: PlanSyncDb,
  email: string | null
): Promise<{ group: GroupWhere } | { reason: string }> {
  if (!email) return { reason: "no-account" };
  const rows = await db.organizationMember.findMany({
    where: {
      role: { in: ["OWNER", "ADMIN"] },
      user: { email: { equals: email.trim(), mode: "insensitive" } },
    },
    select: { organizationId: true, userId: true, organization: { select: { billingOwnerId: true } } },
  });
  if (rows.length === 0) return { reason: "no-account" };
  const own = rows.find((r) => r.organization?.billingOwnerId === r.userId);
  if (own) return { group: { billingOwnerId: own.userId } };
  const groups = new Map<string, GroupWhere>();
  for (const r of rows) {
    const g = groupWhere({ id: r.organizationId, billingOwnerId: r.organization?.billingOwnerId });
    groups.set(JSON.stringify(g), g);
  }
  if (groups.size > 1) return { reason: "several-customers" };
  return { group: [...groups.values()][0] };
}

function unmatched(reason: string, notice: PlanSyncNotice): SyncResult[] {
  logger.warn("Plan payment not matched to an organisation", {
    reason,
    eventId: notice.eventId,
    subscriptionId: notice.subscriptionId,
  });
  return [{ organizationId: null, rule: null, changed: false, reason }];
}

/** Applies the payment to every organisation of a group, after the checks. */
async function payGroup(
  db: PlanSyncDb,
  rows: SyncOrgRow[],
  notice: PlanSyncNotice,
  rule: SyncRule,
  now: Date
): Promise<SyncResult[]> {
  const other = rows.find(
    (r) => r.plan === PAID && r.planStripeSubscriptionId && r.planStripeSubscriptionId !== notice.subscriptionId
  );
  if (other) {
    logger.warn("Plan payment for a customer already paid under another subscription", {
      organizationId: other.id,
      eventId: notice.eventId,
      subscriptionId: notice.subscriptionId,
    });
    return [{ organizationId: other.id, rule, changed: false, reason: "already-paid-other-subscription" }];
  }
  // One start date for the whole group: the earliest paid start already
  // recorded in it (an operator's plan keeps its start), else now.
  const starts = rows
    .filter((r) => r.plan === PAID && r.planStartedAt)
    .map((r) => (r.planStartedAt as Date).getTime());
  const startedAt = starts.length ? new Date(Math.min(...starts)) : now;
  const results: SyncResult[] = [];
  for (const row of rows) {
    results.push(
      await write(
        db,
        row,
        {
          plan: PAID,
          planStartedAt: startedAt,
          planRenewsAt: notice.periodEnd ? new Date(notice.periodEnd) : row.planRenewsAt,
          planStripeSubscriptionId: notice.subscriptionId,
        },
        notice,
        rule
      )
    );
  }
  return results;
}

export async function applyPlanNotice(
  db: PlanSyncDb,
  notice: PlanSyncNotice,
  secret: string,
  now: Date = new Date()
): Promise<SyncResult[]> {
  const linked = await db.organization.findMany({
    where: { planStripeSubscriptionId: notice.subscriptionId },
    select: ORG_SELECT,
  });

  if (notice.kind === "ended") {
    const results: SyncResult[] = [];
    for (const row of linked) {
      if (row.plan !== PAID) {
        results.push({ organizationId: row.id, rule: "subscription", changed: false, reason: "not-paid" });
        continue;
      }
      results.push(
        await write(
          db,
          row,
          { plan: "PILOT", planStartedAt: null, planRenewsAt: null, planStripeSubscriptionId: null },
          notice,
          "subscription"
        )
      );
    }
    return results.length ? results : unmatched("no-organisation-for-subscription", notice);
  }

  // 1. Already paid by this subscription: a renewal, for the whole group
  // (an organisation created since the last payment included).
  if (linked.length > 0) {
    const rows = (await wholeGroups(db, linked)).filter(
      (r) => r.planStripeSubscriptionId === notice.subscriptionId || r.plan !== PAID || !r.planStripeSubscriptionId
    );
    const results: SyncResult[] = [];
    for (const row of rows) results.push(await write(db, row, paidData(row, notice, now), notice, "subscription"));
    return results;
  }

  // 2. The signed reference for this app.
  const ref = parseOrgReference(notice.clientReferenceId, secret);
  if (ref.kind === "invalid") {
    logger.warn("Plan payment with an invalid organisation reference; trying the e-mail rule", {
      eventId: notice.eventId,
    });
  }
  if (ref.kind === "valid") {
    const target = await db.organization.findUnique({ where: { id: ref.orgId }, select: ORG_SELECT });
    if (target) return payGroup(db, await wholeGroups(db, [target]), notice, "reference", now);
    logger.warn("Plan payment names an organisation that does not exist; trying the e-mail rule", {
      eventId: notice.eventId,
    });
  }

  // 3. The e-mail rule.
  const found = await groupByEmail(db, notice.customerEmail);
  if ("reason" in found) return unmatched(found.reason, notice);
  const rows = await db.organization.findMany({ where: found.group, select: ORG_SELECT });
  if (rows.length === 0) return unmatched("no-account", notice);
  return payGroup(db, rows, notice, "email", now);
}
