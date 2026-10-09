// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reading the organisation's audit trail: the filter shared by the page, its
 * facets and the CSV export, so the three never disagree, and the step that
 * turns stored rows into what the trail shows (src/lib/audit-access.ts).
 *
 * The trail is only read here. Entries are appended by the actions that cause
 * them and are never edited or deleted from this code.
 *
 * Without the rights-request module (NEXT_PUBLIC_DSAR_ENABLED=false) the
 * entries about rights requests are left out, as on the dashboard; owners and
 * admins still take those records with GET /api/export/rights-requests.
 */

import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import { isDsarModuleEnabled } from "@/config/features";
import {
  auditEntryView,
  DSAR_AUDIT_ENTITY_TYPES,
  isRightsRequestEntry,
  type AuditEntryView,
  type StoredAuditEntry,
} from "@/lib/audit-access";

export interface AuditFilters {
  /** The record type ("area"): DataAsset, Vendor, Assessment... */
  entityType?: string;
  action?: string;
  /** The person who acted. */
  userId?: string;
  /** Inclusive lower bound on the time of the entry. */
  from?: Date;
  /** Inclusive upper bound on the time of the entry. */
  to?: Date;
}

/** The where-clause for the organisation's trail with these filters. */
export function auditWhere(
  organizationId: string,
  f: AuditFilters,
  dsarOn: boolean = isDsarModuleEnabled(),
): Prisma.AuditLogWhereInput {
  let entityType: Prisma.AuditLogWhereInput = {};
  if (f.entityType) {
    // A rights-request area asked for while the module is off matches nothing.
    entityType =
      !dsarOn && isRightsRequestEntry(f.entityType)
        ? { entityType: { in: [] } }
        : { entityType: f.entityType };
  } else if (!dsarOn) {
    // The same test as isRightsRequestEntry: the known types and any "DSAR..." one.
    entityType = {
      AND: [
        { entityType: { notIn: [...DSAR_AUDIT_ENTITY_TYPES] } },
        { NOT: { entityType: { startsWith: "DSAR", mode: "insensitive" } } },
      ],
    };
  }
  return {
    organizationId,
    ...entityType,
    ...(f.action ? { action: f.action } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.from || f.to
      ? {
          createdAt: {
            ...(f.from ? { gte: f.from } : {}),
            ...(f.to ? { lte: f.to } : {}),
          },
        }
      : {}),
  };
}

/**
 * The rows as the trail shows them: entries about rights requests carry the
 * request's public reference and no detail. The references are looked up in
 * this organisation only.
 */
export async function toAuditViews(
  prisma: Db,
  organizationId: string,
  rows: StoredAuditEntry[],
): Promise<AuditEntryView[]> {
  const requestIds = [
    ...new Set(rows.filter((r) => isRightsRequestEntry(r.entityType)).map((r) => r.entityId)),
  ];
  const references = new Map<string, string>();
  if (requestIds.length > 0) {
    const found = await prisma.dSARRequest.findMany({
      where: { organizationId, id: { in: requestIds } },
      select: { id: true, publicId: true },
    });
    for (const r of found) references.set(r.id, r.publicId);
  }
  return rows.map((r) => auditEntryView(r, references));
}

/** The fields a row is read with. */
export const AUDIT_ROW_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  changes: true,
  metadata: true,
  createdAt: true,
  userId: true,
  user: { select: { name: true, email: true } },
} as const;
