// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which of the caller's organisations a record belongs to.
 *
 * A record page queries with the organisation selected in the browser. A link
 * from a reminder e-mail may point at a record
 * of another organisation the same person is a member of; that query answers
 * NOT_FOUND. This lookup lets the page find the owning organisation and switch
 * to it. It answers null, and nothing else, for a record the caller is not a
 * member of: the answer never reveals whether such a record exists.
 */

export const RECORD_KINDS = ["incident", "dsar", "assessment", "vendor", "dataAsset", "aiSystem"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

type OrgRow = { id: string; name: string; slug: string };

type RecordDelegate = {
  findUnique: (args: { where: { id: string }; select: { organizationId: true } }) => Promise<{ organizationId: string } | null>;
};

export type RecordLocatorDb = {
  incident: RecordDelegate;
  dSARRequest: RecordDelegate;
  assessment: RecordDelegate;
  vendor: RecordDelegate;
  dataAsset: RecordDelegate;
  aISystem: RecordDelegate;
  organizationMember: {
    findFirst: (args: {
      where: { userId: string; organizationId: string };
      select: { organization: { select: { id: true; name: true; slug: true } } };
    }) => Promise<{ organization: OrgRow } | null>;
  };
};

/** The Prisma delegate that holds each kind of record. */
export function delegateFor(db: RecordLocatorDb, kind: RecordKind): RecordDelegate {
  switch (kind) {
    case "incident":
      return db.incident;
    case "dsar":
      return db.dSARRequest;
    case "assessment":
      return db.assessment;
    case "vendor":
      return db.vendor;
    case "dataAsset":
      return db.dataAsset;
    case "aiSystem":
      return db.aISystem;
  }
}

/**
 * The organisation that owns the record, if the user is a member of it;
 * null otherwise (unknown record, or an organisation the user is not in).
 */
export async function locateRecordForUser(
  db: RecordLocatorDb,
  userId: string,
  kind: RecordKind,
  id: string
): Promise<OrgRow | null> {
  const row = await delegateFor(db, kind).findUnique({ where: { id }, select: { organizationId: true } });
  if (!row) return null;
  const membership = await db.organizationMember.findFirst({
    where: { userId, organizationId: row.organizationId },
    select: { organization: { select: { id: true, name: true, slug: true } } },
  });
  return membership?.organization ?? null;
}
