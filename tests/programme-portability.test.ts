// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Programme portability (owner's decision, 9 October 2026; the EU Data Act,
 * Chapter VI): src/server/services/portability.
 *
 *  - the round trip: export, import into an empty organisation, export again:
 *    the same records, as drafts, with the same references;
 *  - the published JSON Schema (draft 2020-12) accepts what is exported and
 *    refuses what is not, and explains every field in both languages;
 *  - what never leaves: other organisations, secrets, the audit detail, and
 *    rights requests unless asked for with the separate box;
 *  - the import's rules: empty organisation, never overwrite, idempotent;
 *  - a large organisation streams page by page.
 */

import { describe, it, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import Ajv2020 from "ajv/dist/2020";
import * as PrismaEnums from "@prisma/client";
import { memoryDb, type MemoryDb } from "./helpers/memory-db";
import { seedGlobals, seedProgramme, SOURCE_ORG, OTHER_ORG, TARGET_ORG, REQUESTER_EMAIL } from "./helpers/programme-fixture";
import { programmeArchive, type ProgrammeExportOptions } from "@/server/services/portability/export";
import { ENUMS, PROGRAMME_FORMAT, validateProgramme, type ProgrammeDoc } from "@/server/services/portability/format";
import { programmeJsonSchema, programmeReadme } from "@/server/services/portability/docs";
import { applyImport, ImportRefusedError, planImport, type ImportOptions } from "@/server/services/portability/import";
import { readProgrammeUpload } from "@/server/services/portability/upload";
import { canExportProgramme } from "@/server/services/portability/access";
import { isDraftRecord } from "@/lib/drafts";
import type { Db } from "@/lib/prisma";
import { byId, canonical, idMapFrom, ROUND_TRIP_REGISTERS, strip } from "./helpers/programme-compare";

type Rec = Record<string, unknown>;

async function collect(gen: AsyncGenerator<Uint8Array>): Promise<{ bytes: Buffer; chunks: number; maxChunk: number }> {
  const parts: Uint8Array[] = [];
  let maxChunk = 0;
  for await (const c of gen) {
    parts.push(c);
    maxChunk = Math.max(maxChunk, c.length);
  }
  return { bytes: Buffer.concat(parts), chunks: parts.length, maxChunk };
}

const exportOpts = (organizationId: string, extra: Partial<ProgrammeExportOptions> = {}): ProgrammeExportOptions => ({
  organizationId,
  includeRightsRequests: false,
  dsarModuleOn: true,
  locale: "en",
  documents: async () => [{ id: "ropa", state: "draft", gaps: ["toConfirm=1"], input: null }],
  appVersion: "test",
  now: new Date("2026-10-09T12:00:00Z"),
  ...extra,
});

async function exportOrg(db: MemoryDb, organizationId: string, extra: Partial<ProgrammeExportOptions> = {}) {
  const { bytes } = await collect(programmeArchive(db as unknown as Db, exportOpts(organizationId, extra)));
  const zip = new AdmZip(bytes);
  const text = (name: string) => zip.getEntry(name)?.getData().toString("utf8") ?? null;
  const programme = JSON.parse(text("programme.json")!) as ProgrammeDoc;
  return { bytes, zip, text, programme, names: zip.getEntries().map((e) => e.entryName) };
}

const importOpts = (extra: Partial<ImportOptions> = {}): ImportOptions => ({
  organizationId: TARGET_ORG,
  userId: "user-target",
  includeRightsRequests: false,
  dsarModuleOn: true,
  requireEmpty: true,
  mode: "programme",
  now: new Date("2026-10-09T13:00:00Z"),
  ...extra,
});

function setup(): MemoryDb {
  const db = memoryDb();
  seedGlobals(db);
  seedProgramme(db, SOURCE_ORG, { prefix: "src" });
  seedProgramme(db, OTHER_ORG, { prefix: "oth", ownerUserId: "user-other" });
  db.insert("organization", { id: TARGET_ORG, name: "Target", slug: "target" });
  db.insert("organizationMember", { id: "tgt-mem-owner", organizationId: TARGET_ORG, userId: "user-target", role: "OWNER" });
  return db;
}

// ── The archive ─────────────────────────────────────────────────────────────

describe("programme export: the archive", () => {
  let db: MemoryDb;
  beforeEach(() => {
    db = setup();
  });

  it("holds programme.json, one CSV per register, the schema, README, LEEME and a manifest", async () => {
    const { names, text } = await exportOrg(db, SOURCE_ORG);
    expect(names).toEqual(
      expect.arrayContaining([
        "programme.json",
        "csv/systems.csv",
        "csv/data-elements.csv",
        "csv/processing-activities.csv",
        "csv/data-flows.csv",
        "csv/transfers.csv",
        "csv/vendors.csv",
        "csv/vendor-contracts.csv",
        "csv/assessments.csv",
        "csv/incidents.csv",
        "csv/ai-systems.csv",
        "csv/audit-trail.csv",
        "schema/programme.schema.json",
        "schema/README.md",
        "schema/LEEME.md",
        "manifest.json",
      ]),
    );
    expect(names[names.length - 1]).toBe("manifest.json");
    const manifest = JSON.parse(text("manifest.json")!);
    expect(manifest.format).toBe(PROGRAMME_FORMAT);
    expect(manifest.counts.dataAssets).toBe(3);
    // Every listed digest is the file's own.
    const { createHash } = await import("crypto");
    for (const f of manifest.files as Array<{ path: string; sha256: string; bytes: number }>) {
      const data = Buffer.from(text(f.path)!, "utf8");
      expect(data.length).toBe(f.bytes);
      expect(createHash("sha256").update(data).digest("hex")).toBe(f.sha256);
    }
  });

  it("writes stable ids and explicit references, never positions", async () => {
    const { programme } = await exportOrg(db, SOURCE_ORG);
    expect(programme.format).toBe(PROGRAMME_FORMAT);
    expect(programme.dataElements[0]!.dataAssetId).toBe("src-asset-00000");
    expect(programme.processingActivities[0]!.assets[0]).toMatchObject({ dataAssetId: "src-asset-00000", dataElementIds: ["src-el-00000"] });
    expect(programme.dataTransfers[0]).toMatchObject({ processingActivityId: "src-act-00000", jurisdictionCode: "GDPR" });
    expect(programme.assessments.find((a) => a.id === "src-asm-2")).toMatchObject({ templateId: "src-tpl-own", vendorId: "src-ven-00000", dataTransferId: "src-tr-1" });
    expect(programme.aiSystems[0]).toMatchObject({ vendorId: "src-ven-00000", assessmentId: "src-asm-1" });
    expect(programme.businessUnits.find((u) => u.id === "src-bu-child")?.parentId).toBe("src-bu-root");
    expect(programme.businessUnits.find((u) => u.id === "src-bu-root")?.ownerPersonId).toBe("user-owner");
    expect(programme.people).toEqual([{ id: "user-owner", name: "Owner Person", email: "owner@example.test", role: "OWNER" }]);
    // The confirmation states, with who and when.
    const [a0, a1, a2] = programme.dataAssets;
    expect(a0!.confirmation).toMatchObject({ state: "confirmed", origin: "entered", confirmedByPersonId: "user-owner", confirmedAt: "2026-09-01T10:00:00.000Z" });
    expect(a1!.confirmation).toMatchObject({ state: "draft", origin: "template", sourceRef: "quickstart" });
    expect(a2!.confirmation).toMatchObject({ state: "confirmed", origin: "entered" });
    // Built-in templates travel by name and version; the organisation's own in full.
    expect(programme.assessmentTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tpl-system-dpia", origin: "system", name: "DPIA (system)", version: "2.0" }),
        expect.objectContaining({ id: "src-tpl-own", origin: "organization", sections: [{ id: "s1", questions: [{ id: "q1" }] }] }),
      ]),
    );
    expect(programme.incidents[0]!.timeline).toHaveLength(2);
    expect(programme.documents).toEqual([{ id: "ropa", state: "draft", gaps: ["toConfirm=1"], input: null }]);
  });

  it("never carries another organisation's records, secrets, sessions, or the audit detail", async () => {
    const { bytes, zip } = await exportOrg(db, SOURCE_ORG);
    const everything = zip
      .getEntries()
      .map((e) => e.getData().toString("utf8"))
      .join("\n");
    expect(bytes.length).toBeGreaterThan(0);
    expect(everything).not.toMatch(/oth-/);
    expect(everything).not.toContain("Org oth");
    expect(everything).not.toContain("SECRET-PORTAL-TOKEN");
    expect(everything).not.toContain("SECRET-OAUTH-TOKEN");
    expect(everything).not.toContain("SECRET-SESSION-TOKEN");
    expect(everything).not.toContain("SECRET-CHANGE-DETAIL");
    expect(everything).not.toContain("203.0.113.9");
    expect(everything).not.toContain("ais-secret-link");
    // The source queried only its own organisation's rows.
    const orgScoped = db.calls.filter((c) => c.op === "findMany" && (c.args as { where?: Rec }).where?.organizationId);
    expect(orgScoped.every((c) => (c.args as { where: Rec }).where.organizationId === SOURCE_ORG)).toBe(true);
  });

  it("leaves rights requests out unless both flags are given, and says so in the file", async () => {
    const without = await exportOrg(db, SOURCE_ORG);
    expect(without.programme.contents.rightsRequests).toBe(false);
    expect(without.programme.rightsRequests).toEqual([]);
    expect(without.names).not.toContain("csv/rights-requests.csv");
    const all = without.zip.getEntries().map((e) => e.getData().toString("utf8")).join("\n");
    expect(all).not.toContain(REQUESTER_EMAIL);
    // The trail entry about the request keeps its reference, never its detail.
    expect(without.programme.auditTrail.find((e) => e.entityType === "DSARRequest")).toEqual({
      id: "src-log-2",
      at: expect.any(String),
      action: "CREATE",
      entityType: "DSARRequest",
      entityId: "src-REQ-1",
      actorPersonId: "user-owner",
    });
    // Forms hold no personal data and always travel.
    expect(without.programme.rightsRequestForms).toHaveLength(1);

    const withRequests = await exportOrg(db, SOURCE_ORG, { includeRightsRequests: true });
    expect(withRequests.programme.contents.rightsRequests).toBe(true);
    expect(withRequests.programme.rightsRequests[0]).toMatchObject({ requesterEmail: REQUESTER_EMAIL, reference: "src-REQ-1" });
    expect(withRequests.names).toContain("csv/rights-requests.csv");
    // The copy of data sent to the requester is not part of the record.
    expect(withRequests.text("programme.json")).not.toContain('"secret": "copy"');

    const moduleOff = await exportOrg(db, SOURCE_ORG, { includeRightsRequests: true, dsarModuleOn: false });
    expect(moduleOff.programme.rightsRequests).toEqual([]);
    expect(moduleOff.programme.rightsRequestForms).toEqual([]);
    expect(moduleOff.programme.auditTrail.some((e) => e.entityType === "DSARRequest")).toBe(false);
  });

  it("writes CSV for Excel: byte-order mark, headers in the reader's language, words for codes, guarded formulas", async () => {
    const en = await exportOrg(db, SOURCE_ORG);
    const es = await exportOrg(db, SOURCE_ORG, { locale: "es" });
    const enCsv = en.zip.getEntry("csv/processing-activities.csv")!.getData().toString("utf8");
    const esCsv = es.zip.getEntry("csv/processing-activities.csv")!.getData().toString("utf8");
    expect(enCsv.startsWith("﻿Id,Name,Description,Purpose,Legal basis")).toBe(true);
    expect(esCsv.startsWith("﻿Id,Nombre,Descripción,Finalidad,Base jurídica")).toBe(true);
    expect(enCsv).toContain("Legitimate interests");
    expect(esCsv).toContain("Interés legítimo");
    expect(esCsv).toContain("Identificadores");
    expect(enCsv).toContain("\r\n");
    const systems = en.zip.getEntry("csv/systems.csv")!.getData().toString("utf8");
    expect(systems).toContain("'=SUM(A1:A2) looks like a formula");
    // programme.json keeps the value as it was.
    expect(en.programme.dataAssets[0]!.description).toBe("=SUM(A1:A2) looks like a formula");
  });
});

// ── The schema and its explanations ─────────────────────────────────────────

describe("programme format: the JSON Schema and README/LEEME", () => {
  it("is a draft 2020-12 schema that accepts the export and refuses broken files", async () => {
    const db = setup();
    const { text } = await exportOrg(db, SOURCE_ORG, { includeRightsRequests: true });
    const schema = programmeJsonSchema();
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    ajv.addFormat("date-time", true);
    const validate = ajv.compile(schema);
    const doc = JSON.parse(text("programme.json")!);
    expect(validate(doc), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);

    expect(validate({ ...doc, format: undefined })).toBe(false);
    const badEnum = structuredClone(doc);
    badEnum.dataAssets[0].type = "SPACESHIP";
    expect(validate(badEnum)).toBe(false);
    const badRef = structuredClone(doc);
    badRef.dataElements[0].dataAssetId = 42;
    expect(validate(badRef)).toBe(false);

    // The zod validator used by the import agrees.
    expect(validateProgramme(doc).ok).toBe(true);
    expect(validateProgramme(badEnum).ok).toBe(false);
  });

  it("reads any 1.x file and ignores unknown fields; refuses another major version", () => {
    const db = setup();
    return exportOrg(db, SOURCE_ORG).then(({ programme }) => {
      const later = { ...programme, format: "dpocentral-programme/1.7", futureField: { x: 1 } };
      expect(validateProgramme(later).ok).toBe(true);
      const v2 = validateProgramme({ ...programme, format: "dpocentral-programme/2.0" });
      expect(v2.ok).toBe(false);
      expect(!v2.ok && v2.problems[0]!.message).toMatch(/Unsupported format/);
      expect(validateProgramme({ hello: "world" }).ok).toBe(false);
    });
  });

  it("explains every field in English and in Spanish", () => {
    const schema = programmeJsonSchema();
    const missing: string[] = [];
    const walk = (node: Rec, path: string) => {
      const props = (node.properties ?? {}) as Record<string, Rec>;
      for (const [name, raw] of Object.entries(props)) {
        const field = raw.anyOf ? { ...((raw.anyOf as Rec[]).find((n) => n.type !== "null") ?? {}), ...raw } : raw;
        if (!field.description) missing.push(`${path}.${name} (en)`);
        if (!field["x-description-es"]) missing.push(`${path}.${name} (es)`);
        const item = field.type === "array" ? (field.items as Rec) : field;
        if (item?.properties) walk(item, `${path}.${name}`);
      }
    };
    walk(schema, "programme");
    expect(missing).toEqual([]);

    const readme = programmeReadme("en", { rightsRequests: false });
    const leeme = programmeReadme("es", { rightsRequests: false });
    for (const key of ["dataAssets", "processingActivities", "vendors", "assessments", "incidents", "auditTrail", "confirmation"]) {
      expect(readme).toContain(`\`${key}\``);
      expect(leeme).toContain(`\`${key}\``);
    }
    expect(readme).toContain("How records refer to each other");
    expect(leeme).toContain("Cómo se relacionan los registros");
    // Castilian, "tú", no long dash.
    expect(leeme).not.toMatch(/\busted(es)?\b/i);
    expect(leeme).not.toMatch(/\bretenci[oó]n/i);
    expect(readme + leeme).not.toContain("—");
  });

  it("keeps its fixed lists equal to the database's own", () => {
    const fromPrisma = PrismaEnums as unknown as Record<string, Record<string, string> | undefined>;
    for (const [name, values] of Object.entries(ENUMS)) {
      expect(Object.values(fromPrisma[name] ?? {}), name).toEqual([...values]);
    }
  });
});

// ── The import ──────────────────────────────────────────────────────────────

describe("programme import", () => {
  let db: MemoryDb;
  let source: ProgrammeDoc;
  beforeEach(async () => {
    db = setup();
    source = (await exportOrg(db, SOURCE_ORG, { includeRightsRequests: true })).programme;
  });

  it("round trip: export, import into an empty organisation, export again: the same records, as drafts, with the same references", async () => {
    const result = await applyImport(db as unknown as Db, source, importOpts({ includeRightsRequests: true }));
    expect(result.summary.canImport).toBe(true);
    expect(result.created).toBeGreaterThan(10);

    const again = (await exportOrg(db, TARGET_ORG, { includeRightsRequests: true })).programme;

    // The explicit mapping, written with the import: new id → source id.
    const records = db.table("programmeImportRecord") as Array<{ localId: string; sourceKey: string; organizationId: string }>;
    expect(records.every((r) => r.organizationId === TARGET_ORG)).toBe(true);
    const idMap = idMapFrom(records);
    idMap.set("user-target", "user-owner"); // matched by e-mail address
    const unmatched = new Set(["user-gone"]); // not a member here: left empty

    for (const key of ROUND_TRIP_REGISTERS) {
      const before = strip(canonical(source[key], new Map(), unmatched)) as Rec[];
      const after = strip(canonical(again[key], idMap, unmatched)) as Rec[];
      expect(byId(after), key).toEqual(byId(before));
    }

    // Assessments: the same answers and references; Draft here, the source status kept as history.
    const sourceAsm = strip(canonical(source.assessments, new Map(), unmatched)) as Rec[];
    const targetAsm = strip(canonical(again.assessments, idMap, unmatched)) as Rec[];
    const pick = (a: Rec) => ({ id: a.id, templateId: a.templateId, name: a.name, processingActivityId: a.processingActivityId, vendorId: a.vendorId, dataTransferId: a.dataTransferId, responses: a.responses, mitigations: a.mitigations });
    expect(targetAsm.map(pick).sort((x, y) => String(x.id).localeCompare(String(y.id)))).toEqual(
      sourceAsm.map(pick).sort((x, y) => String(x.id).localeCompare(String(y.id))),
    );
    expect(again.assessments.every((a) => a.status === "DRAFT")).toBe(true);
    const dpia = again.assessments.find((a) => a.name === "DPIA of activity 0")!;
    expect((dpia.metadata as Rec).programmeImport).toMatchObject({ sourceId: "src-asm-1", original: { status: "APPROVED", approvals: [expect.objectContaining({ status: "APPROVED", approverPersonId: "user-owner" })] } });
    expect(dpia.templateId).toBe("tpl-system-dpia");

    // AI systems: references kept, Draft here.
    const ai = again.aiSystems[0]!;
    expect(canonical(ai.vendorId, idMap, unmatched)).toBe("src-ven-00000");
    expect(canonical(ai.assessmentId, idMap, unmatched)).toBe("src-asm-1");
    expect(ai.status).toBe("DRAFT");

    // Systems, activities and vendors are drafts to confirm, marked as imported.
    for (const table of ["dataAsset", "processingActivity", "vendor"]) {
      const rows = db.table(table).filter((r) => r.organizationId === TARGET_ORG);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.provenance === "IMPORTED" && r.confirmedAt === null && isDraftRecord(r as never))).toBe(true);
    }
    expect(again.dataAssets.every((a) => a.confirmation?.state === "draft" && a.confirmation.origin === "imported")).toBe(true);
    // The source confirmation is kept as history.
    const a0 = db.table("dataAsset").find((r) => r.organizationId === TARGET_ORG && r.name === "System 0")!;
    expect((a0.metadata as Rec).programmeImport).toMatchObject({ original: { confirmation: { state: "confirmed", confirmedByPersonId: "user-owner" } } });
    // The laws.
    expect(again.jurisdictions.map((j) => j.jurisdictionCode)).toEqual(["GDPR"]);
    // Never a secret: the portal token stays behind.
    expect(db.table("vendorQuestionnaireResponse").filter((r) => r.token).every((r) => String(r.token).startsWith("SECRET-PORTAL-TOKEN-src") || String(r.token).startsWith("SECRET-PORTAL-TOKEN-oth"))).toBe(true);
    // One audit entry, counts only.
    const audit = db.table("auditLog").filter((r) => r.organizationId === TARGET_ORG);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "IMPORT_PROGRAMME", userId: "user-target", entityType: "Organization" });
    expect(JSON.stringify(audit[0]!.changes)).not.toContain("Vendor 0");
  });

  it("the dry run counts every register and writes nothing", async () => {
    const snapshot = () => JSON.stringify([...db.tables].filter(([, rows]) => rows.length > 0));
    const before = snapshot();
    const summary = await planImport(db as unknown as Db, source, importOpts());
    expect(snapshot()).toBe(before);
    expect(summary.canImport).toBe(true);
    expect(summary.registers.dataAsset).toEqual({ inFile: 3, toCreate: 3, alreadyImported: 0, leftOut: 0 });
    expect(summary.registers.vendor).toEqual({ inFile: 2, toCreate: 2, alreadyImported: 0, leftOut: 0 });
    expect(summary.rows.vendorContract).toBe(2);
    expect(summary.people).toEqual({ inFile: 1, matched: 1 });
    // Without the box, rights requests are held back and the dry run says so.
    expect(summary.rightsRequests).toEqual({ inFile: 1, included: false });
    expect(summary.problems.map((p) => p.code)).toContain("rights_requests_held_back");
    expect(summary.problems.every((p) => p.en && p.es)).toBe(true);
  });

  it("brings rights requests in only with the box ticked", async () => {
    await applyImport(db as unknown as Db, source, importOpts());
    expect(db.table("dSARRequest").filter((r) => r.organizationId === TARGET_ORG)).toHaveLength(0);
    await applyImport(db as unknown as Db, source, importOpts({ includeRightsRequests: true }));
    const requests = db.table("dSARRequest").filter((r) => r.organizationId === TARGET_ORG);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.requesterEmail).toBe(REQUESTER_EMAIL);
    expect(requests[0]!.publicId).not.toBe("src-REQ-1");
  });

  it("is idempotent by source id: a second run creates nothing", async () => {
    const first = await applyImport(db as unknown as Db, source, importOpts());
    const count = (t: string) => db.table(t).filter((r) => r.organizationId === TARGET_ORG).length;
    const assets = count("dataAsset");
    const second = await applyImport(db as unknown as Db, source, importOpts());
    expect(first.created).toBeGreaterThan(0);
    expect(second.created).toBe(0);
    expect(count("dataAsset")).toBe(assets);
    expect(second.summary.registers.dataAsset).toMatchObject({ toCreate: 0, alreadyImported: 3 });
    expect(db.table("vendorContract").filter((r) => db.table("vendor").find((v) => v.id === r.vendorId)?.organizationId === TARGET_ORG)).toHaveLength(2);
  });

  it("refuses an organisation that holds records of its own, and writes nothing", async () => {
    db.insert("vendor", { id: "tgt-own-vendor", organizationId: TARGET_ORG, name: "Ours", provenance: "USER_ENTERED" });
    const summary = await planImport(db as unknown as Db, source, importOpts());
    expect(summary.canImport).toBe(false);
    expect(summary.problems[0]).toMatchObject({ level: "error", code: "not_empty" });
    const before = db.table("dataAsset").length;
    await expect(applyImport(db as unknown as Db, source, importOpts())).rejects.toBeInstanceOf(ImportRefusedError);
    expect(db.table("dataAsset").length).toBe(before);
    expect(db.table("programmeImportRecord")).toHaveLength(0);
  });

  it("drops a dangling reference and says so", async () => {
    const broken = structuredClone(source);
    broken.dataElements[0]!.dataAssetId = "not-in-the-file";
    broken.dataTransfers[0]!.processingActivityId = "not-in-the-file";
    const summary = await planImport(db as unknown as Db, broken, importOpts());
    expect(summary.registers.dataElement).toMatchObject({ leftOut: 1 });
    expect(summary.problems.filter((p) => p.code === "missing_reference").map((p) => p.register)).toEqual(
      expect.arrayContaining(["dataElements", "dataTransfers"]),
    );
  });

  it("leaves assessments out when their template is not installed, and allows a later run once it is", async () => {
    db.table("assessmentTemplate").splice(db.table("assessmentTemplate").findIndex((t) => t.id === "tpl-system-dpia"), 1);
    db.insert("assessmentTemplate", { id: "tpl-other", organizationId: null, type: "TIA", name: "TIA", version: "1", sections: [], isSystem: true, isActive: true, supersededAt: null });
    const summary = await planImport(db as unknown as Db, source, importOpts());
    expect(summary.problems.map((p) => p.code)).toContain("template_missing");
    expect(summary.registers.assessment).toMatchObject({ inFile: 2, toCreate: 1, leftOut: 1 });
  });

  it("reads the export ZIP and programme.json alike, and refuses what is not a programme", async () => {
    const { bytes, text } = await exportOrg(db, SOURCE_ORG);
    const fromZip = readProgrammeUpload(new Uint8Array(bytes));
    const fromJson = readProgrammeUpload(new TextEncoder().encode(text("programme.json")!));
    expect(fromZip.ok && fromJson.ok).toBe(true);
    expect(fromZip.ok && fromZip.programme.dataAssets.length).toBe(3);
    const notJson = readProgrammeUpload(new TextEncoder().encode("hello"));
    expect(notJson.ok).toBe(false);
    const zip = new AdmZip();
    zip.addFile("other.txt", Buffer.from("x"));
    const noProgramme = readProgrammeUpload(new Uint8Array(zip.toBuffer()));
    expect(!noProgramme.ok && noProgramme.problems[0]!.message).toMatch(/no programme\.json/);
  });
});

// ── Permissions ─────────────────────────────────────────────────────────────

describe("programme portability: who may", () => {
  it("is for owners and admins only", () => {
    expect(canExportProgramme("OWNER")).toBe(true);
    expect(canExportProgramme("ADMIN")).toBe(true);
    for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER", "", null, undefined]) {
      expect(canExportProgramme(role)).toBe(false);
    }
  });
});

// ── A large organisation ────────────────────────────────────────────────────

describe("programme export: a large organisation streams", () => {
  it("reads a page at a time and writes the archive in many small pieces", async () => {
    const db = memoryDb();
    seedGlobals(db);
    seedProgramme(db, SOURCE_ORG, { prefix: "big", scale: 1500 }); // 4,500 systems and elements, 3,000 activities and vendors
    const pageSize = 250;
    const result = await collect(programmeArchive(db as unknown as Db, exportOpts(SOURCE_ORG, { pageSize })));
    // No query asked for more than one page.
    const pages = db.calls.filter((c) => c.op === "findMany" && typeof (c.args as { take?: number }).take === "number");
    expect(pages.length).toBeGreaterThan(50);
    expect(pages.every((c) => (c.args as { take: number }).take <= pageSize)).toBe(true);
    // Streamed: many pieces, none of them the whole file.
    expect(result.chunks).toBeGreaterThan(100);
    expect(result.maxChunk).toBeLessThan(result.bytes.length / 4);
    const zip = new AdmZip(result.bytes);
    const programme = JSON.parse(zip.getEntry("programme.json")!.getData().toString("utf8")) as ProgrammeDoc;
    expect(programme.dataAssets).toHaveLength(4500);
    expect(programme.dataElements).toHaveLength(4500);
    expect(programme.processingActivities).toHaveLength(3000);
    expect(programme.vendors).toHaveLength(3000);
    expect(validateProgramme(programme).ok).toBe(true);
    const csvLines = zip.getEntry("csv/systems.csv")!.getData().toString("utf8").trim().split("\r\n");
    expect(csvLines).toHaveLength(4501);
    // And it comes back in.
    db.insert("organization", { id: TARGET_ORG, name: "Target", slug: "target" });
    db.insert("organizationMember", { id: "tgt-mem-owner", organizationId: TARGET_ORG, userId: "user-target", role: "OWNER" });
    const imported = await applyImport(db as unknown as Db, programme, importOpts());
    expect(imported.summary.registers.dataAsset?.toCreate).toBe(4500);
    expect(db.table("dataAsset").filter((r) => r.organizationId === TARGET_ORG)).toHaveLength(4500);
  }, 120_000);
});
