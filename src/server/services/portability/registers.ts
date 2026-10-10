// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The CSV views of the programme: one file per register, for people (a
 * spreadsheet) rather than machines (programme.json is the machine format).
 * Headers are in the reader's language (English or Spanish), values are
 * words in that language where the field is a fixed list, and every file
 * carries the record ids so a row can be traced back to programme.json.
 *
 * The same column definitions drive the CSV import (./csv-import.ts): a
 * column's English and Spanish headers, its key and its synonyms are what an
 * uploaded file's headers are matched against, and its kind says how a cell
 * is read back.
 *
 * Pure: no database.
 */

import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import { ENUMS } from "./format";
import type { RegisterKey } from "./format";

export type Locale = "en" | "es";
export type EnumName = keyof typeof ENUMS;

export type ColumnKind = "text" | "number" | "bool" | "date" | "list" | "enum" | "enumList" | "json";

export interface CsvColumn {
  /** The field in the format (./format.ts), or a derived name for views. */
  key: string;
  en: string;
  es: string;
  kind: ColumnKind;
  enumName?: EnumName;
  /** How the value is read from a record (default: record[key]). */
  get?: (r: Rec) => unknown;
  /** Other headers that mean this column (lower case, no accents), for the import. */
  synonyms?: string[];
}

export interface CsvTable {
  file: string;
  register: RegisterKey;
  en: string;
  es: string;
  /** Rows a record gives (default: the record itself). Child tables flatten here. */
  rows?: (r: Rec) => Rec[];
  columns: CsvColumn[];
}

type Rec = Record<string, unknown>;

// ── Enumerated values as words ──────────────────────────────────────────────

const BUNDLE_KIND: Partial<Record<EnumName, string>> = {
  DataAssetType: "dataAssetType",
  DataSensitivity: "dataSensitivity",
  DataCategory: "dataCategory",
  LegalBasis: "legalBasis",
  TransferMechanism: "transferMechanism",
  VendorStatus: "vendorStatus",
  VendorRiskTier: "riskLevel",
  ContractType: "contractType",
  ContractStatus: "contractStatus",
  ReviewType: "reviewType",
  RiskLevel: "riskLevel",
  AssessmentType: "assessmentType",
  AssessmentStatus: "assessmentStatus",
  ApprovalStatus: "approvalStatus",
  IncidentSeverity: "incidentSeverity",
  IncidentStatus: "incidentStatus",
  IncidentType: "incidentType",
  NotificationStatus: "notificationStatus",
  DSARType: "dsarType",
  DSARStatus: "dsarStatus",
  DSARTaskStatus: "dsarTaskStatus",
  OrganizationRole: "role",
};

/** Lists the screens do not name yet. */
const EXTRA: Partial<Record<EnumName, Record<Locale, Record<string, string>>>> = {
  AIRiskLevel: {
    en: { UNACCEPTABLE: "Unacceptable", HIGH_RISK: "High risk", LIMITED: "Limited", MINIMAL: "Minimal" },
    es: { UNACCEPTABLE: "Inaceptable", HIGH_RISK: "Alto riesgo", LIMITED: "Limitado", MINIMAL: "Mínimo" },
  },
  AISystemStatus: {
    en: { DRAFT: "Draft", REGISTERED: "Registered", UNDER_REVIEW: "Under review", COMPLIANT: "Compliant", NON_COMPLIANT: "Non-compliant", DECOMMISSIONED: "Decommissioned" },
    es: { DRAFT: "Borrador", REGISTERED: "Registrado", UNDER_REVIEW: "En revisión", COMPLIANT: "Conforme", NON_COMPLIANT: "No conforme", DECOMMISSIONED: "Retirado" },
  },
  MitigationStatus: {
    en: { IDENTIFIED: "Identified", PLANNED: "Planned", IN_PROGRESS: "In progress", IMPLEMENTED: "Implemented", VERIFIED: "Verified", NOT_REQUIRED: "Not required" },
    es: { IDENTIFIED: "Identificada", PLANNED: "Planificada", IN_PROGRESS: "En curso", IMPLEMENTED: "Aplicada", VERIFIED: "Verificada", NOT_REQUIRED: "No necesaria" },
  },
};

/** A code as words, the last resort (as the screens do: src/lib/enum-labels.ts). */
function desnake(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const BUNDLES = { en: enMessages, es: esMessages } as unknown as Record<
  Locale,
  { enums: Record<string, Record<string, string>> }
>;

/** The word for an enumerated value in the reader's language. */
export function enumLabel(name: EnumName, value: string, locale: Locale): string {
  const extra = EXTRA[name]?.[locale]?.[value];
  if (extra) return extra;
  const kind = BUNDLE_KIND[name];
  const word = kind ? BUNDLES[locale].enums[kind]?.[value] : undefined;
  return word ?? desnake(value);
}

/** Every word (either language) and code that reads as each value of a list. */
export function enumWords(name: EnumName): Map<string, string> {
  const out = new Map<string, string>();
  for (const value of ENUMS[name] as readonly string[]) {
    out.set(normalizeHeader(value), value);
    for (const locale of ["en", "es"] as const) {
      const word = normalizeHeader(enumLabel(name, value, locale));
      out.set(word, value);
      // "Datos financieros" is also written "Financieros"; "Health data", "Health".
      const short = word.replace(/^datos (de )?/, "").replace(/ data$/, "");
      if (short && !out.has(short)) out.set(short, value);
    }
  }
  return out;
}

/** Lower case, no accents, single spaces, no punctuation: how headers and words are compared. */
export function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./()]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Cells ───────────────────────────────────────────────────────────────────

const YES = { en: "Yes", es: "Sí" };
const NO = { en: "No", es: "No" };

/** A value as the text of one cell. */
export function cellText(col: CsvColumn, value: unknown, locale: Locale): string {
  if (value === null || value === undefined) return "";
  switch (col.kind) {
    case "bool":
      return value ? YES[locale] : NO[locale];
    case "enum":
      return col.enumName ? enumLabel(col.enumName, String(value), locale) : String(value);
    case "enumList":
      return Array.isArray(value)
        ? value.map((v) => (col.enumName ? enumLabel(col.enumName, String(v), locale) : String(v))).join("; ")
        : "";
    case "list":
      return Array.isArray(value) ? value.map(String).join("; ") : String(value);
    case "json":
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

// ── The tables ──────────────────────────────────────────────────────────────

const c = (
  key: string,
  en: string,
  es: string,
  kind: ColumnKind = "text",
  extra: Partial<CsvColumn> = {},
): CsvColumn => ({ key, en, es, kind, ...extra });

const idCol = c("id", "Id", "Id");
const created = c("createdAt", "Created", "Creado", "date");
const updated = c("updatedAt", "Last changed", "Última modificación", "date");
const state = c("confirmationState", "Draft or confirmed", "Borrador o confirmado", "text", {
  get: (r) => (r.confirmation as Rec | undefined)?.state ?? null,
});

export const CSV_TABLES: CsvTable[] = [
  {
    file: "jurisdictions.csv",
    register: "jurisdictions",
    en: "Laws and regulations",
    es: "Leyes y normas",
    columns: [
      c("jurisdictionCode", "Code", "Código"),
      c("name", "Name", "Nombre"),
      c("region", "Region", "Región"),
      c("isPrimary", "Main law", "Norma principal", "bool"),
    ],
  },
  {
    file: "departments.csv",
    register: "businessUnits",
    en: "Departments",
    es: "Departamentos",
    columns: [idCol, c("name", "Name", "Nombre"), c("parentId", "Parent department id", "Id del departamento superior"), created],
  },
  {
    file: "systems.csv",
    register: "dataAssets",
    en: "Systems (data inventory)",
    es: "Sistemas (inventario de datos)",
    columns: [
      idCol,
      c("name", "Name", "Nombre", "text", { synonyms: ["system", "sistema", "asset", "activo", "application", "aplicacion", "system name", "nombre del sistema"] }),
      c("description", "Description", "Descripción"),
      c("type", "Type", "Tipo", "enum", { enumName: "DataAssetType", synonyms: ["asset type", "tipo de activo", "system type", "tipo de sistema"] }),
      c("owner", "Owner", "Responsable", "text", { synonyms: ["business owner", "propietario", "department", "departamento"] }),
      c("location", "Location", "Ubicación", "text", { synonyms: ["hosting location", "country", "pais", "region"] }),
      c("hostingType", "Hosting", "Alojamiento", "text", { synonyms: ["hosting type", "tipo de alojamiento"] }),
      c("vendor", "Provider", "Proveedor", "text", { synonyms: ["vendor", "supplier", "suministrador"] }),
      c("isProduction", "In production", "En producción", "bool", { synonyms: ["production", "produccion"] }),
      c("businessUnitId", "Department id", "Id del departamento"),
      state,
      created,
      updated,
    ],
  },
  {
    file: "data-elements.csv",
    register: "dataElements",
    en: "Data elements",
    es: "Elementos de datos",
    columns: [
      idCol,
      c("dataAssetId", "System id", "Id del sistema"),
      c("name", "Name", "Nombre"),
      c("description", "Description", "Descripción"),
      c("category", "Category", "Categoría", "enum", { enumName: "DataCategory" }),
      c("sensitivity", "Sensitivity", "Sensibilidad", "enum", { enumName: "DataSensitivity" }),
      c("isPersonalData", "Personal data", "Dato personal", "bool"),
      c("isSpecialCategory", "Special category", "Categoría especial", "bool"),
      c("retentionDays", "Kept for (days)", "Se conserva (días)", "number"),
      c("legalBasis", "Legal basis", "Base jurídica"),
      created,
    ],
  },
  {
    file: "processing-activities.csv",
    register: "processingActivities",
    en: "Record of processing activities",
    es: "Registro de actividades de tratamiento",
    columns: [
      idCol,
      c("name", "Name", "Nombre", "text", { synonyms: ["activity", "actividad", "processing activity", "actividad de tratamiento", "tratamiento", "activity name", "nombre de la actividad", "processing operation"] }),
      c("description", "Description", "Descripción"),
      c("purpose", "Purpose", "Finalidad", "text", { synonyms: ["purposes", "finalidades", "purpose of processing", "finalidad del tratamiento", "fines"] }),
      c("legalBasis", "Legal basis", "Base jurídica", "enum", { enumName: "LegalBasis", synonyms: ["lawful basis", "base legal", "base de legitimacion", "legitimacion", "legal ground"] }),
      c("legalBasisDetail", "Legal basis detail", "Detalle de la base jurídica"),
      c("dataSubjects", "Data subjects", "Interesados", "list", { synonyms: ["categories of data subjects", "categorias de interesados", "data subject categories", "afectados"] }),
      c("categories", "Data categories", "Categorías de datos", "enumList", { enumName: "DataCategory", synonyms: ["categories of personal data", "categorias de datos personales", "personal data categories"] }),
      c("recipients", "Recipients", "Destinatarios", "list", { synonyms: ["categories of recipients", "categorias de destinatarios"] }),
      c("retentionPeriod", "Keeping period", "Plazo de conservación", "text", { synonyms: ["retention", "retention period", "plazo de supresion", "conservacion", "plazo"] }),
      c("retentionDays", "Kept for (days)", "Se conserva (días)", "number", { synonyms: ["retention days", "dias de conservacion"] }),
      c("automatedDecisionMaking", "Automated decisions", "Decisiones automatizadas", "bool", { synonyms: ["automated decision making", "profiling", "elaboracion de perfiles"] }),
      c("isActive", "In use", "En uso", "bool", { synonyms: ["active", "activa"] }),
      c("businessUnitId", "Department id", "Id del departamento"),
      c("systems", "System ids", "Ids de los sistemas", "list", {
        get: (r) => ((r.assets as Rec[] | undefined) ?? []).map((a) => a.dataAssetId),
      }),
      state,
      created,
      updated,
    ],
  },
  {
    file: "data-flows.csv",
    register: "dataFlows",
    en: "Data flows",
    es: "Flujos de datos",
    columns: [
      idCol,
      c("name", "Name", "Nombre"),
      c("sourceAssetId", "From system id", "Id del sistema de origen"),
      c("destinationAssetId", "To system id", "Id del sistema de destino"),
      c("dataCategories", "Data categories", "Categorías de datos", "enumList", { enumName: "DataCategory" }),
      c("frequency", "Frequency", "Frecuencia"),
      c("encryptionMethod", "Protection in transit", "Protección en tránsito"),
      created,
    ],
  },
  {
    file: "transfers.csv",
    register: "dataTransfers",
    en: "International transfers",
    es: "Transferencias internacionales",
    columns: [
      idCol,
      c("name", "Name", "Nombre"),
      c("processingActivityId", "Activity id", "Id de la actividad"),
      c("destinationCountry", "Destination country", "País de destino"),
      c("destinationOrg", "Receiving organisation", "Organización receptora"),
      c("mechanism", "Mechanism", "Mecanismo", "enum", { enumName: "TransferMechanism" }),
      c("tiaCompleted", "Transfer impact assessment done", "Evaluación de impacto de la transferencia hecha", "bool"),
      c("sccExpiryDate", "Clauses expire", "Vencimiento de las cláusulas", "date"),
      c("isActive", "In use", "En uso", "bool"),
      created,
    ],
  },
  {
    file: "vendors.csv",
    register: "vendors",
    en: "Vendors",
    es: "Proveedores",
    columns: [
      idCol,
      c("name", "Name", "Nombre", "text", { synonyms: ["vendor", "vendor name", "supplier", "processor", "encargado", "nombre del proveedor", "proveedor", "third party", "tercero", "company", "empresa"] }),
      c("description", "Description", "Descripción", "text", { synonyms: ["service", "servicio", "services provided", "servicios"] }),
      c("website", "Website", "Sitio web", "text", { synonyms: ["url", "web", "pagina web"] }),
      c("status", "Status", "Estado", "enum", { enumName: "VendorStatus" }),
      c("riskTier", "Risk tier", "Nivel de riesgo", "enum", { enumName: "VendorRiskTier", synonyms: ["risk", "riesgo", "risk level", "criticality", "criticidad"] }),
      c("primaryContact", "Contact person", "Persona de contacto", "text", { synonyms: ["contact", "contacto", "contact name"] }),
      c("contactEmail", "Contact e-mail", "Correo de contacto", "text", { synonyms: ["email", "e mail", "correo", "correo electronico"] }),
      c("contactPhone", "Contact phone", "Teléfono de contacto", "text", { synonyms: ["phone", "telefono"] }),
      c("categories", "Service categories", "Categorías de servicio", "list", { synonyms: ["category", "categoria", "categories"] }),
      c("dataProcessed", "Data categories", "Categorías de datos", "enumList", { enumName: "DataCategory", synonyms: ["data processed", "datos tratados", "personal data", "datos personales"] }),
      c("countries", "Countries", "Países", "list", { synonyms: ["country", "pais", "locations", "hosting countries", "data location"] }),
      c("certifications", "Certifications", "Certificaciones", "list", { synonyms: ["certification", "certificacion"] }),
      c("contracts", "Contracts", "Contratos", "number", { get: (r) => ((r.contracts as unknown[]) ?? []).length }),
      state,
      created,
      updated,
    ],
  },
  {
    file: "vendor-contracts.csv",
    register: "vendors",
    en: "Vendor contracts",
    es: "Contratos con proveedores",
    rows: (v) => ((v.contracts as Rec[]) ?? []).map((x) => ({ ...x, vendorId: v.id, vendorName: v.name })),
    columns: [
      idCol,
      c("vendorId", "Vendor id", "Id del proveedor"),
      c("vendorName", "Vendor", "Proveedor"),
      c("type", "Type", "Tipo", "enum", { enumName: "ContractType" }),
      c("status", "Status", "Estado", "enum", { enumName: "ContractStatus" }),
      c("name", "Name", "Nombre"),
      c("startDate", "Start", "Inicio", "date"),
      c("endDate", "End", "Fin", "date"),
      c("documentUrl", "Document link", "Enlace al documento"),
    ],
  },
  {
    file: "assessments.csv",
    register: "assessments",
    en: "Assessments",
    es: "Evaluaciones",
    columns: [
      idCol,
      c("name", "Name", "Nombre"),
      c("templateId", "Template id", "Id de la plantilla"),
      c("status", "Status", "Estado", "enum", { enumName: "AssessmentStatus" }),
      c("riskLevel", "Risk", "Riesgo", "enum", { enumName: "RiskLevel" }),
      c("processingActivityId", "Activity id", "Id de la actividad"),
      c("vendorId", "Vendor id", "Id del proveedor"),
      c("dataTransferId", "Transfer id", "Id de la transferencia"),
      c("answers", "Answers", "Respuestas", "number", { get: (r) => ((r.responses as unknown[]) ?? []).length }),
      c("completedAt", "Completed", "Terminada", "date"),
      c("dueDate", "Due", "Fecha prevista", "date"),
      created,
    ],
  },
  {
    file: "assessment-measures.csv",
    register: "assessments",
    en: "Assessment measures",
    es: "Medidas de las evaluaciones",
    rows: (a) => ((a.mitigations as Rec[]) ?? []).map((x) => ({ ...x, assessmentId: a.id, assessmentName: a.name })),
    columns: [
      idCol,
      c("assessmentId", "Assessment id", "Id de la evaluación"),
      c("assessmentName", "Assessment", "Evaluación"),
      c("title", "Measure", "Medida"),
      c("status", "Status", "Estado", "enum", { enumName: "MitigationStatus" }),
      c("priority", "Priority", "Prioridad", "number"),
      c("owner", "Owner", "Responsable"),
      c("dueDate", "Due", "Fecha prevista", "date"),
    ],
  },
  {
    file: "incidents.csv",
    register: "incidents",
    en: "Incidents and breaches",
    es: "Incidencias y brechas",
    columns: [
      idCol,
      c("reference", "Reference", "Referencia"),
      c("title", "Title", "Título"),
      c("type", "Type", "Tipo", "enum", { enumName: "IncidentType" }),
      c("severity", "Severity", "Gravedad", "enum", { enumName: "IncidentSeverity" }),
      c("status", "Status", "Estado", "enum", { enumName: "IncidentStatus" }),
      c("discoveredAt", "Discovered", "Descubierta", "date"),
      c("affectedRecords", "Records affected", "Registros afectados", "number"),
      c("dataCategories", "Data categories", "Categorías de datos", "enumList", { enumName: "DataCategory" }),
      c("notificationRequired", "Notification required", "Requiere notificación", "bool"),
      c("notificationDeadline", "Notify by", "Notificar antes de", "date"),
      c("resolvedAt", "Resolved", "Resuelta", "date"),
    ],
  },
  {
    file: "incident-timeline.csv",
    register: "incidents",
    en: "Incident timelines",
    es: "Cronologías de las incidencias",
    rows: (i) => ((i.timeline as Rec[]) ?? []).map((x) => ({ ...x, incidentId: i.id, incidentTitle: i.title })),
    columns: [
      idCol,
      c("incidentId", "Incident id", "Id de la incidencia"),
      c("incidentTitle", "Incident", "Incidencia"),
      c("timestamp", "When", "Cuándo", "date"),
      c("entryType", "Kind", "Tipo"),
      c("title", "Title", "Título"),
      c("description", "Description", "Descripción"),
    ],
  },
  {
    file: "ai-systems.csv",
    register: "aiSystems",
    en: "AI systems",
    es: "Sistemas de IA",
    columns: [
      idCol,
      c("name", "Name", "Nombre"),
      c("purpose", "Purpose", "Finalidad"),
      c("riskLevel", "Risk level", "Nivel de riesgo", "enum", { enumName: "AIRiskLevel" }),
      c("status", "Status", "Estado", "enum", { enumName: "AISystemStatus" }),
      c("vendorId", "Vendor id", "Id del proveedor"),
      c("provider", "Provider", "Proveedor"),
      c("euAiActRole", "Role under the AI Act", "Papel según el Reglamento de IA"),
      c("nextReviewAt", "Next review", "Próxima revisión", "date"),
    ],
  },
  {
    file: "rights-requests.csv",
    register: "rightsRequests",
    en: "Rights requests (personal data)",
    es: "Solicitudes de derechos (datos personales)",
    columns: [
      idCol,
      c("reference", "Reference", "Referencia"),
      c("type", "Right", "Derecho", "enum", { enumName: "DSARType" }),
      c("status", "Status", "Estado", "enum", { enumName: "DSARStatus" }),
      c("requesterName", "Requester", "Solicitante"),
      c("requesterEmail", "Requester e-mail", "Correo del solicitante"),
      c("receivedAt", "Received", "Recibida", "date"),
      c("dueDate", "Deadline", "Plazo", "date"),
      c("completedAt", "Completed", "Completada", "date"),
    ],
  },
  {
    file: "audit-trail.csv",
    register: "auditTrail",
    en: "Audit trail",
    es: "Registro de auditoría",
    columns: [
      idCol,
      c("at", "When (UTC)", "Cuándo (UTC)", "date"),
      c("action", "Action", "Acción"),
      c("entityType", "Record type", "Tipo de registro"),
      c("entityId", "Record id or reference", "Id o referencia del registro"),
      c("actorPersonId", "Person id", "Id de la persona"),
    ],
  },
];

/** The CSV table whose rows are the records of `register` themselves (not a child table). */
export function mainTable(register: RegisterKey): CsvTable | undefined {
  return CSV_TABLES.find((t) => t.register === register && !t.rows);
}
