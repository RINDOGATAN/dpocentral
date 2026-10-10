// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * THE PROGRAMME FORMAT, version 1.0 ("dpocentral-programme/1.0").
 *
 * Customers are never locked in (owner's decision, 9 October 2026; it is also
 * how DPO Central meets the switching and export duties of the EU Data Act,
 * Chapter VI). A whole privacy programme leaves as one open, documented,
 * machine-readable file (programme.json, inside the export ZIP) and comes back
 * in through the same format.
 *
 * This file is the one definition of that format. From it come:
 *   - the validation of every import (zod, below);
 *   - the published JSON Schema, draft 2020-12 (schema/programme.schema.json
 *     in every export, built by ./docs.ts with z.toJSONSchema);
 *   - the field-by-field explanations in README.md (English) and LEEME.md
 *     (Spanish), read from the same descriptions.
 * So the file, the schema and the explanations cannot disagree.
 *
 * Rules of the format:
 *   - Every record has a stable `id`: its identifier in the system that wrote
 *     the file. Ids are opaque strings; never read meaning into them.
 *   - A reference to another record is that record's id, in a field named
 *     after what it points at (`dataAssetId`, `vendorId`...), never a position
 *     in a list. A reference to a person is `...PersonId` (see `people`). A
 *     reference to a law or framework is its `jurisdictionCode`.
 *   - Dates are ISO 8601 strings with a time zone (UTC, "Z").
 *   - Enumerated values are fixed English codes (listed in the schema); the
 *     CSV files carry the same values as words in the reader's language.
 *   - Fields may be added in a 1.x version. A reader ignores fields it does
 *     not know. A change that removes or changes the meaning of a field is a
 *     new major version (2.0).
 *
 * Pure: no database, no request.
 */

import { z } from "zod";

export const PROGRAMME_FORMAT = "dpocentral-programme/1.0" as const;
export const PROGRAMME_FORMAT_MAJOR = "dpocentral-programme/1." as const;

/** Attach the English and Spanish explanation of a field (and a title for records). */
function d<T extends z.ZodType>(schema: T, en: string, es: string): T {
  return schema.meta({ description: en, "x-description-es": es }) as T;
}

/** An optional field: may be missing or null. */
function o<T extends z.ZodType>(schema: T, en: string, es: string) {
  return d(schema.nullish(), en, es);
}

const id = (en: string, es: string) => d(z.string().min(1).max(200), en, es);
const ref = (en: string, es: string) => o(z.string().min(1).max(200), en, es);
const text = (en: string, es: string) => o(z.string().max(100_000), en, es);
const date = (en: string, es: string) => o(z.iso.datetime({ offset: true }), en, es);
const strings = (en: string, es: string) => d(z.array(z.string().max(100_000)).max(100_000).default([]), en, es);
const json = (en: string, es: string) => d(z.unknown().optional(), en, es);
const bool = (en: string, es: string) => o(z.boolean(), en, es);
const int = (en: string, es: string) => o(z.number().int(), en, es);
const num = (en: string, es: string) => o(z.number(), en, es);
const list = <T extends z.ZodType>(item: T, en: string, es: string) =>
  d(z.array(item).max(1_000_000).default([]), en, es);

// ── Enumerations: the stored codes (tests/programme-portability.test.ts keeps
//    them equal to the database's own enums) ────────────────────────────────

export const ENUMS = {
  DataAssetType: ["DATABASE", "APPLICATION", "FILE_SYSTEM", "CLOUD_SERVICE", "THIRD_PARTY", "PHYSICAL", "OTHER"],
  DataSensitivity: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "SPECIAL_CATEGORY"],
  DataCategory: [
    "IDENTIFIERS", "DEMOGRAPHICS", "FINANCIAL", "HEALTH", "BIOMETRIC", "LOCATION", "BEHAVIORAL",
    "EMPLOYMENT", "EDUCATION", "POLITICAL", "RELIGIOUS", "GENETIC", "SEXUAL_ORIENTATION", "CRIMINAL", "OTHER",
  ],
  LegalBasis: ["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS", "PUBLIC_TASK", "LEGITIMATE_INTERESTS"],
  TransferMechanism: [
    "ADEQUACY_DECISION", "STANDARD_CONTRACTUAL_CLAUSES", "BINDING_CORPORATE_RULES", "DEROGATION",
    "CERTIFICATION", "CODE_OF_CONDUCT", "OTHER",
  ],
  VendorStatus: ["PROSPECTIVE", "ACTIVE", "UNDER_REVIEW", "SUSPENDED", "TERMINATED"],
  VendorRiskTier: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  ContractType: ["DPA", "MSA", "NDA", "SCC", "SUBPROCESSOR", "OTHER"],
  ContractStatus: ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"],
  QuestionnaireStatus: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"],
  ReviewType: ["INITIAL", "PERIODIC", "TRIGGERED", "RENEWAL"],
  TaskStatus: ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"],
  TaskPriority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  RiskLevel: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  AssessmentType: ["DPIA", "PIA", "TIA", "LIA", "VENDOR", "CUSTOM"],
  AssessmentStatus: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "ARCHIVED"],
  MitigationStatus: ["IDENTIFIED", "PLANNED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "NOT_REQUIRED"],
  ApprovalStatus: ["PENDING", "APPROVED", "REJECTED", "DELEGATED"],
  IncidentSeverity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  IncidentStatus: ["REPORTED", "INVESTIGATING", "CONTAINED", "ERADICATED", "RECOVERING", "CLOSED", "FALSE_POSITIVE"],
  IncidentType: [
    "DATA_BREACH", "UNAUTHORIZED_ACCESS", "DATA_LOSS", "SYSTEM_COMPROMISE", "PHISHING", "RANSOMWARE",
    "INSIDER_THREAT", "PHYSICAL_SECURITY", "VENDOR_INCIDENT", "OTHER",
  ],
  NotificationStatus: ["NOT_REQUIRED", "PENDING", "DRAFTED", "SENT", "ACKNOWLEDGED", "FOLLOW_UP_REQUIRED", "CLOSED"],
  DocumentType: ["EVIDENCE", "REPORT", "COMMUNICATION", "LEGAL", "OTHER"],
  AIRiskLevel: ["UNACCEPTABLE", "HIGH_RISK", "LIMITED", "MINIMAL"],
  AISystemStatus: ["DRAFT", "REGISTERED", "UNDER_REVIEW", "COMPLIANT", "NON_COMPLIANT", "DECOMMISSIONED"],
  DSARType: [
    "ACCESS", "RECTIFICATION", "ERASURE", "PORTABILITY", "OBJECTION", "RESTRICTION", "AUTOMATED_DECISION",
    "WITHDRAW_CONSENT", "OTHER",
  ],
  DSARStatus: [
    "SUBMITTED", "IDENTITY_PENDING", "IDENTITY_VERIFIED", "IN_PROGRESS", "DATA_COLLECTED", "REVIEW_PENDING",
    "APPROVED", "COMPLETED", "REJECTED", "CANCELLED",
  ],
  DSARTaskStatus: ["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "NOT_APPLICABLE"],
  CommunicationDirection: ["INBOUND", "OUTBOUND"],
  OrganizationRole: ["OWNER", "ADMIN", "PRIVACY_OFFICER", "MEMBER", "VIEWER"],
} as const;

type EnumName = keyof typeof ENUMS;
const e = <K extends EnumName>(name: K) => z.enum(ENUMS[name] as unknown as [string, ...string[]]);
const en = <K extends EnumName>(name: K, enText: string, esText: string) => d(e(name), enText, esText);
const eo = <K extends EnumName>(name: K, enText: string, esText: string) => o(e(name), enText, esText);
const categories = (enText: string, esText: string) =>
  d(z.array(e("DataCategory")).max(100).default([]), enText, esText);

const createdAt = date("When the record was created at the source.", "Cuándo se creó el registro en el origen.");
const updatedAt = date("When the record was last changed at the source.", "Cuándo se modificó el registro por última vez en el origen.");
const metadata = json(
  "Additional details the source kept with the record, as free JSON. Kept as they are on import.",
  "Otros detalles que el origen guardaba con el registro, en JSON libre. Se conservan tal cual al importar.",
);

/** Draft or confirmed: whether a person has taken the record over. */
export const Confirmation = d(
  z.object({
    state: d(
      z.enum(["draft", "confirmed"]),
      "draft: created by a template, a quick start or an import and not yet checked by a person; confirmed: a person entered it or confirmed it.",
      "draft (borrador): lo creó una plantilla, el inicio rápido o una importación y nadie lo ha revisado aún; confirmed (confirmado): lo introdujo o lo confirmó una persona.",
    ),
    origin: o(
      z.enum(["entered", "template", "imported"]),
      "How the record came to exist: entered by a person, created by a template, or brought in by an import.",
      "Cómo nació el registro: lo introdujo una persona, lo creó una plantilla o llegó en una importación.",
    ),
    sourceRef: text("Which template or import created it, where known.", "Qué plantilla o importación lo creó, si se sabe."),
    confirmedByPersonId: ref("The person who confirmed it (an id in `people`).", "La persona que lo confirmó (un id de `people`)."),
    confirmedAt: date("When it was confirmed.", "Cuándo se confirmó."),
  }),
  "Whether the record is a draft or confirmed, and by whom.",
  "Si el registro es un borrador o está confirmado, y por quién.",
);

// ── The registers ───────────────────────────────────────────────────────────

export const Jurisdiction = d(
  z.object({
    jurisdictionCode: d(z.string().min(1).max(100), "The law's short code, for example GDPR or CCPA. This is the stable identifier.", "El código corto de la norma, por ejemplo GDPR o CCPA. Es el identificador estable."),
    name: text("The law's name.", "El nombre de la norma."),
    region: text("Where it applies, for example EU or US-CA.", "Dónde se aplica, por ejemplo EU o US-CA."),
    isPrimary: bool("The organisation's main law.", "La norma principal de la organización."),
    customSettings: json("Settings the organisation changed for this law.", "Ajustes que la organización cambió para esta norma."),
  }),
  "A law or regulation the organisation follows.",
  "Una ley o norma que sigue la organización.",
);

export const Person = d(
  z.object({
    id: id("The person's id at the source. Other records point at it with `...PersonId`.", "El id de la persona en el origen. Otros registros la señalan con `...PersonId`."),
    name: text("Name.", "Nombre."),
    email: text("E-mail address. Used on import to recognise the same person among the new organisation's members.", "Dirección de correo. Al importar sirve para reconocer a la misma persona entre los miembros de la nueva organización."),
    role: eo("OrganizationRole", "Role in the organisation at the source.", "Papel en la organización en el origen."),
  }),
  "A member of the organisation, as far as other records refer to them. Members are never created by an import: access is granted by inviting people.",
  "Un miembro de la organización, en la medida en que otros registros lo mencionan. Una importación nunca crea miembros: el acceso se concede invitando a las personas.",
);

export const BusinessUnit = d(
  z.object({
    id: id("The department's id.", "El id del departamento."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    parentId: ref("The department it sits under (an id in `businessUnits`).", "El departamento del que depende (un id de `businessUnits`)."),
    ownerPersonId: ref("The member who owns it (an id in `people`).", "El miembro responsable (un id de `people`)."),
    createdAt,
  }),
  "A department of the organisation.",
  "Un departamento de la organización.",
);

export const DataAsset = d(
  z.object({
    id: id("The system's id.", "El id del sistema."),
    name: d(z.string().max(100_000), "Name of the system or data store.", "Nombre del sistema o almacén de datos."),
    description: text("What it is.", "Qué es."),
    type: en("DataAssetType", "Kind of system.", "Tipo de sistema."),
    owner: text("Department or person responsible, as written.", "Departamento o persona responsable, tal como se escribió."),
    location: text("Physical or cloud location.", "Ubicación física o en la nube."),
    hostingType: text("On premises, cloud or hybrid.", "En instalaciones propias, en la nube o mixto."),
    vendor: text("The provider hosting it, as written (not a reference).", "El proveedor que lo aloja, tal como se escribió (no es una referencia)."),
    isProduction: bool("In production use.", "En uso en producción."),
    businessUnitId: ref("Owning department (an id in `businessUnits`).", "Departamento responsable (un id de `businessUnits`)."),
    confirmation: Confirmation.optional(),
    metadata,
    createdAt,
    updatedAt,
  }),
  "A system, application or store that holds personal data (the data inventory).",
  "Un sistema, aplicación o almacén que contiene datos personales (el inventario de datos).",
);

export const DataElement = d(
  z.object({
    id: id("The data element's id.", "El id del elemento de datos."),
    dataAssetId: id("The system that holds it (an id in `dataAssets`).", "El sistema que lo contiene (un id de `dataAssets`)."),
    name: d(z.string().max(100_000), "Field or column name.", "Nombre del campo o columna."),
    description: text("What it holds.", "Qué contiene."),
    category: en("DataCategory", "Category of personal data.", "Categoría de datos personales."),
    sensitivity: eo("DataSensitivity", "How sensitive it is.", "Grado de sensibilidad."),
    isPersonalData: bool("It is personal data.", "Es un dato personal."),
    isSpecialCategory: bool("It is a special category of data (health, beliefs...).", "Es una categoría especial de datos (salud, creencias...)."),
    retentionDays: int("How long it is kept, in days.", "Cuánto tiempo se conserva, en días."),
    legalBasis: text("Legal basis, as written.", "Base jurídica, tal como se escribió."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "One field of personal data held in a system.",
  "Un campo de datos personales que contiene un sistema.",
);

export const ActivityAsset = d(
  z.object({
    dataAssetId: id("The system used (an id in `dataAssets`).", "El sistema utilizado (un id de `dataAssets`)."),
    purpose: text("What the system is used for in this activity.", "Para qué se usa el sistema en esta actividad."),
    dataElementIds: d(z.array(z.string()).max(10_000).default([]), "The data elements of that system the activity uses (ids in `dataElements`).", "Los elementos de datos de ese sistema que usa la actividad (ids de `dataElements`)."),
  }),
  "A system a processing activity uses.",
  "Un sistema que usa una actividad de tratamiento.",
);

export const ProcessingActivity = d(
  z.object({
    id: id("The activity's id.", "El id de la actividad."),
    name: d(z.string().max(100_000), "Name of the activity.", "Nombre de la actividad."),
    description: text("What happens.", "Qué se hace."),
    purpose: d(z.string().max(100_000), "Purpose of the processing.", "Finalidad del tratamiento."),
    legalBasis: en("LegalBasis", "Legal basis.", "Base jurídica."),
    legalBasisDetail: text("More on the legal basis.", "Más detalle sobre la base jurídica."),
    dataSubjects: strings("Who the data is about (customers, employees...).", "A quién se refieren los datos (clientes, empleados...)."),
    categories: categories("Categories of personal data processed.", "Categorías de datos personales tratados."),
    recipients: strings("Categories of recipients.", "Categorías de destinatarios."),
    retentionPeriod: text("How long the data is kept, in words.", "Cuánto tiempo se conservan los datos, en palabras."),
    retentionDays: int("How long the data is kept, in days.", "Cuánto tiempo se conservan los datos, en días."),
    automatedDecisionMaking: bool("Decisions are made by automated means.", "Se toman decisiones automatizadas."),
    automatedDecisionDetail: text("About the automated decisions.", "Sobre las decisiones automatizadas."),
    isActive: bool("The activity is in use.", "La actividad está en uso."),
    businessUnitId: ref("Owning department (an id in `businessUnits`).", "Departamento responsable (un id de `businessUnits`)."),
    lastReviewedAt: date("Last review.", "Última revisión."),
    nextReviewAt: date("Next review due.", "Próxima revisión prevista."),
    assets: list(ActivityAsset, "The systems this activity uses, and which of their data.", "Los sistemas que usa esta actividad y cuáles de sus datos."),
    confirmation: Confirmation.optional(),
    metadata,
    createdAt,
    updatedAt,
  }),
  "An entry of the record of processing activities.",
  "Una entrada del registro de actividades de tratamiento.",
);

export const DataFlow = d(
  z.object({
    id: id("The flow's id.", "El id del flujo."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("Description.", "Descripción."),
    sourceAssetId: id("Where the data comes from (an id in `dataAssets`).", "De dónde salen los datos (un id de `dataAssets`)."),
    destinationAssetId: id("Where the data goes (an id in `dataAssets`).", "A dónde van los datos (un id de `dataAssets`)."),
    dataCategories: categories("Categories of data that move.", "Categorías de datos que circulan."),
    frequency: text("How often (real time, daily...).", "Con qué frecuencia (en tiempo real, a diario...)."),
    volume: text("Approximate volume.", "Volumen aproximado."),
    encryptionMethod: text("How the data is protected in transit.", "Cómo se protegen los datos en tránsito."),
    isAutomated: bool("The flow runs on its own.", "El flujo funciona de forma automática."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "Data moving from one system to another.",
  "Datos que pasan de un sistema a otro.",
);

export const DataTransfer = d(
  z.object({
    id: id("The transfer's id.", "El id de la transferencia."),
    processingActivityId: ref("The activity it belongs to (an id in `processingActivities`).", "La actividad a la que pertenece (un id de `processingActivities`)."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("Description.", "Descripción."),
    destinationCountry: d(z.string().max(1_000), "Destination country (ISO code).", "País de destino (código ISO)."),
    destinationOrg: text("Receiving organisation.", "Organización que recibe los datos."),
    jurisdictionCode: ref("The law that applies (a `jurisdictionCode`).", "La norma aplicable (un `jurisdictionCode`)."),
    mechanism: en("TransferMechanism", "Transfer mechanism.", "Mecanismo de transferencia."),
    safeguards: text("Safeguards in place.", "Garantías aplicadas."),
    documentUrl: text("Link to the transfer agreement.", "Enlace al acuerdo de transferencia."),
    tiaCompleted: bool("A transfer impact assessment was done.", "Se hizo una evaluación de impacto de la transferencia."),
    tiaDate: date("Date of that assessment.", "Fecha de esa evaluación."),
    isActive: bool("The transfer is in use.", "La transferencia está en uso."),
    sccExpiryDate: date("When the standard contractual clauses expire.", "Cuándo vencen las cláusulas contractuales tipo."),
    supplementaryMeasures: json("Supplementary measures.", "Medidas complementarias."),
    complianceStatus: text("Compliance status as recorded (COMPLIANT, NEEDS_REVIEW, NON_COMPLIANT, PENDING).", "Estado de cumplimiento registrado (COMPLIANT, NEEDS_REVIEW, NON_COMPLIANT, PENDING)."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "An international transfer of personal data.",
  "Una transferencia internacional de datos personales.",
);

export const VendorContract = d(
  z.object({
    id: id("The contract's id.", "El id del contrato."),
    type: en("ContractType", "Kind of contract (DPA is the data processing agreement).", "Tipo de contrato (DPA es el contrato de encargo del tratamiento)."),
    status: eo("ContractStatus", "Status.", "Estado."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("Description.", "Descripción."),
    documentUrl: text("Link to the signed document. The document itself is not in the export.", "Enlace al documento firmado. El documento en sí no está en la exportación."),
    startDate: date("Start.", "Inicio."),
    endDate: date("End.", "Fin."),
    renewalDate: date("Renewal.", "Renovación."),
    autoRenewal: bool("Renews on its own.", "Se renueva solo."),
    value: num("Contract value.", "Importe del contrato."),
    currency: text("Currency of the value.", "Moneda del importe."),
    terms: json("Key terms, including the processing agreement's details where one was produced.", "Condiciones clave, incluidos los datos del contrato de encargo cuando se generó."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "A contract with a vendor, including data processing agreements.",
  "Un contrato con un proveedor, incluidos los contratos de encargo del tratamiento.",
);

export const VendorReview = d(
  z.object({
    id: id("The review's id.", "El id de la revisión."),
    reviewerPersonId: ref("Who reviewed (an id in `people`).", "Quién revisó (un id de `people`)."),
    type: eo("ReviewType", "Kind of review.", "Tipo de revisión."),
    status: eo("TaskStatus", "Status.", "Estado."),
    scheduledAt: date("When it was planned.", "Cuándo estaba prevista."),
    completedAt: date("When it was done.", "Cuándo se hizo."),
    findings: text("Findings.", "Hallazgos."),
    riskLevel: eo("RiskLevel", "Risk found.", "Riesgo detectado."),
    recommendations: text("Recommendations.", "Recomendaciones."),
    nextReviewAt: date("Next review.", "Próxima revisión."),
    createdAt,
  }),
  "A review of a vendor.",
  "Una revisión de un proveedor.",
);

export const QuestionnaireResponse = d(
  z.object({
    id: id("The response's id.", "El id de la respuesta."),
    questionnaireName: text("The questionnaire answered, by name.", "El cuestionario respondido, por su nombre."),
    questionnaireVersion: text("Its version.", "Su versión."),
    status: eo("QuestionnaireStatus", "Status.", "Estado."),
    responses: json("The answers.", "Las respuestas."),
    submittedAt: date("Submitted.", "Enviado."),
    reviewedAt: date("Reviewed.", "Revisado."),
    reviewNotes: text("Review notes.", "Notas de la revisión."),
    score: num("Score.", "Puntuación."),
    expiresAt: date("When the answers expire.", "Cuándo caducan las respuestas."),
    createdAt,
  }),
  "A vendor's answers to a security or privacy questionnaire. The vendor's private access link is never exported.",
  "Las respuestas de un proveedor a un cuestionario de seguridad o privacidad. El enlace privado de acceso del proveedor nunca se exporta.",
);

export const Vendor = d(
  z.object({
    id: id("The vendor's id.", "El id del proveedor."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("What they do for the organisation.", "Qué hacen para la organización."),
    website: text("Website.", "Sitio web."),
    status: eo("VendorStatus", "Status.", "Estado."),
    riskTier: eo("VendorRiskTier", "Risk tier.", "Nivel de riesgo."),
    riskScore: num("Risk score.", "Puntuación de riesgo."),
    primaryContact: text("Contact person at the vendor.", "Persona de contacto en el proveedor."),
    contactEmail: text("Contact e-mail.", "Correo de contacto."),
    contactPhone: text("Contact phone.", "Teléfono de contacto."),
    address: text("Address.", "Dirección."),
    categories: strings("Service categories.", "Categorías de servicio."),
    dataProcessed: categories("Categories of personal data they process.", "Categorías de datos personales que tratan."),
    countries: strings("Countries where they operate or store data.", "Países donde operan o guardan datos."),
    certifications: strings("Certifications (ISO 27001, SOC 2...).", "Certificaciones (ISO 27001, SOC 2...)."),
    lastAssessedAt: date("Last assessed.", "Última evaluación."),
    nextReviewAt: date("Next review.", "Próxima revisión."),
    contracts: list(VendorContract, "Contracts with this vendor.", "Contratos con este proveedor."),
    reviews: list(VendorReview, "Reviews of this vendor.", "Revisiones de este proveedor."),
    questionnaireResponses: list(QuestionnaireResponse, "Questionnaires this vendor answered.", "Cuestionarios que respondió este proveedor."),
    confirmation: Confirmation.optional(),
    metadata,
    createdAt,
    updatedAt,
  }),
  "A vendor or processor (the vendor register).",
  "Un proveedor o encargado del tratamiento (el registro de proveedores).",
);

export const AssessmentTemplate = d(
  z.object({
    id: id("The template's id. Assessments point at it with `templateId`.", "El id de la plantilla. Las evaluaciones la señalan con `templateId`."),
    origin: d(z.enum(["organization", "system"]), "organization: made by the organisation, and carried in full; system: built into DPO Central, carried by name and version only.", "organization: la hizo la organización y viaja completa; system: viene con DPO Central y viaja solo por nombre y versión."),
    type: en("AssessmentType", "Kind of assessment.", "Tipo de evaluación."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("Description.", "Descripción."),
    version: text("Version.", "Versión."),
    sections: json("The sections and questions (organisation templates only).", "Las secciones y preguntas (solo plantillas de la organización)."),
    scoringLogic: json("How answers are scored (organisation templates only).", "Cómo se puntúan las respuestas (solo plantillas de la organización)."),
    isActive: bool("Offered for new assessments.", "Se ofrece para nuevas evaluaciones."),
    createdAt,
  }),
  "An assessment template (DPIA, LIA, TIA...).",
  "Una plantilla de evaluación (EIPD, EIL, EIT...).",
);

export const AssessmentResponse = d(
  z.object({
    sectionId: d(z.string().max(500), "The template section (its id inside the template).", "La sección de la plantilla (su id dentro de la plantilla)."),
    questionId: d(z.string().max(500), "The question (its id inside the template).", "La pregunta (su id dentro de la plantilla)."),
    response: json("The answer.", "La respuesta."),
    riskScore: num("Risk score of this answer.", "Puntuación de riesgo de esta respuesta."),
    notes: text("Notes.", "Notas."),
    responderPersonId: ref("Who answered (an id in `people`).", "Quién respondió (un id de `people`)."),
    respondedAt: date("When.", "Cuándo."),
  }),
  "One answer in an assessment.",
  "Una respuesta de una evaluación.",
);

export const AssessmentMitigation = d(
  z.object({
    id: id("The measure's id.", "El id de la medida."),
    riskId: d(z.string().max(500), "The risk it addresses (its id inside the assessment).", "El riesgo que trata (su id dentro de la evaluación)."),
    title: d(z.string().max(100_000), "Title.", "Título."),
    description: text("Description.", "Descripción."),
    status: eo("MitigationStatus", "Status.", "Estado."),
    priority: int("Priority, 1 (highest) to 5.", "Prioridad, de 1 (la más alta) a 5."),
    owner: text("Who is responsible, as written.", "Responsable, tal como se escribió."),
    dueDate: date("Due.", "Fecha prevista."),
    completedAt: date("Done.", "Hecha."),
    evidence: text("Evidence it is in place.", "Pruebas de que está aplicada."),
    createdAt,
  }),
  "A measure that reduces a risk found in an assessment.",
  "Una medida que reduce un riesgo detectado en una evaluación.",
);

export const AssessmentApproval = d(
  z.object({
    level: int("Approval level (1, 2...).", "Nivel de aprobación (1, 2...)."),
    status: eo("ApprovalStatus", "Decision.", "Decisión."),
    approverPersonId: ref("Who decides (an id in `people`).", "Quién decide (un id de `people`)."),
    comments: text("Comments.", "Comentarios."),
    decidedAt: date("When decided.", "Cuándo se decidió."),
    delegatedTo: text("Delegated to, as recorded.", "Delegada en, tal como se registró."),
    createdAt,
  }),
  "An approval step of an assessment.",
  "Un paso de aprobación de una evaluación.",
);

export const AssessmentVersion = d(
  z.object({
    version: d(z.number().int(), "Version number.", "Número de versión."),
    snapshot: json("The assessment as it stood at that version.", "La evaluación tal como estaba en esa versión."),
    changedByPersonId: ref("Who made the change (an id in `people`).", "Quién hizo el cambio (un id de `people`)."),
    changeNotes: text("Notes on the change.", "Notas sobre el cambio."),
    createdAt,
  }),
  "A saved version of an assessment (history; kept in the export, not recreated by an import).",
  "Una versión guardada de una evaluación (historial; está en la exportación, una importación no la recrea).",
);

export const Assessment = d(
  z.object({
    id: id("The assessment's id.", "El id de la evaluación."),
    templateId: id("The template used (an id in `assessmentTemplates`).", "La plantilla usada (un id de `assessmentTemplates`)."),
    processingActivityId: ref("The activity assessed (an id in `processingActivities`).", "La actividad evaluada (un id de `processingActivities`)."),
    vendorId: ref("The vendor assessed (an id in `vendors`).", "El proveedor evaluado (un id de `vendors`)."),
    dataTransferId: ref("The transfer assessed (an id in `dataTransfers`).", "La transferencia evaluada (un id de `dataTransfers`)."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("Description.", "Descripción."),
    status: eo("AssessmentStatus", "Status at the source.", "Estado en el origen."),
    riskLevel: eo("RiskLevel", "Overall risk.", "Riesgo global."),
    riskScore: num("Overall risk score.", "Puntuación global de riesgo."),
    startedAt: date("Started.", "Empezada."),
    submittedAt: date("Submitted for review.", "Enviada a revisión."),
    completedAt: date("Completed.", "Terminada."),
    dueDate: date("Due.", "Fecha prevista."),
    responses: list(AssessmentResponse, "The answers.", "Las respuestas."),
    mitigations: list(AssessmentMitigation, "The measures.", "Las medidas."),
    approvals: list(AssessmentApproval, "The approval steps.", "Los pasos de aprobación."),
    versions: list(AssessmentVersion, "Saved versions.", "Versiones guardadas."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "An assessment: a DPIA, a legitimate interest assessment, a transfer impact assessment, a vendor assessment...",
  "Una evaluación: una EIPD, una evaluación de interés legítimo, una evaluación de impacto de transferencia, una evaluación de proveedor...",
);

export const IncidentTimelineEntry = d(
  z.object({
    id: id("The entry's id.", "El id de la entrada."),
    timestamp: date("When it happened.", "Cuándo ocurrió."),
    title: d(z.string().max(100_000), "Title.", "Título."),
    description: text("Description.", "Descripción."),
    entryType: d(z.string().max(200), "Kind of entry (status change, action taken, communication...).", "Tipo de entrada (cambio de estado, acción, comunicación...)."),
    createdByPersonId: ref("Who wrote it (an id in `people`).", "Quién la escribió (un id de `people`)."),
    metadata,
  }),
  "A dated entry in an incident's timeline.",
  "Una entrada fechada en la cronología de una incidencia.",
);

export const IncidentTask = d(
  z.object({
    id: id("The task's id.", "El id de la tarea."),
    assigneePersonId: ref("Who it is assigned to (an id in `people`).", "A quién está asignada (un id de `people`)."),
    title: d(z.string().max(100_000), "Title.", "Título."),
    description: text("Description.", "Descripción."),
    priority: eo("TaskPriority", "Priority.", "Prioridad."),
    status: eo("TaskStatus", "Status.", "Estado."),
    dueDate: date("Due.", "Fecha prevista."),
    completedAt: date("Done.", "Hecha."),
    notes: text("Notes.", "Notas."),
    createdAt,
  }),
  "A task in the response to an incident.",
  "Una tarea de la respuesta a una incidencia.",
);

export const IncidentNotification = d(
  z.object({
    id: id("The notification's id.", "El id de la notificación."),
    jurisdictionCode: d(z.string().min(1).max(100), "The law under which it is made (a `jurisdictionCode`).", "La norma por la que se hace (un `jurisdictionCode`)."),
    recipientType: d(z.string().max(200), "Who is notified (authority, affected people, other).", "A quién se notifica (autoridad, personas afectadas, otros)."),
    recipientName: text("Recipient's name.", "Nombre del destinatario."),
    recipientEmail: text("Recipient's e-mail.", "Correo del destinatario."),
    status: eo("NotificationStatus", "Status.", "Estado."),
    deadline: date("Deadline.", "Plazo."),
    content: text("Text of the notification.", "Texto de la notificación."),
    sentAt: date("Sent.", "Enviada."),
    acknowledgedAt: date("Acknowledged.", "Acuse de recibo."),
    referenceNumber: text("The authority's reference.", "La referencia de la autoridad."),
    notes: text("Notes.", "Notas."),
    createdAt,
  }),
  "A notification of an incident to an authority or to the people affected.",
  "Una notificación de una incidencia a una autoridad o a las personas afectadas.",
);

export const IncidentAffectedAsset = d(
  z.object({
    dataAssetId: id("The system affected (an id in `dataAssets`).", "El sistema afectado (un id de `dataAssets`)."),
    impactLevel: text("Impact.", "Impacto."),
    compromised: bool("The system was compromised.", "El sistema quedó comprometido."),
    notes: text("Notes.", "Notas."),
  }),
  "A system affected by an incident.",
  "Un sistema afectado por una incidencia.",
);

export const IncidentDocument = d(
  z.object({
    id: id("The document's id.", "El id del documento."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    type: eo("DocumentType", "Kind of document.", "Tipo de documento."),
    url: d(z.string().max(5_000), "Where the document is kept. DPO Central stores a link, not the file.", "Dónde se guarda el documento. DPO Central guarda un enlace, no el archivo."),
    mimeType: text("File type.", "Tipo de archivo."),
    size: int("Size in bytes.", "Tamaño en bytes."),
    uploadedByPersonId: ref("Who added it (an id in `people`).", "Quién lo añadió (un id de `people`)."),
    createdAt,
  }),
  "A document linked to an incident.",
  "Un documento vinculado a una incidencia.",
);

export const Incident = d(
  z.object({
    id: id("The incident's id.", "El id de la incidencia."),
    reference: text("The incident's reference as shown at the source.", "La referencia de la incidencia tal como se mostraba en el origen."),
    title: d(z.string().max(100_000), "Title.", "Título."),
    description: d(z.string().max(100_000), "What happened.", "Qué ocurrió."),
    type: en("IncidentType", "Kind of incident.", "Tipo de incidencia."),
    severity: eo("IncidentSeverity", "Severity.", "Gravedad."),
    status: eo("IncidentStatus", "Status at the source.", "Estado en el origen."),
    discoveredAt: d(z.iso.datetime({ offset: true }), "When it was discovered.", "Cuándo se descubrió."),
    discoveredBy: text("Who discovered it, as written.", "Quién la descubrió, tal como se escribió."),
    discoveryMethod: text("How it was discovered.", "Cómo se descubrió."),
    affectedRecords: int("Number of records affected.", "Número de registros afectados."),
    affectedSubjects: strings("Kinds of people affected.", "Tipos de personas afectadas."),
    dataCategories: categories("Categories of data affected.", "Categorías de datos afectados."),
    jurisdictionCode: ref("The main law that applies (a `jurisdictionCode`).", "La norma principal aplicable (un `jurisdictionCode`)."),
    containedAt: date("Contained.", "Contenida."),
    containmentActions: text("What was done to contain it.", "Qué se hizo para contenerla."),
    rootCause: text("Root cause.", "Causa raíz."),
    rootCauseCategory: text("Category of the root cause.", "Categoría de la causa raíz."),
    resolvedAt: date("Resolved.", "Resuelta."),
    resolutionNotes: text("How it was resolved.", "Cómo se resolvió."),
    lessonsLearned: text("Lessons learned.", "Lecciones aprendidas."),
    notificationRequired: bool("Notification to an authority is required.", "Hay que notificar a una autoridad."),
    notificationDeadline: date("Deadline to notify.", "Plazo para notificar."),
    timeline: list(IncidentTimelineEntry, "The timeline.", "La cronología."),
    tasks: list(IncidentTask, "The tasks.", "Las tareas."),
    notifications: list(IncidentNotification, "The notifications.", "Las notificaciones."),
    affectedAssets: list(IncidentAffectedAsset, "The systems affected.", "Los sistemas afectados."),
    documents: list(IncidentDocument, "Linked documents.", "Documentos vinculados."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "A security incident or personal data breach.",
  "Una incidencia de seguridad o una brecha de datos personales.",
);

export const AISystem = d(
  z.object({
    id: id("The AI system's id.", "El id del sistema de IA."),
    vendorId: ref("Its provider, where it is a vendor (an id in `vendors`).", "Su proveedor, si es un proveedor registrado (un id de `vendors`)."),
    assessmentId: ref("Its impact assessment (an id in `assessments`).", "Su evaluación de impacto (un id de `assessments`)."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    description: text("Description.", "Descripción."),
    purpose: text("What it is used for.", "Para qué se usa."),
    riskLevel: eo("AIRiskLevel", "Risk level under the EU AI Act.", "Nivel de riesgo según el Reglamento europeo de IA."),
    category: text("Use case category.", "Categoría de uso."),
    status: eo("AISystemStatus", "Status at the source.", "Estado en el origen."),
    trainingDataSources: strings("Training data sources.", "Fuentes de los datos de entrenamiento."),
    humanOversight: text("Human oversight.", "Supervisión humana."),
    transparencyMeasures: text("Transparency measures.", "Medidas de transparencia."),
    technicalDocUrl: text("Link to technical documentation.", "Enlace a la documentación técnica."),
    modelType: text("Kind of model.", "Tipo de modelo."),
    deployer: text("Who deploys it.", "Quién lo despliega."),
    provider: text("Who provides it.", "Quién lo suministra."),
    lastReviewedAt: date("Last review.", "Última revisión."),
    nextReviewAt: date("Next review.", "Próxima revisión."),
    aiCapabilities: strings("Capabilities.", "Capacidades."),
    aiTechniques: strings("Techniques.", "Técnicas."),
    euAiActRole: text("Role under the EU AI Act (provider, deployer...).", "Papel según el Reglamento europeo de IA (proveedor, responsable del despliegue...)."),
    euAiActCompliant: bool("Stated compliant with the EU AI Act.", "Declarado conforme con el Reglamento europeo de IA."),
    iso42001Certified: bool("ISO 42001 certified.", "Certificado ISO 42001."),
    aiModels: json("Models used.", "Modelos usados."),
    metadata,
    createdAt,
    updatedAt,
  }),
  "An AI system in the AI register.",
  "Un sistema de IA del registro de IA.",
);

export const RightsRequestForm = d(
  z.object({
    id: id("The form's id.", "El id del formulario."),
    name: d(z.string().max(100_000), "Internal name.", "Nombre interno."),
    slug: d(z.string().min(1).max(200), "The form's address part.", "La parte de la dirección del formulario."),
    title: d(z.string().max(1_000), "Public title.", "Título público."),
    description: text("Public description.", "Descripción pública."),
    fields: json("The form's fields.", "Los campos del formulario."),
    enabledTypes: d(z.array(e("DSARType")).max(50).default([]), "Which rights can be exercised with it.", "Qué derechos se pueden ejercer con él."),
    thankYouMessage: text("Message after sending.", "Mensaje tras el envío."),
    privacyNoticeUrl: text("Link to the privacy notice.", "Enlace al aviso de privacidad."),
    retentionDays: int("Days the requester's details are kept after the request is completed.", "Días que se conservan los datos del solicitante tras completar la solicitud."),
    isActive: bool("In use.", "En uso."),
    createdAt,
  }),
  "A public form through which people exercise their rights. Holds no personal data.",
  "Un formulario público para que las personas ejerzan sus derechos. No contiene datos personales.",
);

export const RightsRequest = d(
  z.object({
    id: id("The request's id.", "El id de la solicitud."),
    reference: text("The request's public reference at the source.", "La referencia pública de la solicitud en el origen."),
    type: en("DSARType", "Right exercised.", "Derecho ejercido."),
    status: eo("DSARStatus", "Status.", "Estado."),
    requesterName: d(z.string().max(1_000), "Requester's name (personal data).", "Nombre del solicitante (dato personal)."),
    requesterEmail: d(z.string().max(1_000), "Requester's e-mail (personal data).", "Correo del solicitante (dato personal)."),
    requesterPhone: text("Requester's phone (personal data).", "Teléfono del solicitante (dato personal)."),
    requesterAddress: text("Requester's address (personal data).", "Dirección del solicitante (dato personal)."),
    relationship: text("Relationship to the organisation (customer, employee...).", "Relación con la organización (cliente, empleado...)."),
    description: text("What was asked.", "Qué se pidió."),
    requestedData: text("Data requested.", "Datos solicitados."),
    verificationMethod: text("How identity was verified.", "Cómo se verificó la identidad."),
    verifiedAt: date("Identity verified.", "Identidad verificada."),
    receivedAt: date("Received.", "Recibida."),
    acknowledgedAt: date("Acknowledged.", "Acuse de recibo."),
    dueDate: date("Deadline.", "Plazo."),
    completedAt: date("Completed.", "Completada."),
    extensionReason: text("Why the deadline was extended.", "Por qué se amplió el plazo."),
    extendedDueDate: date("Extended deadline.", "Plazo ampliado."),
    responseMethod: text("How the answer was given.", "Cómo se respondió."),
    responseNotes: text("Notes on the answer.", "Notas sobre la respuesta."),
    redactedAt: date("When the requester's details were removed after the keeping period.", "Cuándo se borraron los datos del solicitante tras el plazo de conservación."),
    tasks: list(
      d(
        z.object({
          id: id("The task's id.", "El id de la tarea."),
          dataAssetId: ref("The system searched (an id in `dataAssets`).", "El sistema consultado (un id de `dataAssets`)."),
          assigneePersonId: ref("Who it is assigned to (an id in `people`).", "A quién está asignada (un id de `people`)."),
          title: d(z.string().max(100_000), "Title.", "Título."),
          description: text("Description.", "Descripción."),
          status: eo("DSARTaskStatus", "Status.", "Estado."),
          dueDate: date("Due.", "Fecha prevista."),
          completedAt: date("Done.", "Hecha."),
          notes: text("Notes.", "Notas."),
          createdAt,
        }),
        "A task to answer the request.",
        "Una tarea para responder a la solicitud.",
      ),
      "Tasks.",
      "Tareas.",
    ),
    communications: list(
      d(
        z.object({
          id: id("The message's id.", "El id del mensaje."),
          direction: en("CommunicationDirection", "Received or sent.", "Recibido o enviado."),
          channel: d(z.string().max(200), "Channel (e-mail, phone...).", "Canal (correo, teléfono...)."),
          subject: text("Subject.", "Asunto."),
          content: d(z.string().max(1_000_000), "Text (may hold personal data).", "Texto (puede contener datos personales)."),
          sentByPersonId: ref("Who sent it (an id in `people`).", "Quién lo envió (un id de `people`)."),
          sentAt: date("When.", "Cuándo."),
        }),
        "A message exchanged with the requester.",
        "Un mensaje intercambiado con el solicitante.",
      ),
      "Messages.",
      "Mensajes.",
    ),
    metadata,
    createdAt,
    updatedAt,
  }),
  "A request from a person exercising their rights (access, erasure...). Holds personal data: present only when the export was asked to include it.",
  "Una solicitud de una persona que ejerce sus derechos (acceso, supresión...). Contiene datos personales: solo aparece si se pidió incluirla en la exportación.",
);

export const DocumentStatus = d(
  z.object({
    id: d(z.string().max(200), "The document's id in DPO Central's document list (for example ropa, dpia).", "El id del documento en la lista de documentos de DPO Central (por ejemplo ropa, dpia)."),
    state: d(z.enum(["ready", "draft", "needsInput", "notYet"]), "ready: can be produced with real content; draft: can be produced but has gaps; needsInput: needs a record first; notYet: not produced by DPO Central yet.", "ready: se puede generar con contenido real; draft: se puede generar pero tiene huecos; needsInput: necesita antes un registro; notYet: DPO Central aún no lo genera."),
    gaps: strings("What is missing, where it is a draft, as gap=count (for example toConfirm=3).", "Qué falta, si es un borrador, como hueco=número (por ejemplo toConfirm=3)."),
    input: text("The record it waits for, where it needs one.", "El registro que espera, si necesita uno."),
  }),
  "The state of a document the programme can produce, at the time of the export. Information only: an import does not read it.",
  "El estado de un documento que el programa puede generar, en el momento de la exportación. Solo informativo: una importación no lo lee.",
);

export const AuditEntry = d(
  z.object({
    id: id("The entry's id.", "El id de la entrada."),
    at: d(z.iso.datetime({ offset: true }), "When.", "Cuándo."),
    action: d(z.string().max(200), "What was done (CREATE, UPDATE, DELETE, CONFIRM, EXPORT...).", "Qué se hizo (CREATE, UPDATE, DELETE, CONFIRM, EXPORT...)."),
    entityType: d(z.string().max(200), "The kind of record (DataAsset, Vendor...).", "El tipo de registro (DataAsset, Vendor...)."),
    entityId: d(z.string().max(500), "The record's id, or, for a rights request, its public reference.", "El id del registro o, para una solicitud de derechos, su referencia pública."),
    actorPersonId: ref("Who did it (an id in `people`), where known.", "Quién lo hizo (un id de `people`), si se sabe."),
  }),
  "One entry of the audit trail: who did what and when. Only these facts are exported, never the recorded detail, so no request content and no personal data of the people a request is about travel in it.",
  "Una entrada del registro de auditoría: quién hizo qué y cuándo. Solo se exportan estos datos, nunca el detalle registrado, así que no viaja contenido de solicitudes ni datos personales de las personas a las que se refieren.",
);

export const Organization = d(
  z.object({
    id: id("The organisation's id at the source.", "El id de la organización en el origen."),
    name: d(z.string().max(100_000), "Name.", "Nombre."),
    domain: text("E-mail domain used to join.", "Dominio de correo para unirse."),
    createdAt,
    dsarRemindersEnabled: bool("Deadline reminders for rights requests are on.", "Los recordatorios de plazo de las solicitudes de derechos están activados."),
    settings: json("Organisation-wide settings (programme name, quick start state...).", "Ajustes de toda la organización (nombre del programa, estado del inicio rápido...)."),
  }),
  "The organisation's profile.",
  "El perfil de la organización.",
);

export const Programme = d(
  z.object({
    format: d(
      z.string().regex(/^dpocentral-programme\/1\.\d+$/),
      `The format and its version: "${PROGRAMME_FORMAT}". A reader accepts any 1.x version.`,
      `El formato y su versión: "${PROGRAMME_FORMAT}". Un lector acepta cualquier versión 1.x.`,
    ),
    exportedAt: d(z.iso.datetime({ offset: true }), "When the file was made.", "Cuándo se generó el archivo."),
    source: d(
      z.object({
        system: d(z.string().max(200), "The software that wrote the file.", "El programa que escribió el archivo."),
        version: text("Its version.", "Su versión."),
        organizationId: id("The organisation's id there. With `system` it names the source of every id in the file.", "El id de la organización allí. Junto con `system` identifica el origen de todos los ids del archivo."),
      }),
      "Where the file comes from.",
      "De dónde viene el archivo.",
    ),
    contents: d(
      z.object({
        rightsRequests: d(z.boolean().default(false), "The file holds rights requests, and therefore personal data of the people who made them.", "El archivo contiene solicitudes de derechos y, por tanto, datos personales de quienes las hicieron."),
        auditTrail: d(z.boolean().default(true), "The file holds the audit trail's entries.", "El archivo contiene las entradas del registro de auditoría."),
      }),
      "What the file holds beyond the registers.",
      "Qué contiene el archivo además de los registros.",
    ),
    organization: Organization,
    jurisdictions: list(Jurisdiction, "Laws and regulations the organisation follows.", "Leyes y normas que sigue la organización."),
    people: list(Person, "Members other records refer to.", "Miembros a los que se refieren otros registros."),
    businessUnits: list(BusinessUnit, "Departments.", "Departamentos."),
    dataAssets: list(DataAsset, "Systems (the data inventory).", "Sistemas (el inventario de datos)."),
    dataElements: list(DataElement, "Data elements held in the systems.", "Elementos de datos de los sistemas."),
    processingActivities: list(ProcessingActivity, "The record of processing activities.", "El registro de actividades de tratamiento."),
    dataFlows: list(DataFlow, "Data flows between systems.", "Flujos de datos entre sistemas."),
    dataTransfers: list(DataTransfer, "International transfers.", "Transferencias internacionales."),
    vendors: list(Vendor, "The vendor register, with contracts, reviews and questionnaires.", "El registro de proveedores, con contratos, revisiones y cuestionarios."),
    assessmentTemplates: list(AssessmentTemplate, "Assessment templates the assessments use.", "Plantillas de evaluación que usan las evaluaciones."),
    assessments: list(Assessment, "Assessments with answers, measures and approvals.", "Evaluaciones con respuestas, medidas y aprobaciones."),
    incidents: list(Incident, "Incidents and breaches, with their timeline.", "Incidencias y brechas, con su cronología."),
    aiSystems: list(AISystem, "The AI register.", "El registro de IA."),
    rightsRequestForms: list(RightsRequestForm, "Rights request forms.", "Formularios de solicitud de derechos."),
    rightsRequests: list(RightsRequest, "Rights requests (only when included; personal data).", "Solicitudes de derechos (solo si se incluyen; datos personales)."),
    documents: list(DocumentStatus, "The state of the programme's documents at the time of the export.", "El estado de los documentos del programa en el momento de la exportación."),
    auditTrail: list(AuditEntry, "The audit trail (who did what and when).", "El registro de auditoría (quién hizo qué y cuándo)."),
  }),
  "A whole privacy programme, as exported by DPO Central (format dpocentral-programme/1.0).",
  "Un programa de privacidad completo, tal como lo exporta DPO Central (formato dpocentral-programme/1.0).",
);

export type ProgrammeDoc = z.output<typeof Programme>;
export type ProgrammeInput = z.input<typeof Programme>;

/** The registers of the document, in the order they are written and imported. */
export const REGISTER_KEYS = [
  "jurisdictions",
  "people",
  "businessUnits",
  "dataAssets",
  "dataElements",
  "processingActivities",
  "dataFlows",
  "dataTransfers",
  "vendors",
  "assessmentTemplates",
  "assessments",
  "incidents",
  "aiSystems",
  "rightsRequestForms",
  "rightsRequests",
  "documents",
  "auditTrail",
] as const;
export type RegisterKey = (typeof REGISTER_KEYS)[number];

/** The schema of one record of each register. */
export const RECORD_SCHEMAS: Record<RegisterKey, z.ZodType> = {
  jurisdictions: Jurisdiction,
  people: Person,
  businessUnits: BusinessUnit,
  dataAssets: DataAsset,
  dataElements: DataElement,
  processingActivities: ProcessingActivity,
  dataFlows: DataFlow,
  dataTransfers: DataTransfer,
  vendors: Vendor,
  assessmentTemplates: AssessmentTemplate,
  assessments: Assessment,
  incidents: Incident,
  aiSystems: AISystem,
  rightsRequestForms: RightsRequestForm,
  rightsRequests: RightsRequest,
  documents: DocumentStatus,
  auditTrail: AuditEntry,
};

/** One problem found while reading a file, in both languages. */
export interface FormatProblem {
  path: string;
  message: string;
}

/**
 * Validate a parsed programme.json. A 1.x file of a later minor version is
 * read; anything else is refused with the reason. Returns at most `max`
 * problems, each with the JSON path of the field at fault.
 */
export function validateProgramme(
  value: unknown,
  max = 50,
): { ok: true; programme: ProgrammeDoc } | { ok: false; problems: FormatProblem[] } {
  const format = (value as { format?: unknown } | null)?.format;
  if (typeof format !== "string" || !format.startsWith(PROGRAMME_FORMAT_MAJOR)) {
    return {
      ok: false,
      problems: [
        {
          path: "format",
          message:
            typeof format === "string"
              ? `Unsupported format "${format.slice(0, 80)}": this version reads ${PROGRAMME_FORMAT_MAJOR}x.`
              : `Not a programme file: the "format" field is missing (expected "${PROGRAMME_FORMAT}").`,
        },
      ],
    };
  }
  const parsed = Programme.safeParse(value);
  if (parsed.success) return { ok: true, programme: parsed.data };
  return {
    ok: false,
    problems: parsed.error.issues.slice(0, max).map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}
