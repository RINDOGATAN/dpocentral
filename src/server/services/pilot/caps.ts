// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { brand } from "@/config/brand";
import {
  isHostedDeployment,
  MANAGED_URL,
  PILOT_EXPORT_PATH,
  RUN_YOUR_OWN_URL,
} from "@/lib/hosted";

/**
 * Hosted pilot caps.
 *
 * The hosted service is a free pilot. Every module is open to every
 * organisation, and these caps apply:
 *   - one organisation per account;
 *   - edits for PILOT_DAYS from the organisation's first sign-in after the
 *     pilot went live, then read-only (exports stay available: they are GET
 *     routes under /api/export);
 *   - a ceiling on the records an organisation can hold (PILOT_LIMITS).
 * The self-hosted kit is never capped: every function here is a no-op unless
 * isHostedDeployment() is true.
 */

export const PILOT_DAYS = 90;

/**
 * The date the hosted pilot went live. The editing window never starts before
 * it, and a sign-in before it does not start the clock.
 */
export const PILOT_CLOCK_START = new Date("2026-10-01T00:00:00Z");

/**
 * The field the pilot clock reads. `pilotStartedAt` is the organisation's
 * first sign-in after the pilot went live; null until that sign-in happens.
 */
export type PilotClockOrg = { pilotStartedAt: Date | null };

export type PilotResource =
  | "dataAssets"
  | "dataElements"
  | "processingActivities"
  | "dataFlows"
  | "dataTransfers"
  | "vendors"
  | "vendorContracts"
  | "dsarRequests"
  | "assessments"
  | "assessmentTemplates"
  | "incidents"
  | "aiSystems"
  | "members";

/** Records ceiling per organisation on the hosted pilot. */
export const PILOT_LIMITS: Record<PilotResource, number> = {
  dataAssets: 25,
  dataElements: 250,
  processingActivities: 50,
  dataFlows: 100,
  dataTransfers: 50,
  vendors: 50,
  vendorContracts: 50,
  dsarRequests: 100,
  assessments: 25,
  assessmentTemplates: 10,
  incidents: 25,
  aiSystems: 25,
  members: 5,
};

type CountDelegate = { count: (args: { where: object }) => Promise<number> };

/** The Prisma models the caps count; satisfied by the client and by a transaction. */
export type PilotDb = {
  dataAsset: CountDelegate;
  dataElement: CountDelegate;
  processingActivity: CountDelegate;
  dataFlow: CountDelegate;
  dataTransfer: CountDelegate;
  vendor: CountDelegate;
  vendorContract: CountDelegate;
  dSARRequest: CountDelegate;
  assessment: CountDelegate;
  assessmentTemplate: CountDelegate;
  incident: CountDelegate;
  aISystem: CountDelegate;
  organizationMember: CountDelegate;
};

const COUNTERS: Record<PilotResource, (db: PilotDb, organizationId: string) => Promise<number>> = {
  dataAssets: (db, organizationId) => db.dataAsset.count({ where: { organizationId } }),
  dataElements: (db, organizationId) => db.dataElement.count({ where: { organizationId } }),
  processingActivities: (db, organizationId) =>
    db.processingActivity.count({ where: { organizationId } }),
  dataFlows: (db, organizationId) => db.dataFlow.count({ where: { organizationId } }),
  dataTransfers: (db, organizationId) => db.dataTransfer.count({ where: { organizationId } }),
  vendors: (db, organizationId) => db.vendor.count({ where: { organizationId } }),
  vendorContracts: (db, organizationId) =>
    db.vendorContract.count({ where: { vendor: { organizationId } } }),
  dsarRequests: (db, organizationId) => db.dSARRequest.count({ where: { organizationId } }),
  assessments: (db, organizationId) => db.assessment.count({ where: { organizationId } }),
  assessmentTemplates: (db, organizationId) =>
    db.assessmentTemplate.count({ where: { organizationId } }),
  incidents: (db, organizationId) => db.incident.count({ where: { organizationId } }),
  aiSystems: (db, organizationId) => db.aISystem.count({ where: { organizationId } }),
  members: (db, organizationId) => db.organizationMember.count({ where: { organizationId } }),
};

/**
 * tRPC mutations that add one record of a capped resource. Mutations that add
 * several records at once (quickstart.execute) check the ceiling themselves.
 */
export const CAPPED_CREATE_PATHS: Record<string, PilotResource> = {
  "dataInventory.createAsset": "dataAssets",
  "dataInventory.addElement": "dataElements",
  "dataInventory.createActivity": "processingActivities",
  "dataInventory.createFlow": "dataFlows",
  "dataInventory.createTransfer": "dataTransfers",
  "vendor.create": "vendors",
  "vendor.addContract": "vendorContracts",
  "dsar.create": "dsarRequests",
  "assessment.create": "assessments",
  "assessment.createForTransfer": "assessments",
  "assessment.createTemplate": "assessmentTemplates",
  "assessment.cloneTemplate": "assessmentTemplates",
  "incident.create": "incidents",
  "aiGovernance.create": "aiSystems",
  "organization.addMember": "members",
};

/**
 * Mutations still allowed once the pilot is read-only: they produce an
 * export or change nothing the organisation holds.
 */
export const READ_ONLY_ALLOWED_PATHS = new Set<string>([
  // Sends the organisation's AI systems to AI Sentinel: an export.
  "aiGovernance.exportToAiSentinel",
]);

type Locale = "en" | "es";

/** Lower-case names of the capped resources, for use inside a sentence or list. */
export const RESOURCE_LABELS: Record<PilotResource, Record<Locale, string>> = {
  dataAssets: { en: "systems", es: "sistemas" },
  dataElements: { en: "data elements", es: "elementos de datos" },
  processingActivities: { en: "processing activities", es: "actividades de tratamiento" },
  dataFlows: { en: "data flows", es: "flujos de datos" },
  dataTransfers: { en: "transfers", es: "transferencias" },
  vendors: { en: "vendors", es: "proveedores" },
  vendorContracts: { en: "vendor contracts", es: "contratos con proveedores" },
  dsarRequests: { en: "data subject requests", es: "solicitudes de interesados" },
  assessments: { en: "assessments", es: "evaluaciones" },
  assessmentTemplates: { en: "assessment templates", es: "plantillas de evaluación" },
  incidents: { en: "incidents", es: "incidentes" },
  aiSystems: { en: "AI systems", es: "sistemas de IA" },
  members: { en: "members", es: "miembros" },
};

export function pilotLocale(value: string | undefined): Locale {
  return value?.toLowerCase().startsWith("es") ? "es" : "en";
}

function exportUrl(): string {
  return `${brand.appUrl.replace(/\/$/, "")}${PILOT_EXPORT_PATH}`;
}

export function pilotMessage(
  kind: "readOnly" | "ceiling" | "oneOrganization",
  locale: Locale,
  resource?: PilotResource
): string {
  const run = RUN_YOUR_OWN_URL;
  const exp = exportUrl();
  if (kind === "readOnly") {
    return locale === "es"
      ? `Esta organización piloto es de solo lectura: el piloto de ${PILOT_DAYS} días ha terminado. Puedes seguir exportando todo lo que creaste (${exp}) o ejecutar tu propia instancia (${run}).`
      : `This pilot organization is read-only: the ${PILOT_DAYS}-day pilot has ended. You can still export everything you created (${exp}) or run your own instance (${run}).`;
  }
  if (kind === "oneOrganization") {
    return locale === "es"
      ? `El piloto alojado admite una organización por cuenta. Para gestionar más, ejecuta tu propia instancia (${run}). Puedes exportar lo que ya tienes (${exp}).`
      : `The hosted pilot allows one organization per account. To manage more, run your own instance (${run}). You can export what you already have (${exp}).`;
  }
  const r = resource ?? "dataAssets";
  const limit = PILOT_LIMITS[r];
  const label = RESOURCE_LABELS[r][locale];
  return locale === "es"
    ? `Has alcanzado el límite del piloto: ${limit} ${label}. Para seguir, ejecuta tu propia instancia (${run}) o exporta tus registros (${exp}).`
    : `You have reached the pilot limit of ${limit} ${label}. To continue, run your own instance (${run}) or export your records (${exp}).`;
}

// ── Impact assessments on the trial ──────────────────────────────────────

/**
 * Impact assessments (type DPIA) an organisation may create on the hosted
 * trial. The overall records ceiling (PILOT_LIMITS.assessments) still
 * applies; this narrower rule bites first.
 */
export const HOSTED_DPIA_LIMIT = 3;

/**
 * The count is of impact assessments CREATED, not of the ones still there:
 * deleting one does not free a place. Two sources, and the larger wins:
 *
 *  - the audit log, which records every creation and survives a deletion;
 *  - the assessments the organisation holds now, which covers anything
 *    created before the audit entry carried the template type.
 */
export type DpiaCountDb = {
  auditLog: { count: (args: { where: object }) => Promise<number> };
  assessment: { count: (args: { where: object }) => Promise<number> };
};

export async function countDpiaCreated(
  db: DpiaCountDb,
  organizationId: string
): Promise<number> {
  const [logged, held] = await Promise.all([
    db.auditLog.count({
      where: {
        organizationId,
        entityType: "Assessment",
        action: "CREATE",
        changes: { path: ["templateType"], equals: "DPIA" },
      },
    }),
    db.assessment.count({
      where: { organizationId, template: { type: "DPIA" } },
    }),
  ]);
  return Math.max(logged, held);
}

export type DpiaQuota =
  | { capped: false }
  | { capped: true; limit: number; used: number; remaining: number };

/** What the new-assessment screen shows. Uncapped off the hosted trial. */
export async function hostedDpiaQuota(
  db: DpiaCountDb,
  organizationId: string
): Promise<DpiaQuota> {
  if (!isHostedDeployment()) return { capped: false };
  const used = await countDpiaCreated(db, organizationId);
  return {
    capped: true,
    limit: HOSTED_DPIA_LIMIT,
    used,
    remaining: Math.max(0, HOSTED_DPIA_LIMIT - used),
  };
}

/** The one link in the limit message, in the reader's language. */
export const KEEP_GOING_LABEL: Record<Locale, string> = {
  en: "Keep going on your own instance",
  es: "Sigue en tu propia instancia",
};

/**
 * What a firm is told when the trial's impact assessments are used up: what
 * the trial includes, that deleting does not free a place, and one link to
 * keep going on an instance of their own (the managed service). No price, and
 * nothing already created is touched: editing, submitting, approving and
 * exporting stay open.
 */
export function dpiaCapMessage(locale: Locale): string {
  const keepGoing = `${KEEP_GOING_LABEL[locale]}: ${MANAGED_URL[locale]}`;
  return locale === "es"
    ? `El piloto incluye ${HOSTED_DPIA_LIMIT} evaluaciones de impacto y esta organización ya las ha usado todas. Se cuentan las evaluaciones creadas, así que borrar una no libera plaza. Las que ya existen se pueden seguir editando, presentando, aprobando y exportando. Un despliegue propio, alojado o en tus instalaciones, no tiene este límite. ${keepGoing}`
    : `The trial includes ${HOSTED_DPIA_LIMIT} impact assessments, and this organization has used all of them. The count is of the assessments created, so deleting one does not free a place. The ones already there can still be edited, submitted, approved and exported. A deployment of your own, hosted or on your premises, has no such limit. ${keepGoing}`;
}

// ── A pilot limit reached: one audit row, read as a count ───────────────

/**
 * The audit action written when a pilot limit refuses an action. The
 * storefront's daily digest counts distinct organisations with this action
 * over the last day, and scripts/count-accounts.mjs counts them for the
 * board. Do not rename it, or the limit names below.
 */
export const PILOT_LIMIT_REACHED = "PILOT_LIMIT_REACHED";

/** Short fixed names of the limits that write the row. */
export type PilotLimitName = "impact_assessments";

export type PilotLimitAuditDb = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
};

/**
 * Records that `organizationId` reached `limit`: at most one row per
 * organisation, per limit, per calendar day (UTC). The row id is derived from
 * those three, so a second refusal the same day, even a concurrent one,
 * collides on the primary key and writes nothing. The row carries the limit's
 * name and nothing else: no user, no free text. Never throws: a failure to
 * write must not change the refusal the caller is about to return.
 */
export async function recordPilotLimitReached(
  db: PilotLimitAuditDb,
  organizationId: string,
  limit: PilotLimitName,
  now: Date = new Date()
): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  try {
    await db.auditLog.create({
      data: {
        id: `pilot-limit-${limit}-${day}-${organizationId}`,
        organizationId,
        entityType: "Organization",
        entityId: organizationId,
        action: PILOT_LIMIT_REACHED,
        metadata: { limit },
      },
    });
  } catch {
    // Already recorded today (primary key), or the write failed: either way
    // the refusal goes ahead unchanged.
  }
}

/**
 * Throws FORBIDDEN on the hosted trial once the allowance is used up, after
 * recording that the organisation reached the limit.
 */
export async function assertHostedDpiaQuota(
  db: DpiaCountDb & PilotLimitAuditDb,
  organizationId: string,
  locale: Locale = "en"
): Promise<void> {
  if (!isHostedDeployment()) return;
  const used = await countDpiaCreated(db, organizationId);
  if (used >= HOSTED_DPIA_LIMIT) {
    await recordPilotLimitReached(db, organizationId, "impact_assessments");
    throw new TRPCError({ code: "FORBIDDEN", message: dpiaCapMessage(locale) });
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Start of the editing window: the first sign-in after the pilot went live,
 * never before PILOT_CLOCK_START. Null while no sign-in has been recorded (an
 * organisation that existed before the pilot starts at its next sign-in, not
 * at its creation date).
 */
export function pilotStart(org: PilotClockOrg): Date | null {
  if (!org.pilotStartedAt) return null;
  const signedIn = new Date(org.pilotStartedAt);
  return signedIn > PILOT_CLOCK_START ? signedIn : PILOT_CLOCK_START;
}

export function pilotEndsAt(org: PilotClockOrg): Date | null {
  const start = pilotStart(org);
  return start ? new Date(start.getTime() + PILOT_DAYS * DAY_MS) : null;
}

/** Whole days of editing left (0 once read-only; the full window before it starts). */
export function pilotDaysLeft(org: PilotClockOrg, now: Date = new Date()): number {
  const end = pilotEndsAt(org);
  if (!end) return PILOT_DAYS;
  const ms = end.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

export function isPilotReadOnly(org: PilotClockOrg, now: Date = new Date()): boolean {
  const end = pilotEndsAt(org);
  return end !== null && now.getTime() >= end.getTime();
}

/**
 * Records the organisation's first sign-in after the pilot went live. Called
 * when a signed-in member reaches the organisation (src/server/trpc.ts). A
 * no-op on the kit, before PILOT_CLOCK_START, and once a start is recorded.
 * Sets `org.pilotStartedAt` in place so the rest of the request sees it. The
 * update only matches a null column, so a concurrent request cannot move a
 * recorded start.
 */
export async function recordPilotFirstSignIn(
  db: {
    organization: {
      updateMany: (args: { where: object; data: object }) => Promise<unknown>;
    };
  },
  org: { id: string } & PilotClockOrg,
  now: Date = new Date()
): Promise<void> {
  if (!isHostedDeployment()) return;
  if (org.pilotStartedAt) return;
  if (now.getTime() < PILOT_CLOCK_START.getTime()) return;
  await db.organization.updateMany({
    where: { id: org.id, pilotStartedAt: null },
    data: { pilotStartedAt: now },
  });
  org.pilotStartedAt = now;
}

/** Throws FORBIDDEN on the hosted pilot once the organisation is read-only. */
export function assertPilotWritable(
  org: PilotClockOrg,
  locale: Locale = "en",
  now: Date = new Date()
): void {
  if (!isHostedDeployment()) return;
  if (isPilotReadOnly(org, now)) {
    throw new TRPCError({ code: "FORBIDDEN", message: pilotMessage("readOnly", locale) });
  }
}

/**
 * Throws FORBIDDEN on the hosted pilot when adding `adding` records would take
 * the organisation over the ceiling. With adding = 0 it checks that the
 * current count is within the ceiling (used after a batch insert, inside the
 * transaction, so an over-limit batch rolls back).
 */
export async function assertPilotCapacity(
  db: PilotDb,
  organizationId: string,
  resource: PilotResource,
  adding = 1,
  locale: Locale = "en"
): Promise<void> {
  if (!isHostedDeployment()) return;
  const used = await COUNTERS[resource](db, organizationId);
  if (used + adding > PILOT_LIMITS[resource]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: pilotMessage("ceiling", locale, resource),
    });
  }
}

/** True when one more record of `resource` fits under the ceiling. */
export async function hasPilotRoom(
  db: PilotDb,
  organizationId: string,
  resource: PilotResource
): Promise<boolean> {
  if (!isHostedDeployment()) return true;
  const used = await COUNTERS[resource](db, organizationId);
  return used < PILOT_LIMITS[resource];
}

/**
 * Hosted pilot: an account may belong to one organisation. Throws when the
 * user already has a membership.
 */
export async function assertOneOrganizationPerAccount(
  db: { organizationMember: CountDelegate },
  userId: string,
  locale: Locale = "en"
): Promise<void> {
  if (!isHostedDeployment()) return;
  const memberships = await db.organizationMember.count({ where: { userId } });
  if (memberships > 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: pilotMessage("oneOrganization", locale),
    });
  }
}

/** Resources shown on the Settings pilot card, in display order. */
const STATUS_RESOURCES: PilotResource[] = [
  "dataAssets",
  "processingActivities",
  "vendors",
  "dsarRequests",
  "assessments",
  "incidents",
  "aiSystems",
  "members",
];

export type PilotStatus =
  | { hosted: false }
  | {
      hosted: true;
      days: number;
      daysLeft: number;
      /** False until the first sign-in after the pilot went live is recorded. */
      started: boolean;
      endsAt: Date | null;
      readOnly: boolean;
      usage: { resource: PilotResource; used: number; limit: number }[];
    };

export async function getPilotStatus(
  db: PilotDb,
  org: { id: string } & PilotClockOrg,
  now: Date = new Date()
): Promise<PilotStatus> {
  if (!isHostedDeployment()) return { hosted: false };
  const usage = await Promise.all(
    STATUS_RESOURCES.map(async (resource) => ({
      resource,
      used: await COUNTERS[resource](db, org.id),
      limit: PILOT_LIMITS[resource],
    }))
  );
  return {
    hosted: true,
    days: PILOT_DAYS,
    started: pilotStart(org) !== null,
    daysLeft: pilotDaysLeft(org, now),
    endsAt: pilotEndsAt(org),
    readOnly: isPilotReadOnly(org, now),
    usage,
  };
}
