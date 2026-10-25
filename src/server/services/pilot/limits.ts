// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The hosted pilot's limits as plain values: the editing window, the records
 * ceiling, the free DPIAs and their labels. A leaf module (no tRPC, no
 * Prisma), so the public landing's pricing section can state the same limits
 * the service enforces; caps.ts enforces them and re-exports these names.
 */

type Locale = "en" | "es";

/**
 * The editing window, in days (it was ninety); organisations already in their
 * pilot at the change keep the transition rule in pilotEndsAt.
 */
export const PILOT_DAYS = 15;

/** The editing window before 11 Oct 2026, kept only for the transition rule. */
export const PILOT_DAYS_BEFORE_SHORTENING = 90;

/**
 * When the shorter window took effect: the end of its release day (11 Oct
 * 2026, UTC), so that an organisation already in its pilot has at least
 * PILOT_DAYS full days from the release. An organisation whose window started
 * before this instant keeps whichever ends EARLIER of its original ninety-day
 * end and PILOT_DAYS from this instant: nobody becomes read-only at the
 * release. Computed, not stored: no data migration.
 */
export const PILOT_WINDOW_SHORTENED_AT = new Date("2026-10-12T00:00:00Z");

export type PilotResource =
  | "dataAssets"
  | "dataElements"
  | "processingActivities"
  | "dataFlows"
  | "dataTransfers"
  | "vendors"
  | "vendorContracts"
  | "assessments"
  | "assessmentTemplates"
  | "incidents"
  | "aiSystems"
  | "members";

/**
 * Records ceiling on the hosted pilot, per paying customer (all their
 * organisations together). Rights requests are not in it: their only limit
 * is the module's monthly ceiling on the public form (src/server/services/dsar/module.ts).
 */
export const PILOT_LIMITS: Record<PilotResource, number> = {
  dataAssets: 25,
  dataElements: 250,
  processingActivities: 50,
  dataFlows: 100,
  dataTransfers: 50,
  vendors: 50,
  vendorContracts: 50,
  assessments: 25,
  assessmentTemplates: 10,
  incidents: 25,
  aiSystems: 25,
  members: 5,
};

/** Lower-case names of the capped resources, for use inside a sentence or list. */
export const RESOURCE_LABELS: Record<PilotResource, Record<Locale, string>> = {
  dataAssets: { en: "systems", es: "sistemas" },
  dataElements: { en: "data elements", es: "elementos de datos" },
  processingActivities: { en: "processing activities", es: "actividades de tratamiento" },
  dataFlows: { en: "data flows", es: "flujos de datos" },
  dataTransfers: { en: "transfers", es: "transferencias" },
  vendors: { en: "vendors", es: "proveedores" },
  vendorContracts: { en: "vendor contracts", es: "contratos con proveedores" },
  assessments: { en: "assessments", es: "evaluaciones" },
  assessmentTemplates: { en: "assessment templates", es: "plantillas de evaluación" },
  incidents: { en: "incidents", es: "incidencias" },
  aiSystems: { en: "AI systems", es: "sistemas de IA" },
  members: { en: "members", es: "miembros" },
};

/**
 * Impact assessments (type DPIA) an organisation on the pilot tier may create:
 * free for a limited time, two per paying customer, shared by all the
 * organisations of the same billing owner (which replaced the earlier three per organisation). The pilot tier is the
 * hosted service, and, on a build that sells licences, any organisation with
 * no DPIA licence (isDpiaPilotTier in services/licensing/entitlement.ts). The
 * overall records ceiling (PILOT_LIMITS.assessments) still applies on the
 * hosted service; this narrower rule bites first.
 */
export const PILOT_DPIA_LIMIT = 2;

/**
 * Organisations one account may belong to on the hosted service (it was one).
 * Five, so that a consultant acting as external DPO can keep each client
 * apart. One customer pays once: the organisations an account creates share
 * one plan, one editing window, the records ceilings above and the free DPIAs
 * (services/pilot/umbrella.ts).
 */
export const ORGANIZATIONS_PER_ACCOUNT = 5;
