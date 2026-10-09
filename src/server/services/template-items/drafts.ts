// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Drafts count once confirmed (owner's decision d2, 9 October 2026), as in AI
 * Sentinel (its src/server/services/provenance and routers/governance/provenance.ts).
 *
 * A data asset, a processing activity or a vendor that the quick start, an
 * industry template or "Start from another client" created is a DRAFT until a
 * person confirms it:
 *
 *   provenance = AUTO_TEMPLATE  and  confirmedAt = null
 *
 * A draft shows "To confirm" and does not count towards the programme's
 * progress (src/components/guided/path-config.ts). A person confirms it in one
 * of two ways, and both record who and when (confirmedBy / confirmedAt, first
 * time only):
 *   - explicitly: the Confirm button on the record, or "Review and confirm"
 *     for several at once (confirmDrafts below);
 *   - implicitly: by editing it (markConfirmed in ./mark.ts, on the ordinary
 *     update path).
 *
 * Records created before this rule: see the migration
 * 20261009120000_drafts_count_once_confirmed (template records never changed
 * since they were created are drafts; edited ones stay confirmed).
 */

import type { Db } from "@/lib/prisma";

/** The Prisma filter for "a draft nobody has confirmed yet". */
export const DRAFT_WHERE = { provenance: "AUTO_TEMPLATE" as const, confirmedAt: null };

export const DRAFT_KINDS = ["dataAsset", "processingActivity", "vendor"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

/** Most items one confirmation may carry (the review page confirms in pages). */
export const MAX_CONFIRM_ITEMS = 200;

export { CONFIRM_ROLES, canConfirmDrafts } from "@/lib/drafts";

export interface DraftItem {
  kind: DraftKind;
  id: string;
  name: string;
  sourceRef: string | null;
  createdAt: Date;
}

export interface DraftCounts {
  dataAssets: number;
  processingActivities: number;
  vendors: number;
  total: number;
}

export async function countDrafts(prisma: Db, organizationId: string): Promise<DraftCounts> {
  const where = { organizationId, ...DRAFT_WHERE };
  const [dataAssets, processingActivities, vendors] = await Promise.all([
    prisma.dataAsset.count({ where }),
    prisma.processingActivity.count({ where }),
    prisma.vendor.count({ where }),
  ]);
  return { dataAssets, processingActivities, vendors, total: dataAssets + processingActivities + vendors };
}

/** Every draft of the organisation, by kind, then by name. */
export async function listDrafts(prisma: Db, organizationId: string): Promise<DraftItem[]> {
  const where = { organizationId, ...DRAFT_WHERE };
  const select = { id: true, name: true, sourceRef: true, createdAt: true };
  const orderBy = { name: "asc" as const };
  const [assets, activities, vendors] = await Promise.all([
    prisma.dataAsset.findMany({ where, select, orderBy, take: MAX_CONFIRM_ITEMS }),
    prisma.processingActivity.findMany({ where, select, orderBy, take: MAX_CONFIRM_ITEMS }),
    prisma.vendor.findMany({ where, select, orderBy, take: MAX_CONFIRM_ITEMS }),
  ]);
  return [
    ...assets.map((r) => ({ kind: "dataAsset" as const, ...r })),
    ...activities.map((r) => ({ kind: "processingActivity" as const, ...r })),
    ...vendors.map((r) => ({ kind: "vendor" as const, ...r })),
  ];
}

export class DraftNotFoundError extends Error {
  constructor() {
    super("One or more records were not found in this organisation, or were already confirmed.");
  }
}

/**
 * Confirm drafts, all or nothing: every item must be a draft of this
 * organisation, or nothing is written (a record already confirmed, or one of
 * another organisation, makes the whole request fail). One audit entry per
 * record, action CONFIRM.
 */
export async function confirmDrafts(
  prisma: Db,
  args: {
    organizationId: string;
    userId: string;
    items: { kind: DraftKind; id: string }[];
    now?: Date;
  },
): Promise<{ confirmed: number }> {
  const now = args.now ?? new Date();
  const ids = (kind: DraftKind) => [...new Set(args.items.filter((i) => i.kind === kind).map((i) => i.id))];
  const assetIds = ids("dataAsset");
  const activityIds = ids("processingActivity");
  const vendorIds = ids("vendor");
  const wanted = assetIds.length + activityIds.length + vendorIds.length;
  if (wanted === 0) return { confirmed: 0 };

  const base = { organizationId: args.organizationId, ...DRAFT_WHERE };
  const data = { confirmedBy: args.userId, confirmedAt: now };

  return prisma.$transaction(async (tx) => {
    const [a, p, v] = await Promise.all([
      assetIds.length ? tx.dataAsset.updateMany({ where: { ...base, id: { in: assetIds } }, data }) : { count: 0 },
      activityIds.length
        ? tx.processingActivity.updateMany({ where: { ...base, id: { in: activityIds } }, data })
        : { count: 0 },
      vendorIds.length ? tx.vendor.updateMany({ where: { ...base, id: { in: vendorIds } }, data }) : { count: 0 },
    ]);
    if (a.count + p.count + v.count !== wanted) throw new DraftNotFoundError();

    const entityType: Record<DraftKind, string> = {
      dataAsset: "DataAsset",
      processingActivity: "ProcessingActivity",
      vendor: "Vendor",
    };
    const entries = (
      [
        ["dataAsset", assetIds],
        ["processingActivity", activityIds],
        ["vendor", vendorIds],
      ] as const
    ).flatMap(([kind, list]) =>
      list.map((id) => ({
        organizationId: args.organizationId,
        userId: args.userId,
        entityType: entityType[kind],
        entityId: id,
        action: "CONFIRM",
        metadata: { source: "draft-review" },
      })),
    );
    await tx.auditLog.createMany({ data: entries });
    return { confirmed: wanted };
  });
}
