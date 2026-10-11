// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The hosted pilot's limits as plain values: the editing window, the records
 * ceiling, the free DPIAs and their labels. A leaf module (no tRPC, no
 * Prisma), so the public landing's pricing section can state the same limits
 * the service enforces; caps.ts enforces them and re-exports these names.
 */

type Locale = "en" | "es";

export const PILOT_DAYS = 90;

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

/** Lower-case names of the capped resources, for use inside a sentence or list. */
export const RESOURCE_LABELS: Record<PilotResource, Record<Locale, string>> = {
  dataAssets: { en: "systems", es: "sistemas" },
  dataElements: { en: "data elements", es: "elementos de datos" },
  processingActivities: { en: "processing activities", es: "actividades de tratamiento" },
  dataFlows: { en: "data flows", es: "flujos de datos" },
  dataTransfers: { en: "transfers", es: "transferencias" },
  vendors: { en: "vendors", es: "proveedores" },
  vendorContracts: { en: "vendor contracts", es: "contratos con proveedores" },
  dsarRequests: { en: "data subject requests", es: "solicitudes de ejercicio de derechos" },
  assessments: { en: "assessments", es: "evaluaciones" },
  assessmentTemplates: { en: "assessment templates", es: "plantillas de evaluación" },
  incidents: { en: "incidents", es: "incidencias" },
  aiSystems: { en: "AI systems", es: "sistemas de IA" },
  members: { en: "members", es: "miembros" },
};

/**
 * Impact assessments (type DPIA) an organisation on the pilot tier may create:
 * free for a limited time, two per organisation (the owner's decision of 29
 * September 2026, which replaced the earlier three). The pilot tier is the
 * hosted service, and, on a build that sells licences, any organisation with
 * no DPIA licence (isDpiaPilotTier in services/licensing/entitlement.ts). The
 * overall records ceiling (PILOT_LIMITS.assessments) still applies on the
 * hosted service; this narrower rule bites first.
 */
export const PILOT_DPIA_LIMIT = 2;
