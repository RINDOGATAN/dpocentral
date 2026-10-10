// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Importing a programme (./format.ts) into an organisation.
 *
 * Two steps, the same code:
 *   1. planImport: reads the file and the organisation, maps every reference,
 *      and returns what would be created, what would be left out and why
 *      (the dry run the person sees before anything is written);
 *   2. applyImport: builds the same plan again and writes it in one
 *      transaction, with one audit entry.
 *
 * The rules:
 *   - A whole programme goes into a new or empty organisation. An
 *     organisation holding records of its own is refused; records an earlier
 *     import of the same source created do not count, so the same file can be
 *     run again. A register import from a CSV file (./csv-import.ts) adds to
 *     an organisation that already has records.
 *   - Nothing is ever overwritten. A record already imported from the same
 *     source (same register, same source id: programme_import_records) is
 *     not created again; its new id is reused for references.
 *   - Everything arrives for a person to review: systems, processing
 *     activities and vendors as drafts ("to confirm", provenance IMPORTED);
 *     assessments and AI systems in their Draft status. Their status at the
 *     source, their confirmation and their approvals are kept in the
 *     record's metadata (metadata.programmeImport.original). Facts keep their
 *     value: an incident's status and timeline, a contract's status.
 *   - References are mapped through the new ids. A reference to a record that
 *     is not in the file is dropped (or the record that needs it is left out),
 *     and the dry run says so.
 *   - People are never created: access is given by inviting them. A person
 *     the file names is matched by e-mail address with a member of this
 *     organisation; otherwise the reference is left empty.
 *   - Rights requests (personal data) are imported only when the person ticks
 *     the separate box, and only where the rights-request module is on.
 *   - Not recreated: assessment approvals and saved versions (kept in the
 *     assessment's metadata as history), the audit trail (this organisation's
 *     trail records the import itself), the documents' states (worked out
 *     again from the records).
 */

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import { PROGRAMME_FORMAT, type ProgrammeDoc } from "./format";

// ── Types ───────────────────────────────────────────────────────────────────

export type ImportKind =
  | "businessUnit"
  | "dataAsset"
  | "dataElement"
  | "processingActivity"
  | "dataFlow"
  | "dataTransfer"
  | "vendor"
  | "assessmentTemplate"
  | "assessment"
  | "incident"
  | "aiSystem"
  | "rightsRequestForm"
  | "rightsRequest";

/** The register name in the file for each kind (the summary's keys). */
export const KIND_REGISTER: Record<ImportKind, keyof ProgrammeDoc> = {
  businessUnit: "businessUnits",
  dataAsset: "dataAssets",
  dataElement: "dataElements",
  processingActivity: "processingActivities",
  dataFlow: "dataFlows",
  dataTransfer: "dataTransfers",
  vendor: "vendors",
  assessmentTemplate: "assessmentTemplates",
  assessment: "assessments",
  incident: "incidents",
  aiSystem: "aiSystems",
  rightsRequestForm: "rightsRequestForms",
  rightsRequest: "rightsRequests",
};

export interface ImportProblem {
  level: "error" | "warning" | "info";
  code: string;
  register?: string;
  sourceId?: string;
  en: string;
  es: string;
}

export interface RegisterSummary {
  inFile: number;
  toCreate: number;
  alreadyImported: number;
  leftOut: number;
}

export interface ImportPlanSummary {
  format: string;
  source: { system: string; organizationId: string; exportedAt: string };
  registers: Partial<Record<ImportKind, RegisterSummary>>;
  /** Rows of every table to be written, child rows included. */
  rows: Record<string, number>;
  problems: ImportProblem[];
  /** False when an error blocks the import. */
  canImport: boolean;
  people: { inFile: number; matched: number };
  rightsRequests: { inFile: number; included: boolean };
}

export interface ImportOptions {
  organizationId: string;
  /** The member importing: the audit entry, and the reviewer of vendor reviews nobody else can own. */
  userId: string;
  /** The person ticked the box: rights requests (personal data) come in. */
  includeRightsRequests: boolean;
  /** The rights-request module is on in this deployment. */
  dsarModuleOn: boolean;
  /** A whole programme needs an empty organisation; a register import does not. */
  requireEmpty: boolean;
  /** How the audit entry names the import. */
  mode?: "programme" | "register";
  /**
   * Ceilings of this deployment (the hosted pilot). Returns a sentence per
   * ceiling the import would pass, in both languages; the route supplies it.
   */
  checkLimits?: (adding: AddingCounts) => Promise<Array<{ en: string; es: string }>>;
  now?: Date;
}

export interface AddingCounts {
  dataAssets: number;
  dataElements: number;
  processingActivities: number;
  dataFlows: number;
  dataTransfers: number;
  vendors: number;
  vendorContracts: number;
  dsarRequests: number;
  assessments: number;
  dpiaAssessments: number;
  assessmentTemplates: number;
  incidents: number;
  aiSystems: number;
}

type Row = Record<string, unknown>;

interface Plan {
  importId: string;
  summary: ImportPlanSummary;
  /** Table (Prisma delegate name) → rows, in write order. */
  writes: Array<[string, Row[]]>;
  records: Array<{ kind: ImportKind; sourceKey: string; localId: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;

/**
 * A new id in the shape of the database's own (cuid-like: "c", time, a
 * counter, random). Ids made later sort later, so child records (a timeline,
 * answers) keep the order they had at the source.
 */
export function newId(): string {
  idCounter = (idCounter + 1) % 1_679_616;
  return `c${Date.now().toString(36).padStart(9, "0")}${idCounter.toString(36).padStart(4, "0")}${randomBytes(6).toString("hex")}`;
}

const asDate = (v: string | null | undefined): Date | null => (v ? new Date(v) : null);
const orNull = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);
/** A JSON column: absent stays absent (the column's default or null). */
const jsonIn = (v: unknown) => (v === undefined || v === null ? undefined : (v as Prisma.InputJsonValue));

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Delegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
  createMany: (args: { data: Row[] }) => Promise<unknown>;
  create: (args: { data: Row }) => Promise<unknown>;
};
const dl = (db: unknown, model: string) => (db as Record<string, Delegate>)[model]!;

/** Problem builders, in both languages. */
const P = {
  notEmpty: (n: number): ImportProblem => ({
    level: "error",
    code: "not_empty",
    en: `This organisation already holds ${n} records of its own. A whole programme is imported into a new or empty organisation, so nothing is mixed or overwritten. Create a new organisation for it, or remove the existing records first.`,
    es: `Esta organización ya tiene ${n} registros propios. Un programa completo se importa en una organización nueva o vacía, para no mezclar ni sobrescribir nada. Crea una organización nueva para él o elimina antes los registros existentes.`,
  }),
  missingRef: (register: string, sourceId: string, field: string, target: string, dropped: "field" | "record"): ImportProblem => ({
    level: "warning",
    code: "missing_reference",
    register,
    sourceId,
    en:
      dropped === "record"
        ? `${register} ${sourceId}: its ${field} points at a record of ${target} that is not in the file, so it is left out.`
        : `${register} ${sourceId}: its ${field} points at a record of ${target} that is not in the file, so that link is left empty.`,
    es:
      dropped === "record"
        ? `${register} ${sourceId}: su campo ${field} señala un registro de ${target} que no está en el archivo, así que no se importa.`
        : `${register} ${sourceId}: su campo ${field} señala un registro de ${target} que no está en el archivo, así que ese enlace queda vacío.`,
  }),
  unknownLaw: (code: string): ImportProblem => ({
    level: "warning",
    code: "unknown_jurisdiction",
    en: `The law "${code}" is not known to this installation: records that name it keep no law, and notifications made under it are left out.`,
    es: `Esta instalación no conoce la norma "${code}": los registros que la citan quedan sin norma y las notificaciones hechas por ella no se importan.`,
  }),
  templateApprox: (name: string, used: string): ImportProblem => ({
    level: "warning",
    code: "template_substituted",
    en: `The built-in template "${name}" is not installed here in the same version; its assessments use "${used}". Check their answers.`,
    es: `La plantilla incorporada "${name}" no está instalada aquí en la misma versión; sus evaluaciones usan "${used}". Revisa sus respuestas.`,
  }),
  templateMissing: (name: string, n: number): ImportProblem => ({
    level: "warning",
    code: "template_missing",
    en: `The template "${name}" is not installed here, so ${n} assessment(s) that use it are left out. Install it (or the module that brings it) and run the import again: what is already imported is not duplicated.`,
    es: `La plantilla "${name}" no está instalada aquí, así que no se importan ${n} evaluación(es) que la usan. Instálala (o el módulo que la trae) y vuelve a importar: lo ya importado no se duplica.`,
  }),
  questionnaireMissing: (name: string): ImportProblem => ({
    level: "warning",
    code: "questionnaire_missing",
    en: `The questionnaire "${name}" is not installed here: the vendors' answers to it are left out.`,
    es: `El cuestionario "${name}" no está instalado aquí: no se importan las respuestas de los proveedores a él.`,
  }),
  formSlugTaken: (slug: string): ImportProblem => ({
    level: "warning",
    code: "form_address_taken",
    en: `A rights request form with the address "${slug}" already exists here, so the one in the file is left out.`,
    es: `Ya existe aquí un formulario de solicitudes con la dirección "${slug}", así que no se importa el del archivo.`,
  }),
  rightsHeldBack: (n: number): ImportProblem => ({
    level: "info",
    code: "rights_requests_held_back",
    en: `The file holds ${n} rights request(s) with personal data. They are imported only if you tick the box that says so.`,
    es: `El archivo contiene ${n} solicitud(es) de derechos con datos personales. Solo se importan si marcas la casilla que lo indica.`,
  }),
  rightsModuleOff: (n: number): ImportProblem => ({
    level: "info",
    code: "rights_module_off",
    en: `The file holds ${n} rights request(s), but the rights request module is not part of this installation, so they are left out.`,
    es: `El archivo contiene ${n} solicitud(es) de derechos, pero el módulo de solicitudes de derechos no forma parte de esta instalación, así que no se importan.`,
  }),
  peopleUnmatched: (n: number): ImportProblem => ({
    level: "info",
    code: "people_unmatched",
    en: `${n} person(s) named in the file are not members here. Records keep their content; who did what is left empty for them. Invite them and later imports will match them.`,
    es: `${n} persona(s) citadas en el archivo no son miembros aquí. Los registros conservan su contenido; queda vacío quién hizo qué en su caso. Invítalas y las próximas importaciones las reconocerán.`,
  }),
  history: (): ImportProblem => ({
    level: "info",
    code: "history_kept_in_metadata",
    en: "Assessment approvals and saved versions, and each record's status and confirmation at the source, are kept with the record as history; they are not recreated here. The source's audit trail is not replayed: this organisation's trail records the import.",
    es: "Las aprobaciones y versiones guardadas de las evaluaciones, y el estado y la confirmación de cada registro en el origen, se guardan con el registro como historial; no se recrean aquí. El registro de auditoría del origen no se reproduce: el de esta organización registra la importación.",
  }),
  limit: (m: { en: string; es: string }): ImportProblem => ({ level: "error", code: "limit", ...m }),
};

// ── Planning ────────────────────────────────────────────────────────────────

/** The source's namespace: ids in the file are unique within it. */
export function sourceNamespace(doc: Pick<ProgrammeDoc, "source">): string {
  return `${doc.source.system}:${doc.source.organizationId}`;
}

async function buildPlan(db: Db, doc: ProgrammeDoc, opts: ImportOptions): Promise<Plan> {
  const now = opts.now ?? new Date();
  const importId = newId();
  const ns = sourceNamespace(doc);
  const orgId = opts.organizationId;
  const org = { organizationId: orgId };
  const problems: ImportProblem[] = [];
  const registers: Partial<Record<ImportKind, RegisterSummary>> = {};
  const tally = (kind: ImportKind, field: keyof RegisterSummary, n = 1) => {
    const s = (registers[kind] ??= { inFile: 0, toCreate: 0, alreadyImported: 0, leftOut: 0 });
    s[field] += n;
  };
  const writes = new Map<string, Row[]>();
  const add = (table: string, row: Row) => {
    const list = writes.get(table);
    if (list) list.push(row);
    else writes.set(table, [row]);
  };
  const records: Plan["records"] = [];
  const mark = (sourceId: string, original?: Row) => ({
    importId,
    source: ns,
    sourceId,
    importedAt: now.toISOString(),
    format: doc.format,
    ...(original ? { original } : {}),
  });
  const meta = (source: unknown, sourceId: string, original?: Row): Prisma.InputJsonValue => {
    const base =
      source && typeof source === "object" && !Array.isArray(source)
        ? { ...(source as Row) }
        : source === null || source === undefined
          ? {}
          : { sourceMetadata: source };
    delete (base as Row).programmeImport;
    return { ...base, programmeImport: mark(sourceId, original) } as Prisma.InputJsonValue;
  };

  // What earlier imports of this source created (and still exists).
  const done = new Map<string, string>(); // `${kind}|${sourceId}` → localId
  const prefix = `${ns}:`;
  const mapped = (await dl(db, "programmeImportRecord").findMany({
    where: { organizationId: orgId, sourceKey: { startsWith: prefix } },
    select: { kind: true, sourceKey: true, localId: true },
  })) as Array<{ kind: ImportKind; sourceKey: string; localId: string }>;
  const MODEL: Record<ImportKind, string> = {
    businessUnit: "businessUnit",
    dataAsset: "dataAsset",
    dataElement: "dataElement",
    processingActivity: "processingActivity",
    dataFlow: "dataFlow",
    dataTransfer: "dataTransfer",
    vendor: "vendor",
    assessmentTemplate: "assessmentTemplate",
    assessment: "assessment",
    incident: "incident",
    aiSystem: "aISystem",
    rightsRequestForm: "dSARIntakeForm",
    rightsRequest: "dSARRequest",
  };
  const byKind = new Map<ImportKind, typeof mapped>();
  for (const m of mapped) {
    const list = byKind.get(m.kind);
    if (list) list.push(m);
    else byKind.set(m.kind, [m]);
  }
  const deleted = new Set<string>();
  for (const [kind, list] of byKind) {
    for (const part of chunk(list, 1000)) {
      const alive = new Set(
        ((await dl(db, MODEL[kind]).findMany({
          where: { id: { in: part.map((m) => m.localId) } },
          select: { id: true },
        })) as Array<{ id: string }>).map((r) => r.id),
      );
      for (const m of part) {
        const sid = m.sourceKey.slice(prefix.length);
        done.set(`${kind}|${sid}`, m.localId);
        if (!alive.has(m.localId)) deleted.add(`${kind}|${sid}`);
      }
    }
  }

  // An empty organisation: no records except those earlier imports made.
  if (opts.requireEmpty) {
    const own = await Promise.all(
      (["businessUnit", "dataAsset", "processingActivity", "dataFlow", "dataTransfer", "vendor", "assessment", "incident", "aiSystem", "rightsRequest"] as ImportKind[]).map(
        async (kind) => {
          const total = await dl(db, MODEL[kind]).count({ where: org });
          const imported = await dl(db, "programmeImportRecord").count({ where: { organizationId: orgId, kind } });
          return Math.max(0, total - imported);
        },
      ),
    );
    const n = own.reduce((a, b) => a + b, 0);
    if (n > 0) problems.push(P.notEmpty(n));
  }

  // Ids: source id → new id, for every record of the file (created or found).
  const ids = new Map<string, string | null>(); // `${kind}|${sourceId}` → local id (null: left out)
  const local = (kind: ImportKind, sid: string | null | undefined): string | null => {
    if (!sid) return null;
    const v = ids.get(`${kind}|${sid}`);
    return v === undefined ? null : v;
  };
  const has = (kind: ImportKind, sid: string | null | undefined) => !!sid && ids.has(`${kind}|${sid}`);
  /** Ids of the records this import creates (not those found from an earlier one). */
  const createdIds = new Set<string>();
  const created = (nid: string | null) => !!nid && createdIds.has(nid);
  /** Decide create / already imported for one record. Returns the new id when it is to be created. */
  const claim = (kind: ImportKind, sid: string): string | null => {
    tally(kind, "inFile");
    const key = `${kind}|${sid}`;
    if (ids.has(key)) {
      // Twice in one file: the first one wins.
      tally(kind, "leftOut");
      return null;
    }
    const before = done.get(key);
    if (before) {
      tally(kind, "alreadyImported");
      ids.set(key, deleted.has(key) ? null : before);
      return null;
    }
    const nid = newId();
    ids.set(key, nid);
    createdIds.add(nid);
    records.push({ kind, sourceKey: `${ns}:${sid}`, localId: nid });
    tally(kind, "toCreate");
    return nid;
  };
  // People: matched by e-mail with this organisation's members.
  const members = (await dl(db, "organizationMember").findMany({ where: org })) as Row[];
  const users = members.length
    ? ((await dl(db, "user").findMany({
        where: { id: { in: members.map((m) => m.userId as string) } },
        select: { id: true, email: true },
      })) as Row[])
    : [];
  const userByEmail = new Map<string, { userId: string; memberId: string }>();
  for (const u of users) {
    const m = members.find((x) => x.userId === u.id);
    if (u.email && m) userByEmail.set(String(u.email).toLowerCase(), { userId: u.id as string, memberId: m.id as string });
  }
  const personMap = new Map<string, { userId: string; memberId: string }>();
  for (const p of doc.people) {
    const hit = p.email ? userByEmail.get(p.email.toLowerCase()) : undefined;
    if (hit) personMap.set(p.id, hit);
  }
  const person = (pid: string | null | undefined) => (pid ? (personMap.get(pid)?.userId ?? null) : null);
  if (doc.people.length > personMap.size) problems.push(P.peopleUnmatched(doc.people.length - personMap.size));

  // Laws: by code.
  const laws = (await dl(db, "jurisdiction").findMany({ select: { id: true, code: true } })) as Row[];
  const lawByCode = new Map(laws.map((l) => [String(l.code).toUpperCase(), l.id as string]));
  const unknownLaws = new Set<string>();
  const law = (code: string | null | undefined): string | null => {
    if (!code) return null;
    const hit = lawByCode.get(code.toUpperCase());
    if (!hit) unknownLaws.add(code);
    return hit ?? null;
  };
  const existingLaws = new Set(
    ((await dl(db, "organizationJurisdiction").findMany({ where: org })) as Row[]).map((r) => r.jurisdictionId as string),
  );
  let hasPrimary = ((await dl(db, "organizationJurisdiction").findMany({ where: org })) as Row[]).some((r) => r.isPrimary);
  for (const j of doc.jurisdictions) {
    const jid = law(j.jurisdictionCode);
    if (!jid || existingLaws.has(jid)) continue;
    existingLaws.add(jid);
    const primary = !!j.isPrimary && !hasPrimary;
    if (primary) hasPrimary = true;
    add("organizationJurisdiction", {
      id: newId(),
      organizationId: orgId,
      jurisdictionId: jid,
      isPrimary: primary,
      customSettings: jsonIn(j.customSettings),
    });
  }

  // Departments: parents first.
  const units = [...doc.businessUnits];
  const depth = (u: (typeof units)[number], seen = new Set<string>()): number => {
    if (!u.parentId || seen.has(u.id)) return 0;
    seen.add(u.id);
    const parent = units.find((x) => x.id === u.parentId);
    return parent ? 1 + depth(parent, seen) : 0;
  };
  units.sort((a, b) => depth(a) - depth(b));
  for (const u of units) claim("businessUnit", u.id);
  for (const u of units) {
    const nid = local("businessUnit", u.id);
    if (!created(nid)) continue;
    add("businessUnit", {
      id: nid,
      organizationId: orgId,
      name: u.name,
      parentId: local("businessUnit", u.parentId),
      ownerId: u.ownerPersonId ? (personMap.get(u.ownerPersonId)?.memberId ?? null) : null,
    });
  }

  // Systems.
  for (const a of doc.dataAssets) claim("dataAsset", a.id);
  for (const a of doc.dataAssets) {
    const nid = local("dataAsset", a.id);
    if (!created(nid)) continue;
    if (a.businessUnitId && !has("businessUnit", a.businessUnitId)) {
      problems.push(P.missingRef("dataAssets", a.id, "businessUnitId", "businessUnits", "field"));
    }
    add("dataAsset", {
      id: nid,
      organizationId: orgId,
      name: a.name,
      description: orNull(a.description),
      type: a.type,
      owner: orNull(a.owner),
      location: orNull(a.location),
      hostingType: orNull(a.hostingType),
      vendor: orNull(a.vendor),
      isProduction: a.isProduction ?? true,
      businessUnitId: local("businessUnit", a.businessUnitId),
      metadata: meta(a.metadata, a.id, a.confirmation ? { confirmation: a.confirmation } : undefined),
      provenance: "IMPORTED",
      sourceRef: "programme-import",
      confirmedBy: null,
      confirmedAt: null,
    });
  }

  // Data elements.
  for (const el of doc.dataElements) {
    if (!local("dataAsset", el.dataAssetId)) {
      tally("dataElement", "inFile");
      tally("dataElement", "leftOut");
      ids.set(`dataElement|${el.id}`, null);
      problems.push(P.missingRef("dataElements", el.id, "dataAssetId", "dataAssets", "record"));
      continue;
    }
    const nid = claim("dataElement", el.id);
    if (!nid) continue;
    add("dataElement", {
      id: nid,
      organizationId: orgId,
      dataAssetId: local("dataAsset", el.dataAssetId),
      name: el.name,
      description: orNull(el.description),
      category: el.category,
      sensitivity: el.sensitivity ?? "INTERNAL",
      isPersonalData: el.isPersonalData ?? true,
      isSpecialCategory: el.isSpecialCategory ?? false,
      retentionDays: orNull(el.retentionDays),
      legalBasis: orNull(el.legalBasis),
      metadata: meta(el.metadata, el.id),
    });
  }

  // Processing activities, with their systems and data elements.
  for (const p of doc.processingActivities) {
    const nid = claim("processingActivity", p.id);
    if (!nid) continue;
    add("processingActivity", {
      id: nid,
      organizationId: orgId,
      name: p.name,
      description: orNull(p.description),
      purpose: p.purpose,
      legalBasis: p.legalBasis,
      legalBasisDetail: orNull(p.legalBasisDetail),
      dataSubjects: p.dataSubjects,
      categories: p.categories,
      recipients: p.recipients,
      retentionPeriod: orNull(p.retentionPeriod),
      retentionDays: orNull(p.retentionDays),
      automatedDecisionMaking: p.automatedDecisionMaking ?? false,
      automatedDecisionDetail: orNull(p.automatedDecisionDetail),
      isActive: p.isActive ?? true,
      businessUnitId: local("businessUnit", p.businessUnitId),
      lastReviewedAt: asDate(p.lastReviewedAt),
      nextReviewAt: asDate(p.nextReviewAt),
      metadata: meta(p.metadata, p.id, p.confirmation ? { confirmation: p.confirmation } : undefined),
      provenance: "IMPORTED",
      sourceRef: "programme-import",
      confirmedBy: null,
      confirmedAt: null,
    });
    const seenAssets = new Set<string>();
    for (const link of p.assets) {
      const asset = local("dataAsset", link.dataAssetId);
      if (!asset) {
        problems.push(P.missingRef("processingActivities", p.id, "assets.dataAssetId", "dataAssets", "field"));
        continue;
      }
      if (seenAssets.has(asset)) continue;
      seenAssets.add(asset);
      const linkId = newId();
      add("processingActivityAsset", { id: linkId, processingActivityId: nid, dataAssetId: asset, purpose: orNull(link.purpose) });
      const seenEl = new Set<string>();
      for (const eid of link.dataElementIds) {
        const el = local("dataElement", eid);
        if (!el || seenEl.has(el)) continue;
        seenEl.add(el);
        add("processingActivityAssetElement", { id: newId(), processingActivityAssetId: linkId, dataElementId: el });
      }
    }
  }

  // Data flows.
  for (const f of doc.dataFlows) {
    const src = local("dataAsset", f.sourceAssetId);
    const dst = local("dataAsset", f.destinationAssetId);
    if (!src || !dst) {
      tally("dataFlow", "inFile");
      tally("dataFlow", "leftOut");
      problems.push(P.missingRef("dataFlows", f.id, src ? "destinationAssetId" : "sourceAssetId", "dataAssets", "record"));
      continue;
    }
    const nid = claim("dataFlow", f.id);
    if (!nid) continue;
    add("dataFlow", {
      id: nid,
      organizationId: orgId,
      name: f.name,
      description: orNull(f.description),
      sourceAssetId: src,
      destinationAssetId: dst,
      dataCategories: f.dataCategories,
      frequency: orNull(f.frequency),
      volume: orNull(f.volume),
      encryptionMethod: orNull(f.encryptionMethod),
      isAutomated: f.isAutomated ?? true,
      metadata: meta(f.metadata, f.id),
    });
  }

  // Transfers.
  for (const t of doc.dataTransfers) {
    const nid = claim("dataTransfer", t.id);
    if (!nid) continue;
    if (t.processingActivityId && !local("processingActivity", t.processingActivityId)) {
      problems.push(P.missingRef("dataTransfers", t.id, "processingActivityId", "processingActivities", "field"));
    }
    add("dataTransfer", {
      id: nid,
      organizationId: orgId,
      processingActivityId: local("processingActivity", t.processingActivityId),
      name: t.name,
      description: orNull(t.description),
      destinationCountry: t.destinationCountry,
      destinationOrg: orNull(t.destinationOrg),
      jurisdictionId: law(t.jurisdictionCode),
      mechanism: t.mechanism,
      safeguards: orNull(t.safeguards),
      documentUrl: orNull(t.documentUrl),
      tiaCompleted: t.tiaCompleted ?? false,
      tiaDate: asDate(t.tiaDate),
      isActive: t.isActive ?? true,
      sccExpiryDate: asDate(t.sccExpiryDate),
      supplementaryMeasures: jsonIn(t.supplementaryMeasures),
      complianceStatus: orNull(t.complianceStatus),
      metadata: meta(t.metadata, t.id),
    });
  }

  // Vendors, with contracts, reviews and questionnaire answers.
  const questionnaires = (await dl(db, "vendorQuestionnaire").findMany({
    select: { id: true, name: true, version: true, organizationId: true },
  })) as Row[];
  const missingQ = new Set<string>();
  for (const v of doc.vendors) {
    const nid = claim("vendor", v.id);
    if (!nid) continue;
    add("vendor", {
      id: nid,
      organizationId: orgId,
      name: v.name,
      description: orNull(v.description),
      website: orNull(v.website),
      status: v.status ?? "PROSPECTIVE",
      riskTier: orNull(v.riskTier),
      riskScore: orNull(v.riskScore),
      primaryContact: orNull(v.primaryContact),
      contactEmail: orNull(v.contactEmail),
      contactPhone: orNull(v.contactPhone),
      address: orNull(v.address),
      categories: v.categories,
      dataProcessed: v.dataProcessed,
      countries: v.countries,
      certifications: v.certifications,
      lastAssessedAt: asDate(v.lastAssessedAt),
      nextReviewAt: asDate(v.nextReviewAt),
      metadata: meta(v.metadata, v.id, v.confirmation ? { confirmation: v.confirmation } : undefined),
      provenance: "IMPORTED",
      sourceRef: "programme-import",
      confirmedBy: null,
      confirmedAt: null,
    });
    for (const k of v.contracts) {
      add("vendorContract", {
        id: newId(),
        vendorId: nid,
        type: k.type,
        status: k.status ?? "DRAFT",
        name: k.name,
        description: orNull(k.description),
        documentUrl: orNull(k.documentUrl),
        startDate: asDate(k.startDate),
        endDate: asDate(k.endDate),
        renewalDate: asDate(k.renewalDate),
        autoRenewal: k.autoRenewal ?? false,
        value: orNull(k.value),
        currency: orNull(k.currency),
        terms: jsonIn(k.terms),
        metadata: meta(k.metadata, k.id),
      });
    }
    for (const r of v.reviews) {
      add("vendorReview", {
        id: newId(),
        vendorId: nid,
        // A review needs a reviewer: the same person if they are a member here, else the importer.
        reviewerId: person(r.reviewerPersonId) ?? opts.userId,
        type: r.type ?? "PERIODIC",
        status: r.status ?? "TODO",
        scheduledAt: asDate(r.scheduledAt) ?? asDate(r.createdAt) ?? now,
        completedAt: asDate(r.completedAt),
        findings: orNull(r.findings),
        riskLevel: orNull(r.riskLevel),
        recommendations: orNull(r.recommendations),
        nextReviewAt: asDate(r.nextReviewAt),
      });
    }
    for (const q of v.questionnaireResponses) {
      const found =
        questionnaires.find((x) => x.name === q.questionnaireName && x.version === q.questionnaireVersion && !x.organizationId) ??
        questionnaires.find((x) => x.name === q.questionnaireName && !x.organizationId);
      if (!found) {
        if (q.questionnaireName) missingQ.add(q.questionnaireName);
        continue;
      }
      add("vendorQuestionnaireResponse", {
        id: newId(),
        vendorId: nid,
        questionnaireId: found.id,
        status: q.status ?? "NOT_STARTED",
        responses: jsonIn(q.responses),
        submittedAt: asDate(q.submittedAt),
        reviewedAt: asDate(q.reviewedAt),
        reviewNotes: orNull(q.reviewNotes),
        score: orNull(q.score),
        expiresAt: asDate(q.expiresAt),
        token: null,
      });
    }
  }
  for (const name of missingQ) problems.push(P.questionnaireMissing(name));

  // Assessment templates: the organisation's own are created; built-in ones are found here.
  const systemTemplates = (await dl(db, "assessmentTemplate").findMany({
    where: { organizationId: null },
    select: { id: true, type: true, name: true, version: true, isActive: true, supersededAt: true },
  })) as Row[];
  const templateFor = new Map<string, string | null>(); // source template id → local id
  const templateName = new Map<string, string>();
  for (const t of doc.assessmentTemplates) {
    templateName.set(t.id, t.name);
    if (t.origin === "organization") {
      const nid = claim("assessmentTemplate", t.id);
      const target = nid ?? local("assessmentTemplate", t.id);
      templateFor.set(t.id, target);
      if (!nid) continue;
      add("assessmentTemplate", {
        id: nid,
        organizationId: orgId,
        type: t.type,
        name: t.name,
        description: orNull(t.description),
        version: t.version ?? "1.0",
        sections: jsonIn(t.sections) ?? [],
        scoringLogic: jsonIn(t.scoringLogic),
        isSystem: false,
        isActive: t.isActive ?? true,
      });
    } else {
      const exact = systemTemplates.find((x) => x.name === t.name && x.version === (t.version ?? x.version));
      const byName = systemTemplates.find((x) => x.name === t.name);
      const byType = systemTemplates.find((x) => x.type === t.type && x.isActive && !x.supersededAt);
      const hit = exact ?? byName ?? byType;
      templateFor.set(t.id, (hit?.id as string | undefined) ?? null);
      if (hit && !exact) problems.push(P.templateApprox(t.name, String(hit.name)));
    }
  }

  // Assessments, as drafts.
  const templateMissing = new Map<string, number>();
  const templateType = new Map<string, string>();
  for (const t of systemTemplates) templateType.set(t.id as string, t.type as string);
  for (const t of doc.assessmentTemplates) {
    const lid = templateFor.get(t.id);
    if (lid) templateType.set(lid, t.type);
  }
  let dpiaAssessments = 0;
  for (const a of doc.assessments) {
    const tid = templateFor.get(a.templateId) ?? null;
    if (!tid) {
      tally("assessment", "inFile");
      tally("assessment", "leftOut");
      ids.set(`assessment|${a.id}`, null);
      const name = templateName.get(a.templateId) ?? a.templateId;
      templateMissing.set(name, (templateMissing.get(name) ?? 0) + 1);
      continue;
    }
    const nid = claim("assessment", a.id);
    if (!nid) continue;
    if (templateType.get(tid) === "DPIA") dpiaAssessments++;
    for (const [field, kind, reg] of [
      ["processingActivityId", "processingActivity", "processingActivities"],
      ["vendorId", "vendor", "vendors"],
      ["dataTransferId", "dataTransfer", "dataTransfers"],
    ] as const) {
      const sid = a[field];
      if (sid && !local(kind, sid)) problems.push(P.missingRef("assessments", a.id, field, reg, "field"));
    }
    add("assessment", {
      id: nid,
      organizationId: orgId,
      templateId: tid,
      processingActivityId: local("processingActivity", a.processingActivityId),
      vendorId: local("vendor", a.vendorId),
      dataTransferId: local("dataTransfer", a.dataTransferId),
      name: a.name,
      description: orNull(a.description),
      status: "DRAFT",
      riskLevel: orNull(a.riskLevel),
      riskScore: orNull(a.riskScore),
      startedAt: asDate(a.startedAt) ?? now,
      submittedAt: null,
      completedAt: null,
      dueDate: asDate(a.dueDate),
      metadata: meta(a.metadata, a.id, {
        status: a.status ?? null,
        submittedAt: a.submittedAt ?? null,
        completedAt: a.completedAt ?? null,
        approvals: a.approvals as unknown as Row[],
        versions: a.versions.map((v) => ({ version: v.version, changedByPersonId: v.changedByPersonId ?? null, changeNotes: v.changeNotes ?? null, createdAt: v.createdAt ?? null })),
      }),
    });
    const seenQ = new Set<string>();
    for (const r of a.responses) {
      if (seenQ.has(r.questionId)) continue;
      seenQ.add(r.questionId);
      add("assessmentResponse", {
        id: newId(),
        assessmentId: nid,
        questionId: r.questionId,
        sectionId: r.sectionId,
        response: (r.response ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        riskScore: orNull(r.riskScore),
        notes: orNull(r.notes),
        responderId: person(r.responderPersonId),
        respondedAt: asDate(r.respondedAt) ?? now,
      });
    }
    for (const m of a.mitigations) {
      add("assessmentMitigation", {
        id: newId(),
        assessmentId: nid,
        riskId: m.riskId,
        title: m.title,
        description: orNull(m.description),
        status: m.status ?? "IDENTIFIED",
        priority: m.priority ?? 3,
        owner: orNull(m.owner),
        dueDate: asDate(m.dueDate),
        completedAt: asDate(m.completedAt),
        evidence: orNull(m.evidence),
      });
    }
  }
  for (const [name, n] of templateMissing) problems.push(P.templateMissing(name, n));

  // Incidents, with their timeline and the rest.
  for (const i of doc.incidents) {
    const nid = claim("incident", i.id);
    if (!nid) continue;
    add("incident", {
      id: nid,
      organizationId: orgId,
      title: i.title,
      description: i.description,
      type: i.type,
      severity: i.severity ?? "MEDIUM",
      status: i.status ?? "REPORTED",
      discoveredAt: new Date(i.discoveredAt),
      discoveredBy: orNull(i.discoveredBy),
      discoveryMethod: orNull(i.discoveryMethod),
      affectedRecords: orNull(i.affectedRecords),
      affectedSubjects: i.affectedSubjects,
      dataCategories: i.dataCategories,
      jurisdictionId: law(i.jurisdictionCode),
      containedAt: asDate(i.containedAt),
      containmentActions: orNull(i.containmentActions),
      rootCause: orNull(i.rootCause),
      rootCauseCategory: orNull(i.rootCauseCategory),
      resolvedAt: asDate(i.resolvedAt),
      resolutionNotes: orNull(i.resolutionNotes),
      lessonsLearned: orNull(i.lessonsLearned),
      notificationRequired: i.notificationRequired ?? false,
      notificationDeadline: asDate(i.notificationDeadline),
      metadata: meta(i.metadata, i.id, { reference: i.reference ?? null }),
    });
    for (const t of i.timeline) {
      add("incidentTimelineEntry", {
        id: newId(),
        incidentId: nid,
        timestamp: asDate(t.timestamp) ?? now,
        title: t.title,
        description: orNull(t.description),
        entryType: t.entryType,
        createdById: person(t.createdByPersonId),
        metadata: jsonIn(t.metadata),
      });
    }
    for (const t of i.tasks) {
      add("incidentTask", {
        id: newId(),
        incidentId: nid,
        assigneeId: person(t.assigneePersonId),
        title: t.title,
        description: orNull(t.description),
        priority: t.priority ?? "MEDIUM",
        status: t.status ?? "TODO",
        dueDate: asDate(t.dueDate),
        completedAt: asDate(t.completedAt),
        notes: orNull(t.notes),
      });
    }
    for (const n of i.notifications) {
      const jid = law(n.jurisdictionCode);
      if (!jid) continue;
      add("incidentNotification", {
        id: newId(),
        incidentId: nid,
        jurisdictionId: jid,
        recipientType: n.recipientType,
        recipientName: orNull(n.recipientName),
        recipientEmail: orNull(n.recipientEmail),
        status: n.status ?? "PENDING",
        deadline: asDate(n.deadline) ?? asDate(i.notificationDeadline) ?? now,
        content: orNull(n.content),
        sentAt: asDate(n.sentAt),
        acknowledgedAt: asDate(n.acknowledgedAt),
        referenceNumber: orNull(n.referenceNumber),
        notes: orNull(n.notes),
      });
    }
    const seenA = new Set<string>();
    for (const x of i.affectedAssets) {
      const aid = local("dataAsset", x.dataAssetId);
      if (!aid) {
        problems.push(P.missingRef("incidents", i.id, "affectedAssets.dataAssetId", "dataAssets", "field"));
        continue;
      }
      if (seenA.has(aid)) continue;
      seenA.add(aid);
      add("incidentAffectedAsset", {
        id: newId(),
        incidentId: nid,
        dataAssetId: aid,
        impactLevel: orNull(x.impactLevel),
        compromised: x.compromised ?? false,
        notes: orNull(x.notes),
      });
    }
    for (const x of i.documents) {
      add("incidentDocument", {
        id: newId(),
        incidentId: nid,
        name: x.name,
        type: x.type ?? "OTHER",
        url: x.url,
        mimeType: orNull(x.mimeType),
        size: orNull(x.size),
        uploadedBy: person(x.uploadedByPersonId),
      });
    }
  }

  // AI systems, as drafts.
  for (const s of doc.aiSystems) {
    const nid = claim("aiSystem", s.id);
    if (!nid) continue;
    add("aISystem", {
      id: nid,
      organizationId: orgId,
      vendorId: local("vendor", s.vendorId),
      assessmentId: local("assessment", s.assessmentId),
      name: s.name,
      description: orNull(s.description),
      purpose: orNull(s.purpose),
      riskLevel: s.riskLevel ?? "MINIMAL",
      category: orNull(s.category),
      status: "DRAFT",
      trainingDataSources: s.trainingDataSources,
      humanOversight: orNull(s.humanOversight),
      transparencyMeasures: orNull(s.transparencyMeasures),
      technicalDocUrl: orNull(s.technicalDocUrl),
      modelType: orNull(s.modelType),
      deployer: orNull(s.deployer),
      provider: orNull(s.provider),
      lastReviewedAt: asDate(s.lastReviewedAt),
      nextReviewAt: asDate(s.nextReviewAt),
      aiCapabilities: s.aiCapabilities,
      aiTechniques: s.aiTechniques,
      euAiActRole: orNull(s.euAiActRole),
      euAiActCompliant: orNull(s.euAiActCompliant),
      iso42001Certified: orNull(s.iso42001Certified),
      aiModels: jsonIn(s.aiModels),
      metadata: meta(s.metadata, s.id, { status: s.status ?? null }),
    });
  }

  // Rights request forms and requests.
  if (opts.dsarModuleOn) {
    const slugs = new Set(((await dl(db, "dSARIntakeForm").findMany({ where: org, select: { slug: true } })) as Row[]).map((r) => r.slug as string));
    for (const f of doc.rightsRequestForms) {
      if (slugs.has(f.slug) && !done.has(`rightsRequestForm|${f.id}`)) {
        tally("rightsRequestForm", "inFile");
        tally("rightsRequestForm", "leftOut");
        problems.push(P.formSlugTaken(f.slug));
        continue;
      }
      const nid = claim("rightsRequestForm", f.id);
      if (!nid) continue;
      slugs.add(f.slug);
      add("dSARIntakeForm", {
        id: nid,
        organizationId: orgId,
        name: f.name,
        slug: f.slug,
        title: f.title,
        description: orNull(f.description),
        fields: jsonIn(f.fields) ?? [],
        enabledTypes: f.enabledTypes,
        thankYouMessage: orNull(f.thankYouMessage),
        privacyNoticeUrl: orNull(f.privacyNoticeUrl),
        retentionDays: f.retentionDays ?? 90,
        isActive: f.isActive ?? true,
      });
    }
  }
  const requests = doc.rightsRequests;
  if (requests.length && !opts.dsarModuleOn) problems.push(P.rightsModuleOff(requests.length));
  else if (requests.length && !opts.includeRightsRequests) problems.push(P.rightsHeldBack(requests.length));
  const takeRequests = opts.dsarModuleOn && opts.includeRightsRequests;
  if (takeRequests) {
    for (const r of requests) {
      const nid = claim("rightsRequest", r.id);
      if (!nid) continue;
      const received = asDate(r.receivedAt) ?? now;
      add("dSARRequest", {
        id: nid,
        organizationId: orgId,
        type: r.type,
        status: r.status ?? "SUBMITTED",
        requesterName: r.requesterName,
        requesterEmail: r.requesterEmail,
        requesterPhone: orNull(r.requesterPhone),
        requesterAddress: orNull(r.requesterAddress),
        relationship: orNull(r.relationship),
        description: orNull(r.description),
        requestedData: orNull(r.requestedData),
        verificationMethod: orNull(r.verificationMethod),
        verifiedAt: asDate(r.verifiedAt),
        receivedAt: received,
        acknowledgedAt: asDate(r.acknowledgedAt),
        dueDate: asDate(r.dueDate) ?? new Date(received.getTime() + 30 * 86_400_000),
        completedAt: asDate(r.completedAt),
        extensionReason: orNull(r.extensionReason),
        extendedDueDate: asDate(r.extendedDueDate),
        responseMethod: orNull(r.responseMethod),
        responseNotes: orNull(r.responseNotes),
        redactedAt: asDate(r.redactedAt),
        metadata: meta(r.metadata, r.id, { reference: r.reference ?? null }),
      });
      for (const t of r.tasks) {
        add("dSARTask", {
          id: newId(),
          dsarRequestId: nid,
          dataAssetId: local("dataAsset", t.dataAssetId),
          assigneeId: person(t.assigneePersonId),
          title: t.title,
          description: orNull(t.description),
          status: t.status ?? "PENDING",
          dueDate: asDate(t.dueDate),
          completedAt: asDate(t.completedAt),
          notes: orNull(t.notes),
        });
      }
      for (const m of r.communications) {
        add("dSARCommunication", {
          id: newId(),
          dsarRequestId: nid,
          direction: m.direction,
          channel: m.channel,
          subject: orNull(m.subject),
          content: m.content,
          sentById: person(m.sentByPersonId),
          sentAt: asDate(m.sentAt) ?? now,
        });
      }
    }
  }

  for (const code of unknownLaws) problems.push(P.unknownLaw(code));
  if (doc.assessments.some((a) => a.approvals.length || a.versions.length) || doc.auditTrail.length) {
    problems.push(P.history());
  }

  // The ceilings of this deployment (hosted pilot).
  if (opts.checkLimits) {
    const n = (t: string) => writes.get(t)?.length ?? 0;
    const over = await opts.checkLimits({
      dataAssets: n("dataAsset"),
      dataElements: n("dataElement"),
      processingActivities: n("processingActivity"),
      dataFlows: n("dataFlow"),
      dataTransfers: n("dataTransfer"),
      vendors: n("vendor"),
      vendorContracts: n("vendorContract"),
      dsarRequests: n("dSARRequest"),
      assessments: n("assessment"),
      dpiaAssessments,
      assessmentTemplates: n("assessmentTemplate"),
      incidents: n("incident"),
      aiSystems: n("aISystem"),
    });
    for (const m of over) problems.push(P.limit(m));
  }

  const ORDER = [
    "organizationJurisdiction",
    "businessUnit",
    "dataAsset",
    "dataElement",
    "processingActivity",
    "processingActivityAsset",
    "processingActivityAssetElement",
    "dataFlow",
    "dataTransfer",
    "vendor",
    "vendorContract",
    "vendorReview",
    "vendorQuestionnaireResponse",
    "assessmentTemplate",
    "assessment",
    "assessmentResponse",
    "assessmentMitigation",
    "incident",
    "incidentTimelineEntry",
    "incidentTask",
    "incidentNotification",
    "incidentAffectedAsset",
    "incidentDocument",
    "aISystem",
    "dSARIntakeForm",
    "dSARRequest",
    "dSARTask",
    "dSARCommunication",
  ];
  const ordered: Array<[string, Row[]]> = ORDER.filter((t) => writes.has(t)).map((t) => [t, writes.get(t)!]);
  const rows: Record<string, number> = {};
  for (const [t, list] of ordered) rows[t] = list.length;

  return {
    importId,
    writes: ordered,
    records,
    summary: {
      format: doc.format,
      source: { system: doc.source.system, organizationId: doc.source.organizationId, exportedAt: doc.exportedAt },
      registers,
      rows,
      problems,
      canImport: !problems.some((p) => p.level === "error"),
      people: { inFile: doc.people.length, matched: personMap.size },
      rightsRequests: { inFile: requests.length, included: takeRequests },
    },
  };
}

/** The dry run: what an import would do. Writes nothing. */
export async function planImport(db: Db, doc: ProgrammeDoc, opts: ImportOptions): Promise<ImportPlanSummary> {
  return (await buildPlan(db, doc, opts)).summary;
}

export class ImportRefusedError extends Error {
  constructor(public readonly summary: ImportPlanSummary) {
    super("The import cannot go ahead: see the problems listed.");
  }
}

/** Rows per insert statement. */
const INSERT_BATCH = 1000;

/**
 * Write the import. Refuses (ImportRefusedError, nothing written) when the
 * dry run finds an error. One transaction: all of it or none of it.
 */
export async function applyImport(
  db: Db,
  doc: ProgrammeDoc,
  opts: ImportOptions,
): Promise<{ importId: string; summary: ImportPlanSummary; created: number }> {
  const plan = await buildPlan(db, doc, opts);
  if (!plan.summary.canImport) throw new ImportRefusedError(plan.summary);
  const created = plan.records.length;

  await (db as unknown as { $transaction: <T>(fn: (tx: Db) => Promise<T>, o?: object) => Promise<T> }).$transaction(
    async (tx) => {
      for (const [table, list] of plan.writes) {
        for (const part of chunk(list, INSERT_BATCH)) await dl(tx, table).createMany({ data: part });
      }
      for (const part of chunk(plan.records, INSERT_BATCH)) {
        await dl(tx, "programmeImportRecord").createMany({
          data: part.map((r) => ({
            id: newId(),
            organizationId: opts.organizationId,
            importId: plan.importId,
            kind: r.kind,
            sourceKey: r.sourceKey,
            localId: r.localId,
          })),
        });
      }
      await dl(tx, "auditLog").create({
        data: {
          organizationId: opts.organizationId,
          userId: opts.userId,
          entityType: "Organization",
          entityId: opts.organizationId,
          action: opts.mode === "register" ? "IMPORT_REGISTER" : "IMPORT_PROGRAMME",
          // Counts and the source only: never the records' content.
          changes: {
            importId: plan.importId,
            format: doc.format,
            sourceSystem: doc.source.system,
            sourceOrganizationId: doc.source.organizationId,
            created,
            rows: plan.summary.rows,
            rightsRequests: plan.summary.rightsRequests.included,
            problems: plan.summary.problems.length,
          } as Prisma.InputJsonValue,
        },
      });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { importId: plan.importId, summary: plan.summary, created };
}

export { PROGRAMME_FORMAT };
