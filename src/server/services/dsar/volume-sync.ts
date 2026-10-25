// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The rights-request volume upgrade switched on and off by its payment
 * (hosted service). Called by POST /api/plan/dsar-volume-sync with a notice
 * the storefront's Stripe webhook relays, signed as for the plan
 * (src/lib/plan-upgrade.ts: same header, same secret, same body shape).
 *
 * The upgrade belongs to one organisation, not to a group: it raises that
 * organisation's public-form ceiling from 100 to 1,000 requests a calendar
 * month (src/server/services/dsar/module.ts).
 *
 * "paid" (a first payment or a renewal):
 *   1. an organisation already upgraded by this subscription: status ACTIVE
 *      and the renewal date brought up to date (rule "subscription");
 *   2. otherwise the signed upgrade reference names the organisation
 *      (rule "reference"; the reference is signed for DSAR_VOLUME_APP_CODE,
 *      so a plan reference never matches here, nor the reverse). An
 *      organisation already upgraded under another subscription is left as
 *      it is ("already-upgraded-other-subscription");
 *   3. otherwise the payer's e-mail, when that person owns or administers
 *      exactly one organisation (rule "email"); none ("no-account") or
 *      several ("several-organisations") changes nothing.
 * "ended": an organisation upgraded by this subscription goes to CANCELLED
 *   (the standard 100 a month). The renewal date is kept: it says until when
 *   the upgrade was paid.
 *
 * Every change writes one DSAR_MODULE_CHANGE audit entry, in the same
 * transaction as the update, in the shape the operator's script writes
 * (src/server/services/dsar/set-module.ts). A notice that changes nothing
 * writes nothing, so a repeated notice is harmless.
 */

import { logger } from "@/lib/logger";
import { parseOrgReference, signOrgReference, type PlanSyncNotice } from "@/lib/plan-upgrade";
import { DSAR_MODULE_CHANGE, type DsarModuleState } from "./set-module";
import type { DsarModuleStatusValue } from "./module";

/** The app code in the upgrade's organisation reference (the plan's is "dpc"). */
export const DSAR_VOLUME_APP_CODE = "dpcdsar";

/**
 * The link the organisation's buyer follows: the payment link with the signed
 * organisation reference as Stripe's client reference and the buyer's e-mail
 * prefilled.
 */
export function volumeUpgradeCheckoutUrl(
  link: string,
  organizationId: string,
  email: string | null | undefined,
  secret: string
): string {
  const url = new URL(link);
  url.searchParams.set("client_reference_id", signOrgReference(organizationId, secret, DSAR_VOLUME_APP_CODE));
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}

const ORG_SELECT = {
  id: true,
  dsarModuleStatus: true,
  dsarModuleSubscriptionId: true,
  dsarModuleRenewsAt: true,
} as const;

type VolumeOrgRow = { id: string } & DsarModuleState;

type AuditData = {
  organizationId: string;
  userId: null;
  entityType: "Organization";
  entityId: string;
  action: typeof DSAR_MODULE_CHANGE;
  changes: {
    before: { status: DsarModuleStatusValue | null; renewsAt: string | null };
    after: { status: DsarModuleStatusValue | null; renewsAt: string | null };
    subscriptionIdChanged: boolean;
  };
  metadata: { source: "stripe-auto-upgrade"; eventId: string; rule: VolumeSyncRule };
};

/** The database calls this service makes (Prisma in production, a stand-in in tests). */
export interface VolumeSyncDb {
  organization: {
    findMany(args: {
      where: { dsarModuleSubscriptionId: string };
      select: typeof ORG_SELECT;
    }): Promise<VolumeOrgRow[]>;
    findUnique(args: { where: { id: string }; select: typeof ORG_SELECT }): Promise<VolumeOrgRow | null>;
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
  $transaction<T>(fn: (tx: VolumeSyncTx) => Promise<T>): Promise<T>;
}

export interface VolumeSyncTx {
  organization: { update(args: { where: { id: string }; data: DsarModuleState }): Promise<unknown> };
  auditLog: { create(args: { data: AuditData }): Promise<unknown> };
}

export type VolumeSyncRule = "subscription" | "reference" | "email";

export interface VolumeSyncResult {
  organizationId: string | null;
  rule: VolumeSyncRule | null;
  changed: boolean;
  reason?: string;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function same(a: DsarModuleState, b: DsarModuleState): boolean {
  return (
    a.dsarModuleStatus === b.dsarModuleStatus &&
    a.dsarModuleSubscriptionId === b.dsarModuleSubscriptionId &&
    iso(a.dsarModuleRenewsAt) === iso(b.dsarModuleRenewsAt)
  );
}

async function write(
  db: VolumeSyncDb,
  row: VolumeOrgRow,
  after: DsarModuleState,
  notice: PlanSyncNotice,
  rule: VolumeSyncRule
): Promise<VolumeSyncResult> {
  const before: DsarModuleState = {
    dsarModuleStatus: row.dsarModuleStatus,
    dsarModuleSubscriptionId: row.dsarModuleSubscriptionId,
    dsarModuleRenewsAt: row.dsarModuleRenewsAt,
  };
  if (same(before, after)) return { organizationId: row.id, rule, changed: false };
  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: row.id }, data: after });
    await tx.auditLog.create({
      data: {
        organizationId: row.id,
        userId: null,
        entityType: "Organization",
        entityId: row.id,
        action: DSAR_MODULE_CHANGE,
        changes: {
          before: { status: before.dsarModuleStatus, renewsAt: iso(before.dsarModuleRenewsAt) },
          after: { status: after.dsarModuleStatus, renewsAt: iso(after.dsarModuleRenewsAt) },
          subscriptionIdChanged: before.dsarModuleSubscriptionId !== after.dsarModuleSubscriptionId,
        },
        metadata: { source: "stripe-auto-upgrade", eventId: notice.eventId, rule },
      },
    });
  });
  logger.info("Rights-request volume upgrade changed by payment", {
    organizationId: row.id,
    from: before.dsarModuleStatus,
    to: after.dsarModuleStatus,
    rule,
    eventId: notice.eventId,
    subscriptionId: notice.subscriptionId,
  });
  return { organizationId: row.id, rule, changed: true };
}

function activeData(row: VolumeOrgRow, notice: PlanSyncNotice): DsarModuleState {
  return {
    dsarModuleStatus: "ACTIVE",
    dsarModuleSubscriptionId: notice.subscriptionId,
    dsarModuleRenewsAt: notice.periodEnd ? new Date(notice.periodEnd) : row.dsarModuleRenewsAt,
  };
}

function unmatched(reason: string, notice: PlanSyncNotice): VolumeSyncResult[] {
  logger.warn("Rights-request volume payment not matched to an organisation", {
    reason,
    eventId: notice.eventId,
    subscriptionId: notice.subscriptionId,
  });
  return [{ organizationId: null, rule: null, changed: false, reason }];
}

/** Applies the payment to one organisation, after the other-subscription check. */
async function activate(
  db: VolumeSyncDb,
  row: VolumeOrgRow,
  notice: PlanSyncNotice,
  rule: VolumeSyncRule
): Promise<VolumeSyncResult[]> {
  if (
    row.dsarModuleStatus === "ACTIVE" &&
    row.dsarModuleSubscriptionId &&
    row.dsarModuleSubscriptionId !== notice.subscriptionId
  ) {
    logger.warn("Rights-request volume payment for an organisation upgraded under another subscription", {
      organizationId: row.id,
      eventId: notice.eventId,
      subscriptionId: notice.subscriptionId,
    });
    return [{ organizationId: row.id, rule, changed: false, reason: "already-upgraded-other-subscription" }];
  }
  return [await write(db, row, activeData(row, notice), notice, rule)];
}

export async function applyDsarVolumeNotice(
  db: VolumeSyncDb,
  notice: PlanSyncNotice,
  secret: string
): Promise<VolumeSyncResult[]> {
  const linked = await db.organization.findMany({
    where: { dsarModuleSubscriptionId: notice.subscriptionId },
    select: ORG_SELECT,
  });

  if (notice.kind === "ended") {
    const results: VolumeSyncResult[] = [];
    for (const row of linked) {
      if (row.dsarModuleStatus !== "ACTIVE") {
        results.push({ organizationId: row.id, rule: "subscription", changed: false, reason: "not-active" });
        continue;
      }
      results.push(
        await write(
          db,
          row,
          {
            dsarModuleStatus: "CANCELLED",
            dsarModuleSubscriptionId: row.dsarModuleSubscriptionId,
            dsarModuleRenewsAt: row.dsarModuleRenewsAt,
          },
          notice,
          "subscription"
        )
      );
    }
    return results.length ? results : unmatched("no-organisation-for-subscription", notice);
  }

  // 1. Already upgraded by this subscription: a renewal.
  if (linked.length > 0) {
    const results: VolumeSyncResult[] = [];
    for (const row of linked) results.push(await write(db, row, activeData(row, notice), notice, "subscription"));
    return results;
  }

  // 2. The signed upgrade reference.
  const ref = parseOrgReference(notice.clientReferenceId, secret, DSAR_VOLUME_APP_CODE);
  if (ref.kind === "valid") {
    const target = await db.organization.findUnique({ where: { id: ref.orgId }, select: ORG_SELECT });
    if (target) return activate(db, target, notice, "reference");
    logger.warn("Rights-request volume payment names an organisation that does not exist; trying the e-mail rule", {
      eventId: notice.eventId,
    });
  } else if (ref.kind !== "none") {
    logger.warn("Rights-request volume payment without a valid upgrade reference; trying the e-mail rule", {
      eventId: notice.eventId,
    });
  }

  // 3. The e-mail rule: one organisation the payer owns or administers.
  if (!notice.customerEmail) return unmatched("no-account", notice);
  const memberships = await db.organizationMember.findMany({
    where: {
      role: { in: ["OWNER", "ADMIN"] },
      user: { email: { equals: notice.customerEmail.trim(), mode: "insensitive" } },
    },
    select: { organizationId: true },
  });
  const ids = [...new Set(memberships.map((m) => m.organizationId))];
  if (ids.length === 0) return unmatched("no-account", notice);
  if (ids.length > 1) return unmatched("several-organisations", notice);
  const row = await db.organization.findUnique({ where: { id: ids[0]! }, select: ORG_SELECT });
  if (!row) return unmatched("no-account", notice);
  return activate(db, row, notice, "email");
}
