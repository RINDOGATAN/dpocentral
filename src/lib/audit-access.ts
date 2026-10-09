// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Who reads the organisation's audit trail, and what an entry shows
 * (owner's decision, 9 October 2026, mirroring AI Sentinel's audit trail).
 *
 * The trail says who did what and when: it is a record about colleagues as
 * much as about records, so only the roles that run the programme read it:
 *
 *   OWNER, ADMIN, PRIVACY_OFFICER  the whole trail of the organisation
 *   MEMBER, VIEWER                 nothing (the menu entry is not shown and
 *                                  the server refuses)
 *
 * Entries about rights requests (DSARs) show the request's reference and the
 * action only, never the recorded detail. The detail of such an entry can be
 * the request itself (the creation entry copies the form: the data subject's
 * name, address and what they asked for). Who may read a request is decided
 * by src/lib/dsar-access.ts, and every opening of a request is recorded in
 * the request's own log (PR #95); reading it through the trail would skip
 * that record. So the trail never carries it, for any role, on screen or in
 * the CSV, and a reader opens the request itself where the rule applies.
 *
 * Pure: shared by the router, the CSV export, the menu and the page.
 */

export const AUDIT_READER_ROLES = ["OWNER", "ADMIN", "PRIVACY_OFFICER"] as const;

/** The role reads the organisation's audit trail. Unknown or missing role: no. */
export function canReadAuditTrail(role: string | null | undefined): boolean {
  return !!role && (AUDIT_READER_ROLES as readonly string[]).includes(role);
}

/** The record types written about rights requests (src/server/routers/privacy/dsar.ts). */
export const DSAR_AUDIT_ENTITY_TYPES = ["DSARRequest"] as const;

/** An entry about a rights request: by its record type, or any "DSAR..." type added later. */
export function isRightsRequestEntry(entityType: string): boolean {
  return (
    (DSAR_AUDIT_ENTITY_TYPES as readonly string[]).includes(entityType) ||
    /^dsar/i.test(entityType)
  );
}

/** One entry as stored (the fields the trail reads). */
export interface StoredAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  metadata: unknown;
  createdAt: Date;
  userId: string | null;
  user?: { name: string | null; email: string | null } | null;
}

/** One entry as the trail shows it. */
export interface AuditEntryView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  /** The rights request's public reference, where the entry is about one and it still exists. */
  reference: string | null;
  /** True when the recorded detail is withheld (an entry about a rights request). */
  restricted: boolean;
  changes: unknown;
  metadata: unknown;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
}

/**
 * The entry as the trail shows it. `references` maps a rights request's
 * internal id to its public reference (the deletion entry already carries the
 * public reference as its id).
 */
export function auditEntryView(
  row: StoredAuditEntry,
  references: ReadonlyMap<string, string> = new Map(),
): AuditEntryView {
  const restricted = isRightsRequestEntry(row.entityType);
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    reference: restricted ? (references.get(row.entityId) ?? row.entityId) : null,
    restricted,
    changes: restricted ? null : (row.changes ?? null),
    metadata: restricted ? null : (row.metadata ?? null),
    createdAt: row.createdAt,
    // The user relation is SetNull on delete, so an entry can outlive its
    // actor. The page says so rather than showing an empty column.
    actorId: row.userId,
    actorName: row.user?.name ?? null,
    actorEmail: row.user?.email ?? null,
  };
}
