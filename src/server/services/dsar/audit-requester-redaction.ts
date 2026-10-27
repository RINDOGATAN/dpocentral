// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * One-off clean-up of the requester's details left in older audit entries
 * about rights requests (DSARs). Run by scripts/redact-dsar-audit-requester.ts.
 *
 * Where older releases wrote them:
 *   - audit_logs, entityType "DSARRequest", action "CREATE": `changes` held
 *     the whole staff-entry form (requesterName, requesterEmail,
 *     requesterPhone, requesterAddress, relationship, description,
 *     requestedData) until the entry was reduced to type and reference.
 *     Such an entry outlives a request deleted by hand (dsar.deleteDSAR),
 *     and an organisation's deletion (organizationId is set to null).
 *   - dsar_audit_logs, action "REQUEST_CREATED": `details` held
 *     requesterEmail until it was replaced by the public reference.
 *     The per-request redaction (redact.ts) does not clear that key.
 *
 * The entries are redacted, never deleted: only the requester keys listed in
 * REQUESTER_KEYS, inside `changes` / `metadata` (audit_logs) and `details`
 * (dsar_audit_logs), are replaced with REMOVED_MARKER. Action, entity ids,
 * user ids, timestamps and every other key stay, so the trail keeps its
 * shape. Only rights-request entries are read or written: audit_logs rows of
 * entityType "DSARRequest", and dsar_audit_logs rows (which exist only for
 * requests). A key already holding the marker, or null, is left alone, so a
 * second run finds nothing.
 *
 * The result holds counts, organisation ids and row ids, and the NAMES of the
 * keys redacted; never a value.
 */

export const REMOVED_MARKER = "[removed 2026-10]";

/** The general audit trail's entity type for a rights request. */
export const DSAR_REQUEST_ENTITY_TYPE = "DSARRequest";

/** The requester's details, as the request and its staff-entry form name them. */
export const REQUESTER_KEYS = [
  "requesterName",
  "requesterEmail",
  "requesterPhone",
  "requesterAddress",
  "relationship",
  "description",
  "requestedData",
] as const;

/** The JSON columns read, per table. */
const AUDIT_LOG_COLUMNS = ["changes", "metadata"] as const;
const REQUEST_TRAIL_COLUMNS = ["details"] as const;

/** Prisma's 5 s default is too short from an operator's machine to the hosted database. */
export const REDACTION_TX_OPTIONS = { maxWait: 20_000, timeout: 120_000 } as const;

type Json = Prisma.JsonValue;

function isObject(v: Json | undefined): v is Prisma.JsonObject {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Keys of `value` that still hold requester data (present, not null, not the marker). */
export function requesterKeysIn(value: Json | undefined): string[] {
  if (!isObject(value)) return [];
  return REQUESTER_KEYS.filter((k) => {
    const v = value[k];
    return v !== undefined && v !== null && v !== REMOVED_MARKER;
  });
}

/** A copy of `value` with the requester keys replaced by the marker; every other key unchanged. */
export function redactRequesterKeys(value: Prisma.JsonObject, keys: string[]): Prisma.JsonObject {
  const out: Prisma.JsonObject = { ...value };
  for (const k of keys) out[k] = REMOVED_MARKER;
  return out;
}

/** What was found (and, on a real run, redacted) in one table. */
export interface TableResult {
  /** Rows holding at least one requester key. */
  rows: number;
  /** "column.key" -> number of rows where it was found. Names only. */
  fields: Record<string, number>;
  /** The ids of those rows. */
  rowIds: string[];
}

export interface OrgRedactionResult {
  /** null: entries whose organisation was deleted (organizationId set to null). */
  organizationId: string | null;
  slug: string | null;
  auditLog: TableResult;
  requestTrail: TableResult;
  /** Rows written. Zero on a dry run. */
  redacted: number;
}

export interface RedactionResult {
  dryRun: boolean;
  marker: string;
  startedAt: string;
  finishedAt: string;
  organizations: OrgRedactionResult[];
  totals: { rows: number; redacted: number; fields: Record<string, number> };
}

const emptyTable = (): TableResult => ({ rows: 0, fields: {}, rowIds: [] });

interface Row {
  id: string;
  [column: string]: Json | string | undefined;
}

interface Planned {
  id: string;
  data: Record<string, Prisma.JsonObject>;
}

/** Works out, for a set of rows, which columns change and how; counts field names. */
function plan(rows: Row[], columns: readonly string[], table: TableResult): Planned[] {
  const out: Planned[] = [];
  for (const row of rows) {
    const data: Record<string, Prisma.JsonObject> = {};
    for (const col of columns) {
      const value = row[col] as Json | undefined;
      const keys = requesterKeysIn(value);
      if (keys.length === 0) continue;
      data[col] = redactRequesterKeys(value as Prisma.JsonObject, keys);
      for (const k of keys) table.fields[`${col}.${k}`] = (table.fields[`${col}.${k}`] ?? 0) + 1;
    }
    if (Object.keys(data).length > 0) {
      out.push({ id: row.id, data });
      table.rows++;
      table.rowIds.push(row.id);
    }
  }
  return out;
}

type Db = Pick<PrismaClient, "organization" | "auditLog" | "dSARAuditLog" | "$transaction">;
type Tx = Pick<Prisma.TransactionClient, "auditLog" | "dSARAuditLog">;

async function readAuditLog(db: Tx, organizationId: string | null): Promise<Row[]> {
  return (await db.auditLog.findMany({
    where: { organizationId, entityType: DSAR_REQUEST_ENTITY_TYPE },
    select: { id: true, changes: true, metadata: true },
    orderBy: { id: "asc" },
  })) as Row[];
}

async function readRequestTrail(db: Tx, organizationId: string): Promise<Row[]> {
  return (await db.dSARAuditLog.findMany({
    where: { dsarRequest: { organizationId } },
    select: { id: true, details: true },
    orderBy: { id: "asc" },
  })) as Row[];
}

/** Reads (and, unless dry, redacts) one organisation's entries. */
async function runForOrg(
  db: Tx,
  organizationId: string | null,
  slug: string | null,
  dryRun: boolean
): Promise<OrgRedactionResult> {
  const result: OrgRedactionResult = {
    organizationId,
    slug,
    auditLog: emptyTable(),
    requestTrail: emptyTable(),
    redacted: 0,
  };
  const auditPlan = plan(await readAuditLog(db, organizationId), AUDIT_LOG_COLUMNS, result.auditLog);
  // A request always belongs to an organisation: none to read for the orphan group.
  const trailPlan =
    organizationId === null
      ? []
      : plan(await readRequestTrail(db, organizationId), REQUEST_TRAIL_COLUMNS, result.requestTrail);

  if (dryRun) return result;

  for (const p of auditPlan) {
    // The where repeats the scope, so a row can only be written if it is still a rights-request entry.
    const res = await db.auditLog.updateMany({
      where: { id: p.id, organizationId, entityType: DSAR_REQUEST_ENTITY_TYPE },
      data: p.data,
    });
    result.redacted += res.count;
  }
  for (const p of trailPlan) {
    const res = await db.dSARAuditLog.updateMany({
      where: { id: p.id, dsarRequest: { organizationId: organizationId! } },
      data: p.data,
    });
    result.redacted += res.count;
  }
  const planned = auditPlan.length + trailPlan.length;
  if (result.redacted !== planned) {
    // Throwing rolls the organisation back.
    throw new Error(
      `Organisation ${organizationId ?? "(none)"}: ${planned} rows planned, ${result.redacted} written. Rolled back.`
    );
  }
  return result;
}

export interface RedactionOptions {
  /** Organisation ids or slugs. Omitted with `all: true`. */
  organizations?: string[];
  /** Every organisation, plus entries whose organisation was deleted. */
  all?: boolean;
  dryRun: boolean;
  now?: () => Date;
}

export async function redactDsarAuditRequester(db: Db, opts: RedactionOptions): Promise<RedactionResult> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (!opts.all && (!opts.organizations || opts.organizations.length === 0)) {
    throw new Error("Name the organizations (--org <id or slug>) or pass --all.");
  }

  const orgs = await db.organization.findMany({
    where: opts.all
      ? {}
      : { OR: [{ id: { in: opts.organizations! } }, { slug: { in: opts.organizations! } }] },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (!opts.all) {
    const known = new Set(orgs.flatMap((o) => [o.id, o.slug]));
    const missing = opts.organizations!.filter((o) => !known.has(o));
    if (missing.length > 0) {
      throw new Error(`Unknown organization(s): ${missing.join(", ")}. Nothing was changed.`);
    }
  }

  const targets: { id: string | null; slug: string | null }[] = orgs.map((o) => ({ id: o.id, slug: o.slug }));
  if (opts.all) targets.push({ id: null, slug: null });

  const results: OrgRedactionResult[] = [];
  for (const t of targets) {
    // Read outside a transaction first; open one only where there is something to write.
    const found = await runForOrg(db, t.id, t.slug, true);
    const rows = found.auditLog.rows + found.requestTrail.rows;
    if (opts.dryRun || rows === 0) {
      results.push(found);
      continue;
    }
    const done = await db.$transaction(
      (tx) => runForOrg(tx, t.id, t.slug, false),
      REDACTION_TX_OPTIONS
    );
    results.push(done);
  }

  const fields: Record<string, number> = {};
  for (const r of results) {
    for (const table of [r.auditLog, r.requestTrail]) {
      for (const [k, n] of Object.entries(table.fields)) fields[k] = (fields[k] ?? 0) + n;
    }
  }

  return {
    dryRun: opts.dryRun,
    marker: REMOVED_MARKER,
    startedAt,
    finishedAt: now().toISOString(),
    organizations: results,
    totals: {
      rows: results.reduce((n, r) => n + r.auditLog.rows + r.requestTrail.rows, 0),
      redacted: results.reduce((n, r) => n + r.redacted, 0),
      fields,
    },
  };
}
