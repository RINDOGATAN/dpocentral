// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Setting an organisation's rights-request volume upgrade (Organization
 * dsarModuleStatus, dsarModuleSubscriptionId, dsarModuleRenewsAt; ACTIVE
 * raises the public form's monthly ceiling from 100 to 1,000), for the
 * operator's script scripts/set-dsar-module.ts. Modelled on the plan setter
 * (src/server/services/pilot/plan.ts). A payment sets the same fields by
 * itself (volume-sync.ts); the script is for corrections.
 *
 * Each change writes one audit-trail entry on the organisation (action
 * DSAR_MODULE_CHANGE) with the status and renewal date before and after. The
 * subscription id is the payment provider's reference: kept for the
 * operator, and the entry says only whether it changed, because the
 * organisation's owners can read its audit trail.
 *
 * Dry run by default: the before and after are computed and nothing is
 * written unless `execute` is true.
 */

import type { PrismaClient } from "@prisma/client";
import { DSAR_MODULE_STATUSES, type DsarModuleStatusValue } from "./module";

export const DSAR_MODULE_CHANGE = "DSAR_MODULE_CHANGE";

export type DsarModuleState = {
  dsarModuleStatus: DsarModuleStatusValue | null;
  dsarModuleSubscriptionId: string | null;
  dsarModuleRenewsAt: Date | null;
};

export interface SetDsarModuleInput {
  /** Organisation id or slug. */
  org: string;
  status: DsarModuleStatusValue;
  /** undefined: keep; null: clear. */
  subscriptionId?: string | null;
  renewsAt?: Date | null;
  operator: string;
  execute: boolean;
}

export interface SetDsarModuleResult {
  organization: { id: string; slug: string; name: string; plan: string };
  before: DsarModuleState;
  after: DsarModuleState;
  changed: boolean;
  written: boolean;
  /** Said to the operator when the change has no effect on its own. */
  note: string | null;
}

export class DsarModuleInputError extends Error {}

export function isDsarModuleStatus(value: string): value is DsarModuleStatusValue {
  return (DSAR_MODULE_STATUSES as readonly string[]).includes(value);
}

type SetDb = Pick<PrismaClient, "organization" | "$transaction">;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function resolveDsarModuleState(before: DsarModuleState, input: Pick<SetDsarModuleInput, "status" | "subscriptionId" | "renewsAt">): DsarModuleState {
  return {
    dsarModuleStatus: input.status,
    dsarModuleSubscriptionId: input.subscriptionId !== undefined ? input.subscriptionId : before.dsarModuleSubscriptionId,
    // Cancelling keeps the renewal date unless one is given: it says until when it was paid.
    dsarModuleRenewsAt: input.renewsAt !== undefined ? input.renewsAt : before.dsarModuleRenewsAt,
  };
}

function same(a: DsarModuleState, b: DsarModuleState): boolean {
  return (
    a.dsarModuleStatus === b.dsarModuleStatus &&
    a.dsarModuleSubscriptionId === b.dsarModuleSubscriptionId &&
    iso(a.dsarModuleRenewsAt) === iso(b.dsarModuleRenewsAt)
  );
}

export async function setDsarModule(db: SetDb, input: SetDsarModuleInput): Promise<SetDsarModuleResult> {
  const key = input.org.trim();
  if (!key) throw new DsarModuleInputError("Give the organization's id or slug.");
  if (!isDsarModuleStatus(input.status)) throw new DsarModuleInputError(`Unknown status: ${String(input.status)}.`);

  const row = await db.organization.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      dsarModuleStatus: true,
      dsarModuleSubscriptionId: true,
      dsarModuleRenewsAt: true,
    },
  });
  if (!row) throw new DsarModuleInputError(`No organization with the id or slug "${key}".`);

  const before: DsarModuleState = {
    dsarModuleStatus: row.dsarModuleStatus,
    dsarModuleSubscriptionId: row.dsarModuleSubscriptionId,
    dsarModuleRenewsAt: row.dsarModuleRenewsAt,
  };
  const after = resolveDsarModuleState(before, input);
  const changed = !same(before, after);
  const organization = { id: row.id, slug: row.slug, name: row.name, plan: row.plan };
  const note: string | null = null;

  if (!input.execute || !changed) return { organization, before, after, changed, written: false, note };

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
        metadata: { source: "scripts/set-dsar-module.ts", operator: input.operator },
      },
    });
  });

  return { organization, before, after, changed, written: true, note };
}
