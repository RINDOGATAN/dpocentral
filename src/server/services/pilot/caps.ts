// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { brand } from "@/config/brand";
import { isDsarModuleEnabled } from "@/config/features";
import {
  isHostedDeployment,
  PILOT_EXPORT_PATH,
  managedUrl,
  PLANS_URL,
  plansUrl,
} from "@/lib/hosted";
import {
  PILOT_DAYS,
  PILOT_DAYS_BEFORE_SHORTENING,
  PILOT_DPIA_LIMIT,
  PILOT_LIMITS,
  RESOURCE_LABELS,
  PILOT_WINDOW_SHORTENED_AT,
  ORGANIZATIONS_PER_ACCOUNT,
  type PilotResource,
} from "./limits";
import { groupOrganizationIds, groupWhere } from "./umbrella";

export {
  PILOT_DAYS,
  PILOT_DAYS_BEFORE_SHORTENING,
  PILOT_DPIA_LIMIT,
  PILOT_LIMITS,
  PILOT_WINDOW_SHORTENED_AT,
  RESOURCE_LABELS,
  ORGANIZATIONS_PER_ACCOUNT,
  type PilotResource,
};

/**
 * Hosted pilot caps.
 *
 * The hosted service is a free pilot. Every module is open to every
 * organisation, and these caps apply:
 *   - up to ORGANIZATIONS_PER_ACCOUNT organisations per account;
 *   - edits for PILOT_DAYS from the organisation's first sign-in after the
 *     pilot went live, then read-only (exports stay available: they are GET
 *     routes under /api/export);
 *   - a ceiling on the records an organisation can hold (PILOT_LIMITS).
 * The window, the ceilings and the free DPIAs belong to the paying customer,
 * not to each organisation: every organisation with the same billing owner
 * shares one window and counts towards the same ceilings (umbrella.ts).
 * The self-hosted kit is never capped: every function here is a no-op unless
 * isHostedDeployment() is true.
 *
 * An organisation on the paid EU cloud plan (Organization.plan = EU_CLOUD,
 * set by scripts/set-org-plan.ts) is not on the pilot: none of the caps, the
 * editing window or the free-DPIA rule applies to it. The pilot clock is
 * still recorded, so an organisation returned to PILOT finds its window where
 * it was.
 */

/**
 * An organisation as the ceilings take it: its id (the plan is then read from
 * the database), or the organisation row the caller already holds (its plan
 * is used as it is; a row without one counts as the pilot).
 */
export type OrgRef = string | ({ id: string; billingOwnerId?: string | null } & PlanOrg);

async function onPaidPlan(db: PlanLookupDb, org: OrgRef): Promise<boolean> {
  return typeof org === "string" ? organizationOnPaidPlan(db, org) : isPaidPlan(org);
}

/** The plan that lifts the pilot's caps (Prisma enum OrganizationPlan). */
export const PAID_PLAN = "EU_CLOUD" as const;

/** The plan field as the caps read it; absent or null counts as the pilot. */
export type PlanOrg = { plan?: string | null };

/** True for an organisation on the paid EU cloud plan. */
export function isPaidPlan(org: PlanOrg | null | undefined): boolean {
  return org?.plan === PAID_PLAN;
}

type PlanLookupDb = {
  organization?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique: (args: any) => Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany?: (args: any) => Promise<any>;
  };
};

/**
 * Reads the organisation's plan from the database. An organisation that is
 * not found, or a database handle without the organisations model (a test
 * double), counts as the pilot: the caps then apply, never the reverse.
 */
export async function organizationOnPaidPlan(
  db: PlanLookupDb,
  organizationId: string
): Promise<boolean> {
  if (!db.organization?.findUnique) return false;
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return isPaidPlan(org);
}

/**
 * The date the hosted pilot went live. The editing window never starts before
 * it, and a sign-in before it does not start the clock.
 */
export const PILOT_CLOCK_START = new Date("2026-10-01T00:00:00Z");

/**
 * The field the pilot clock reads. `pilotStartedAt` is the organisation's
 * first sign-in after the pilot went live; null until that sign-in happens.
 */
export type PilotClockOrg = { pilotStartedAt: Date | null } & PlanOrg;

/** The organisation ids a count covers: one id, or the ids of a group. */
type Scope = string | { in: string[] };

const scopeOf = (ids: string[]): Scope => (ids.length === 1 ? ids[0] : { in: ids });

type CountDelegate = { count: (args: { where: object }) => Promise<number> };
type MemberDelegate = CountDelegate & {
  findMany?: (args: {
    where: object;
    distinct: ["userId"];
    select: { userId: true };
  }) => Promise<{ userId: string }[]>;
};

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
  organizationMember: MemberDelegate;
} & PlanLookupDb;

const COUNTERS: Record<PilotResource, (db: PilotDb, organizationId: Scope) => Promise<number>> = {
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
  // Across a group, a person who belongs to several of its organisations
  // (the consultant who runs them all) counts once.
  members: async (db, organizationId) => {
    if (typeof organizationId !== "string" && typeof db.organizationMember.findMany === "function") {
      const people = await db.organizationMember.findMany({
        where: { organizationId },
        distinct: ["userId"],
        select: { userId: true },
      });
      return people.length;
    }
    return db.organizationMember.count({ where: { organizationId } });
  },
};

/** The count of `resource` over the whole group of `organization`. */
async function groupCount(db: PilotDb, organization: OrgRef, resource: PilotResource): Promise<number> {
  const ids = await groupOrganizationIds(db, organization);
  return COUNTERS[resource](db, scopeOf(ids));
}

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
  // The safeguards question (welcome card and Settings) changes no programme
  // record; a firm whose editing window has ended may still answer it or ask
  // to talk about a managed server or its own hardware.
  "safeguards.setChoice",
  "safeguards.submitRequest",
  // Accepting the data processing agreement changes no programme record; an
  // organisation whose editing window has ended may still accept it.
  "organization.acceptDpa",
]);

type Locale = "en" | "es";

export function pilotLocale(value: string | undefined): Locale {
  return value?.toLowerCase().startsWith("es") ? "es" : "en";
}

function exportUrl(): string {
  return `${brand.appUrl.replace(/\/$/, "")}${PILOT_EXPORT_PATH}`;
}

export function pilotMessage(
  kind: "readOnly" | "ceiling" | "organizationLimit" | "organizationLimitInvitee",
  locale: Locale,
  resource?: PilotResource
): string {
  const plans = plansUrl(locale);
  const managed = managedUrl(locale);
  const exp = exportUrl();
  if (kind === "readOnly") {
    return locale === "es"
      ? `Esta organización piloto es de solo lectura: el periodo de edición del piloto ha terminado. Puedes seguir exportando todo lo que has creado (${exp}) o pasar al plan de pago (${plans}).`
      : `This pilot organization is read-only: the pilot's editing window has ended. You can still export everything you created (${exp}) or move to the paid plan (${plans}).`;
  }
  if (kind === "organizationLimit") {
    const n = ORGANIZATIONS_PER_ACCOUNT;
    return locale === "es"
      ? `Una cuenta del servicio alojado puede gestionar hasta ${n} organizaciones, y la tuya ya tiene ${n}. Para gestionar más, pide una instancia gestionada (${managed}). Puedes exportar lo que ya tienes (${exp}).`
      : `An account on the hosted service can manage up to ${n} organizations, and yours already has ${n}. To manage more, ask for a managed instance (${managed}). You can export what you already have (${exp}).`;
  }
  if (kind === "organizationLimitInvitee") {
    const n = ORGANIZATIONS_PER_ACCOUNT;
    return locale === "es"
      ? `La persona a la que invitas ya pertenece a ${n} organizaciones, el máximo para una cuenta del servicio alojado. Para gestionar más, pide una instancia gestionada (${managed}).`
      : `The person you are inviting already belongs to ${n} organizations, the most an account can have on the hosted service. To manage more, ask for a managed instance (${managed}).`;
  }
  const r = resource ?? "dataAssets";
  const limit = PILOT_LIMITS[r];
  const label = RESOURCE_LABELS[r][locale];
  return locale === "es"
    ? `Has alcanzado el límite del piloto: ${limit} ${label}, contados entre todas las organizaciones de la misma cuenta. Para seguir, pasa al plan de pago (${plans}) o exporta tus registros (${exp}).`
    : `You have reached the pilot limit of ${limit} ${label}, counted across all the organizations of the same account. To continue, move to the paid plan (${plans}) or export your records (${exp}).`;
}

// ── Impact assessments on the pilot tier ─────────────────────────────────

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
} & PlanLookupDb;

/**
 * The DPIAs created by the whole group of `organization` (the two free DPIAs
 * are the paying customer's, not each organisation's).
 */
export async function countDpiaCreated(
  db: DpiaCountDb,
  organization: string
): Promise<number> {
  const organizationId = scopeOf(await groupOrganizationIds(db, organization));
  const [logged, held] = await Promise.all([
    db.auditLog.count({
      where: {
        organizationId,
        entityType: "Assessment",
        // AUTO_CREATE: a draft made from a processing activity or a vendor
        // import (services/assessment-auto-create.ts).
        action: { in: ["CREATE", "AUTO_CREATE"] },
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

/**
 * What the screens show (the type card, the quick action, the form).
 * Uncapped off the pilot tier: the self-hosted kit, or a licensed organisation.
 */
export async function pilotDpiaQuota(
  db: DpiaCountDb,
  organizationId: string,
  pilotTier: boolean
): Promise<DpiaQuota> {
  if (!pilotTier) return { capped: false };
  const used = await countDpiaCreated(db, organizationId);
  return {
    capped: true,
    limit: PILOT_DPIA_LIMIT,
    used,
    remaining: Math.max(0, PILOT_DPIA_LIMIT - used),
  };
}

/** The one link in the limit message, in the reader's language. */
export const SEE_PLANS_LABEL: Record<Locale, string> = {
  en: "See the plans",
  es: "Consulta los planes",
};

/**
 * What a firm is told when the two free DPIAs are used up: that the pilot
 * tier includes two for a limited time, that deleting does not free a place,
 * and one link, to the plans page. No price, and nothing already created is
 * touched: editing, submitting, approving and exporting stay open.
 */
export function dpiaCapMessage(locale: Locale): string {
  const plans = `${SEE_PLANS_LABEL[locale]}: ${PLANS_URL[locale]}`;
  return locale === "es"
    ? `Ya se han creado las ${PILOT_DPIA_LIMIT} EIPD gratuitas por tiempo limitado que incluye el nivel piloto, contadas entre todas las organizaciones de la misma cuenta, así que no se puede crear otra. Se cuentan las EIPD creadas, así que borrar una EIPD en borrador no libera plaza. Las que ya existen se pueden seguir editando, presentando, aprobando y exportando. Para crear más, hace falta un plan. ${plans}`
    : `The ${PILOT_DPIA_LIMIT} DPIAs that the pilot tier includes free for a limited time have already been created, counted across all the organizations of the same account, so another cannot be created. The count is of the DPIAs created, so deleting a draft DPIA does not free a place. The ones already there can still be edited, submitted, approved and exported. Creating more needs a plan. ${plans}`;
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
 * Throws FORBIDDEN on the pilot tier once the two free DPIAs are used up,
 * after recording that the organisation reached the limit. The count is read
 * on the server at each creation; the screens only repeat it.
 */
export async function assertPilotDpiaQuota(
  db: DpiaCountDb & PilotLimitAuditDb,
  organizationId: string,
  pilotTier: boolean,
  locale: Locale = "en"
): Promise<void> {
  if (!pilotTier) return;
  const used = await countDpiaCreated(db, organizationId);
  if (used >= PILOT_DPIA_LIMIT) {
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
  if (!start) return null;
  const startMs = start.getTime();
  const shortenedAt = PILOT_WINDOW_SHORTENED_AT.getTime();
  if (startMs >= shortenedAt) return new Date(startMs + PILOT_DAYS * DAY_MS);
  // Already in its pilot when the window was shortened: the earlier of its
  // original ninety-day end and PILOT_DAYS from the change.
  return new Date(
    Math.min(startMs + PILOT_DAYS_BEFORE_SHORTENING * DAY_MS, shortenedAt + PILOT_DAYS * DAY_MS)
  );
}

/** A pilot begun before the window was shortened to PILOT_DAYS (it keeps the transition rule). */
export function isTransitionPilot(org: PilotClockOrg): boolean {
  const start = pilotStart(org);
  return start !== null && start.getTime() < PILOT_WINDOW_SHORTENED_AT.getTime();
}

/** Whole days of editing left (0 once read-only; the full window before it starts). */
export function pilotDaysLeft(org: PilotClockOrg, now: Date = new Date()): number {
  const end = pilotEndsAt(org);
  if (!end) return PILOT_DAYS;
  const ms = end.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY_MS);
}

export function isPilotReadOnly(org: PilotClockOrg, now: Date = new Date()): boolean {
  if (isPaidPlan(org)) return false;
  const end = pilotEndsAt(org);
  return end !== null && now.getTime() >= end.getTime();
}

/**
 * Records the first sign-in after the pilot went live, which starts the
 * editing window of the organisation's whole group (one window per paying
 * customer, umbrella.ts). Called when a signed-in member reaches the
 * organisation (src/server/trpc.ts). A no-op on the kit, before
 * PILOT_CLOCK_START, and once a start is recorded. When another organisation
 * of the group has already started, its start is taken, so a later
 * organisation never restarts or extends the window. Sets
 * `org.pilotStartedAt` in place so the rest of the request sees it. The
 * update only matches null columns, so a concurrent request cannot move a
 * recorded start.
 */
export async function recordPilotFirstSignIn(
  db: {
    organization: {
      updateMany: (args: { where: object; data: object }) => Promise<unknown>;
      findFirst?: (args: {
        where: object;
        orderBy: { pilotStartedAt: "asc" };
        select: { pilotStartedAt: true };
      }) => Promise<{ pilotStartedAt: Date | null } | null>;
    };
  },
  org: { id: string; billingOwnerId?: string | null } & PilotClockOrg,
  now: Date = new Date()
): Promise<void> {
  if (!isHostedDeployment()) return;
  if (org.pilotStartedAt) return;
  if (now.getTime() < PILOT_CLOCK_START.getTime()) return;
  const group = groupWhere(org);
  let start = now;
  if (org.billingOwnerId && typeof db.organization.findFirst === "function") {
    const earlier = await db.organization.findFirst({
      where: { ...group, pilotStartedAt: { not: null } },
      orderBy: { pilotStartedAt: "asc" },
      select: { pilotStartedAt: true },
    });
    if (earlier?.pilotStartedAt) start = new Date(earlier.pilotStartedAt);
  }
  await db.organization.updateMany({
    where: { ...group, pilotStartedAt: null },
    data: { pilotStartedAt: start },
  });
  org.pilotStartedAt = start;
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
  organization: OrgRef,
  resource: PilotResource,
  adding = 1,
  locale: Locale = "en"
): Promise<void> {
  if (!isHostedDeployment()) return;
  if (await onPaidPlan(db, organization)) return;
  const used = await groupCount(db, organization, resource);
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
  organization: OrgRef,
  resource: PilotResource
): Promise<boolean> {
  if (!isHostedDeployment()) return true;
  if (await onPaidPlan(db, organization)) return true;
  const used = await groupCount(db, organization, resource);
  return used < PILOT_LIMITS[resource];
}

/**
 * Hosted service: how many organisations the account belongs to, and whether
 * it may open or join one more. Always open on the kit (`limited: false`).
 */
export async function organizationCapacity(
  db: { organizationMember: CountDelegate },
  userId: string
): Promise<{ limited: false } | { limited: true; limit: number; used: number; canAdd: boolean }> {
  if (!isHostedDeployment()) return { limited: false };
  const used = await db.organizationMember.count({ where: { userId } });
  return { limited: true, limit: ORGANIZATIONS_PER_ACCOUNT, used, canAdd: used < ORGANIZATIONS_PER_ACCOUNT };
}

/**
 * Hosted service: an account may belong to up to ORGANIZATIONS_PER_ACCOUNT
 * organisations. Throws when the user already has that many memberships.
 * `joining` is the organisation the account is being added to, when there is
 * one: an organisation on the paid plan may add a person whatever they belong
 * to, and the message then speaks of the invitee. Creating a new organisation
 * passes none, so the rule still applies there (a new organisation starts on
 * the pilot).
 */
export async function assertOrganizationsPerAccount(
  db: { organizationMember: CountDelegate },
  userId: string,
  locale: Locale = "en",
  joining?: PlanOrg
): Promise<void> {
  if (!isHostedDeployment()) return;
  if (isPaidPlan(joining)) return;
  const capacity = await organizationCapacity(db, userId);
  if (capacity.limited && !capacity.canAdd) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: pilotMessage(joining ? "organizationLimitInvitee" : "organizationLimit", locale),
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
      /** On the paid EU cloud plan: no caps, no editing window. */
      paid: true;
      plan: typeof PAID_PLAN;
      renewsAt: Date | null;
    }
  | {
      hosted: true;
      paid: false;
      days: number;
      daysLeft: number;
      /** False until the first sign-in after the pilot went live is recorded. */
      started: boolean;
      endsAt: Date | null;
      readOnly: boolean;
      /** Begun before the window was shortened (11 Oct 2026): the bar says "Free until {date}". */
      transition: boolean;
      /** Organisations sharing this window and these limits (the group; 1 when alone). */
      organizations: number;
      /** Counted over the whole group. */
      usage: { resource: PilotResource; used: number; limit: number }[];
    };

export async function getPilotStatus(
  db: PilotDb,
  org: { id: string; planRenewsAt?: Date | null; billingOwnerId?: string | null } & PilotClockOrg,
  now: Date = new Date()
): Promise<PilotStatus> {
  if (!isHostedDeployment()) return { hosted: false };
  if (isPaidPlan(org)) {
    return { hosted: true, paid: true, plan: PAID_PLAN, renewsAt: org.planRenewsAt ?? null };
  }
  const ids = await groupOrganizationIds(db, org);
  const usage = await Promise.all(
    // Rights requests are not listed when the module is not part of this plan.
    STATUS_RESOURCES.filter((r) => r !== "dsarRequests" || isDsarModuleEnabled()).map(async (resource) => ({
      resource,
      used: await COUNTERS[resource](db, scopeOf(ids)),
      limit: PILOT_LIMITS[resource],
    }))
  );
  return {
    hosted: true,
    paid: false,
    days: PILOT_DAYS,
    started: pilotStart(org) !== null,
    daysLeft: pilotDaysLeft(org, now),
    endsAt: pilotEndsAt(org),
    readOnly: isPilotReadOnly(org, now),
    transition: isTransitionPilot(org),
    organizations: ids.length,
    usage,
  };
}
