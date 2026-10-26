// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * TODO.LAW as a processor in every hosted organisation's own programme.
 *
 * On the hosted service, RINDOGATAN LLC (TODO.LAW) processes the
 * organisation's data under the processing agreement it accepted when it was
 * opened (src/config/pilot-dpa.ts). So the programme should show it: once that
 * acceptance is on record, the app adds, as drafts for the organisation to
 * confirm (provenance AUTO_TEMPLATE, nobody has confirmed them yet):
 *
 *   1. the vendor TODO.LAW, in use, from the catalogue record "todo-law";
 *   2. its processing agreement, as a contract in force from the date of the
 *      acceptance, naming the accepted version;
 *   3. one international transfer to the United States (staff access), under
 *      the EU standard contractual clauses, Module Two, incorporated into the
 *      agreement; its verdict is left to the organisation (PENDING).
 *
 * The transfer hangs off the vendor, not off a processing activity: it is the
 * organisation's transfer to its processor, whichever activities use the
 * service. With no activity, "draft" for the transfer follows its vendor
 * (src/server/services/program/path-counts.ts), so it counts only once a
 * person confirms TODO.LAW.
 *
 * Never on the self-hosted kit: there we are not the processor. Idempotent:
 * an organisation that already has a vendor from this source, or one named
 * TODO.LAW, is left as it is. Written in the language of the acceptance (the
 * language the person was using when they opened the organisation); shown in
 * each reader's language (src/lib/system-content/).
 */

import type { Prisma } from "@prisma/client";
import type { Db as AppDb } from "@/lib/prisma";
import {
  PILOT_DPA_ACTION,
  isAcceptedDpaVersion,
  type PilotDpaLocale,
} from "@/config/pilot-dpa";
import { isHostedDeployment } from "@/lib/hosted";

/** The vendor's sourceRef and the catalogue slug it comes from. */
export { TODOLAW_SOURCE_REF } from "@/lib/todolaw-source";
import { TODOLAW_SOURCE_REF } from "@/lib/todolaw-source";
export {
  TODOLAW_VENDOR_NAME,
  TODOLAW_ENTITY,
  TODOLAW_LINKS,
} from "@/config/todolaw-processor-text";
import {
  TODOLAW_VENDOR_NAME,
  TODOLAW_ENTITY,
  TODOLAW_LINKS,
  TODOLAW_PROCESSOR_TEXT as TEXT,
} from "@/config/todolaw-processor-text";

type Db = AppDb;

export interface TodoLawAcceptance {
  version: string;
  at: Date;
  locale: PilotDpaLocale;
}

/** The organisation's latest still-valid acceptance of the agreement, or null. */
export async function latestDpaAcceptance(
  db: Db,
  organizationId: string,
): Promise<TodoLawAcceptance | null> {
  const entries = await db.auditLog.findMany({
    where: { organizationId, action: PILOT_DPA_ACTION },
    select: { changes: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const e of entries) {
    const changes = (e.changes ?? {}) as {
      dpaVersion?: unknown;
      locale?: unknown;
    };
    if (!isAcceptedDpaVersion(changes.dpaVersion)) continue;
    return {
      version: changes.dpaVersion as string,
      at: e.createdAt,
      locale: changes.locale === "es" ? "es" : "en",
    };
  }
  return null;
}

export type TodoLawResult =
  | { added: true; vendorId: string }
  | { added: false; reason: "kit" | "no-acceptance" | "exists" };

/** Whether the organisation already holds TODO.LAW as a vendor (from this source, or by name). */
export async function hasTodoLawVendor(
  db: Db,
  organizationId: string,
): Promise<boolean> {
  const existing = await db.vendor.findFirst({
    where: {
      organizationId,
      OR: [
        { sourceRef: TODOLAW_SOURCE_REF },
        { name: { equals: TODOLAW_VENDOR_NAME, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Adds TODO.LAW (vendor, agreement, transfer) to a hosted organisation's
 * programme as drafts, once its acceptance of the agreement is on record.
 */
export async function ensureTodoLawProcessor(
  db: Db,
  organizationId: string,
  opts: { hosted?: boolean } = {},
): Promise<TodoLawResult> {
  if (!(opts.hosted ?? isHostedDeployment()))
    return { added: false, reason: "kit" };
  const acceptance = await latestDpaAcceptance(db, organizationId);
  if (!acceptance) return { added: false, reason: "no-acceptance" };
  if (await hasTodoLawVendor(db, organizationId))
    return { added: false, reason: "exists" };

  const t = TEXT[acceptance.locale];
  const catalog = await db.vendorCatalog
    .findUnique({
      where: { slug: TODOLAW_SOURCE_REF },
      select: { category: true, certifications: true },
    })
    .catch(() => null);

  // The three records go in together or not at all, so that a failure never
  // leaves a vendor without its agreement or transfer (and idempotence then
  // never re-adds them).
  const write = async (tx: Prisma.TransactionClient): Promise<string> => {
    const vendor = await tx.vendor.create({
      data: {
        organizationId,
        name: TODOLAW_VENDOR_NAME,
        description: t.description,
        website: TODOLAW_LINKS.website,
        status: "ACTIVE",
        categories: [catalog?.category ?? "Privacy & Consent"],
        // The organisation's users (identifiers) and, through the programme, the
        // people its records describe; the organisation adjusts it when it confirms.
        dataProcessed: ["IDENTIFIERS"],
        countries: ["DE", "US"],
        certifications: catalog?.certifications ?? [],
        provenance: "AUTO_TEMPLATE",
        sourceRef: TODOLAW_SOURCE_REF,
        metadata: {
          source: TODOLAW_SOURCE_REF,
          catalogSlug: TODOLAW_SOURCE_REF,
          legalEntity: TODOLAW_ENTITY,
          dpaUrl: TODOLAW_LINKS.dpa[acceptance.locale],
          subprocessorsUrl: TODOLAW_LINKS.subprocessors[acceptance.locale],
          sccsUrl: TODOLAW_LINKS.sccs,
        },
      },
      select: { id: true },
    });

    await tx.vendorContract.create({
      data: {
        vendorId: vendor.id,
        type: "DPA",
        status: "ACTIVE",
        name: t.contractName(acceptance.version),
        description: t.contractDescription(
          TODOLAW_LINKS.subprocessors[acceptance.locale],
        ),
        documentUrl: TODOLAW_LINKS.dpa[acceptance.locale],
        startDate: acceptance.at,
        metadata: {
          source: TODOLAW_SOURCE_REF,
          dpaVersion: acceptance.version,
        },
      },
    });

    await tx.dataTransfer.create({
      data: {
        organizationId,
        vendorId: vendor.id,
        name: t.transferName,
        description: t.transferDescription,
        destinationCountry: "US",
        destinationOrg: TODOLAW_ENTITY,
        mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
        safeguards: t.safeguards,
        documentUrl: TODOLAW_LINKS.sccs,
        complianceStatus: "PENDING",
        metadata: { source: TODOLAW_SOURCE_REF },
      },
    });
    return vendor.id;
  };

  const vendorId = await db.$transaction((tx) => write(tx as Prisma.TransactionClient));
  // The ready-made assessment, measures and checklist for the transfer. A
  // failure here leaves the three records in place; the backfill completes it.
  try {
    const { prefillTodoLawTransfer } = await import("./todolaw-transfer-assessment");
    await prefillTodoLawTransfer(db, organizationId, acceptance.locale);
  } catch {
    // Best effort: scripts/backfill-todolaw-tia.ts fills it later.
  }
  return { added: true, vendorId };
}

// ── Backfill (scripts/backfill-todolaw-vendor.ts) ───────────────────────

export interface TodoLawBackfillRow {
  organizationId: string;
  /** What happens (dry run) or happened (execute) for this organisation. */
  outcome: "add" | "added" | "exists" | "no-acceptance";
}

/**
 * The organisations that would get (dry run) or got (execute) TODO.LAW, one
 * row each. Only organisations with an acceptance of the agreement on record
 * are hosted ones (the kit never records it); the others are reported as
 * "no-acceptance" and left alone. Counts only: no names.
 */
export async function backfillTodoLawProcessor(
  db: AppDb,
  opts: { execute: boolean },
): Promise<TodoLawBackfillRow[]> {
  const orgs = await db.organization.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const rows: TodoLawBackfillRow[] = [];
  for (const { id } of orgs) {
    if (!(await latestDpaAcceptance(db, id))) {
      rows.push({ organizationId: id, outcome: "no-acceptance" });
    } else if (await hasTodoLawVendor(db, id)) {
      rows.push({ organizationId: id, outcome: "exists" });
    } else if (!opts.execute) {
      rows.push({ organizationId: id, outcome: "add" });
    } else {
      const result = await ensureTodoLawProcessor(db, id, { hosted: true });
      rows.push({
        organizationId: id,
        outcome: result.added
          ? "added"
          : result.reason === "exists"
            ? "exists"
            : "no-acceptance",
      });
    }
  }
  return rows;
}
