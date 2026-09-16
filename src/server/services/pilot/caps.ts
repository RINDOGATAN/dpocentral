// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { TRPCError } from "@trpc/server";
import { brand } from "@/config/brand";
import {
  isHostedDeployment,
  PILOT_EXPORT_PATH,
  RUN_YOUR_OWN_URL,
} from "@/lib/hosted";

/**
 * Hosted pilot caps.
 *
 * The hosted service is a free pilot. Every module is open to every
 * organisation, and these caps apply:
 *   - one organisation per account;
 *   - edits for PILOT_DAYS from the organisation's start, then read-only
 *     (exports stay available: they are GET routes under /api/export);
 *   - a ceiling on the records an organisation can hold (PILOT_LIMITS).
 * The self-hosted kit is never capped: every function here is a no-op unless
 * isHostedDeployment() is true.
 */

export const PILOT_DAYS = 90;

/**
 * The pilot clock starts at the later of the organisation's creation and this
 * date, so organisations that existed before the caps shipped are not made
 * read-only on the day of the release.
 */
export const PILOT_CLOCK_START = new Date("2026-10-01T00:00:00Z");

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

const RESOURCE_LABELS: Record<PilotResource, Record<Locale, string>> = {
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

export function pilotStart(org: { createdAt: Date }): Date {
  const created = new Date(org.createdAt);
  return created > PILOT_CLOCK_START ? created : PILOT_CLOCK_START;
}

export function pilotEndsAt(org: { createdAt: Date }): Date {
  return new Date(pilotStart(org).getTime() + PILOT_DAYS * 24 * 60 * 60 * 1000);
}

/** Whole days of editing left (0 once read-only). */
export function pilotDaysLeft(org: { createdAt: Date }, now: Date = new Date()): number {
  const ms = pilotEndsAt(org).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isPilotReadOnly(org: { createdAt: Date }, now: Date = new Date()): boolean {
  return now.getTime() >= pilotEndsAt(org).getTime();
}

/** Throws FORBIDDEN on the hosted pilot once the organisation is read-only. */
export function assertPilotWritable(
  org: { createdAt: Date },
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
      endsAt: Date;
      readOnly: boolean;
      usage: { resource: PilotResource; used: number; limit: number }[];
    };

export async function getPilotStatus(
  db: PilotDb,
  org: { id: string; createdAt: Date },
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
    daysLeft: pilotDaysLeft(org, now),
    endsAt: pilotEndsAt(org),
    readOnly: isPilotReadOnly(org, now),
    usage,
  };
}
