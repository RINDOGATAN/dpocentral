// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The automatic plan change from a confirmed payment (owner's decision,
 * 11 Oct 2026). Called by POST /api/plan/stripe-sync with a notice the
 * storefront's Stripe webhook relays (src/lib/plan-upgrade.ts).
 *
 * "paid" (a first payment or a renewal):
 *   1. organisations already paid by this subscription: plan EU_CLOUD and the
 *      renewal date brought up to date (nothing written if already so);
 *   2. otherwise the signed reference for this app names the organisation
 *      (rule "reference"). If it is already paid under another subscription
 *      nothing changes ("already-paid-other-subscription"); if an operator set
 *      it paid without a subscription, the subscription is attached;
 *   3. otherwise (no reference, one for another app of the suite, or a bad
 *      signature) the e-mail rule: the person with the payer's e-mail who is
 *      owner or admin of exactly one organisation here (rule "email"); none
 *      ("no-account") or several ("several-organisations") changes nothing.
 * "ended" (the subscription is over): organisations paid by this subscription
 *   go back to PILOT. One set paid by an operator without a subscription is
 *   never touched. No record is deleted: the organisation returns to the pilot
 *   limits, and its pilot clock (pilotStartedAt) was never changed, so it is
 *   read-only with export if its 90 days have passed.
 *
 * Every change writes one PLAN_CHANGE audit entry in the same transaction.
 * A notice that changes nothing writes nothing, so a repeated notice is
 * harmless.
 */

import {
  planChangeAuditData,
  type Plan,
  type PlanState,
} from "@/server/services/pilot/plan";
import { parseOrgReference, type PlanSyncNotice } from "@/lib/plan-upgrade";
import { logger } from "@/lib/logger";

const PAID: Plan = "EU_CLOUD";

type SyncOrgRow = PlanState & { id: string; planStripeSubscriptionId: string | null };

const ORG_SELECT = {
  id: true,
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
    findMany(args: { where: { planStripeSubscriptionId: string }; select: typeof ORG_SELECT }): Promise<SyncOrgRow[]>;
    findUnique(args: { where: { id: string }; select: typeof ORG_SELECT }): Promise<SyncOrgRow | null>;
  };
  organizationMember: {
    findMany(args: {
      where: {
        role: { in: ("OWNER" | "ADMIN")[] };
        user: { email: { equals: string; mode: "insensitive" } };
      };
      select: { organizationId: true };
    }): Promise<{ organizationId: string }[]>;
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

async function findByEmail(db: PlanSyncDb, email: string | null): Promise<string[] | null> {
  if (!email) return null;
  const rows = await db.organizationMember.findMany({
    where: {
      role: { in: ["OWNER", "ADMIN"] },
      user: { email: { equals: email.trim(), mode: "insensitive" } },
    },
    select: { organizationId: true },
  });
  return [...new Set(rows.map((r) => r.organizationId))];
}

function unmatched(reason: string, notice: PlanSyncNotice): SyncResult[] {
  logger.warn("Plan payment not matched to an organisation", {
    reason,
    eventId: notice.eventId,
    subscriptionId: notice.subscriptionId,
  });
  return [{ organizationId: null, rule: null, changed: false, reason }];
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

  // 1. Already paid by this subscription: a renewal.
  if (linked.length > 0) {
    const results: SyncResult[] = [];
    for (const row of linked) results.push(await write(db, row, paidData(row, notice, now), notice, "subscription"));
    return results;
  }

  // 2. The signed reference for this app.
  const ref = parseOrgReference(notice.clientReferenceId, secret);
  if (ref.kind === "invalid") {
    logger.warn("Plan payment with an invalid organisation reference; trying the e-mail rule", {
      eventId: notice.eventId,
    });
  }
  let target: SyncOrgRow | null = null;
  let rule: SyncRule = "reference";
  if (ref.kind === "valid") {
    target = await db.organization.findUnique({ where: { id: ref.orgId }, select: ORG_SELECT });
    if (!target) {
      logger.warn("Plan payment names an organisation that does not exist; trying the e-mail rule", {
        eventId: notice.eventId,
      });
    }
  }

  // 3. The e-mail rule.
  if (!target) {
    rule = "email";
    const orgIds = await findByEmail(db, notice.customerEmail);
    if (!orgIds || orgIds.length === 0) return unmatched("no-account", notice);
    if (orgIds.length > 1) return unmatched("several-organisations", notice);
    target = await db.organization.findUnique({ where: { id: orgIds[0] }, select: ORG_SELECT });
    if (!target) return unmatched("no-account", notice);
  }

  if (
    target.plan === PAID &&
    target.planStripeSubscriptionId &&
    target.planStripeSubscriptionId !== notice.subscriptionId
  ) {
    logger.warn("Plan payment for an organisation already paid under another subscription", {
      organizationId: target.id,
      eventId: notice.eventId,
      subscriptionId: notice.subscriptionId,
    });
    return [{ organizationId: target.id, rule, changed: false, reason: "already-paid-other-subscription" }];
  }

  return [await write(db, target, paidData(target, notice, now), notice, rule)];
}
