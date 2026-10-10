// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The CSV bridge (src/server/services/portability/csv-import.ts): columns
 * matched by header in English or Spanish, words read back into codes, a dry
 * run, then drafts; the same file twice creates nothing new.
 */

import { describe, it, expect } from "vitest";
import { memoryDb } from "./helpers/memory-db";
import { seedGlobals, TARGET_ORG } from "./helpers/programme-fixture";
import {
  csvImporter,
  IMPORTERS,
  importerFor,
  parseCsv,
  suggestMapping,
  tableToProgramme,
  decodeText,
} from "@/server/services/portability/csv-import";
import { applyImport, planImport, type ImportOptions } from "@/server/services/portability/import";
import type { Db } from "@/lib/prisma";

const enc = (s: string) => new TextEncoder().encode(s);

function target() {
  const db = memoryDb();
  seedGlobals(db);
  db.insert("organization", { id: TARGET_ORG, name: "Target", slug: "target" });
  db.insert("organizationMember", { id: "m1", organizationId: TARGET_ORG, userId: "user-target", role: "ADMIN" });
  // A register import adds to an organisation that already has records.
  db.insert("vendor", { id: "existing", organizationId: TARGET_ORG, name: "Existing", provenance: "USER_ENTERED" });
  return db;
}

const opts: ImportOptions = {
  organizationId: TARGET_ORG,
  userId: "user-target",
  includeRightsRequests: false,
  dsarModuleOn: true,
  requireEmpty: false,
  mode: "register",
};

describe("CSV import: reading the file", () => {
  it("reads comma, semicolon and tab files, quotes, line breaks, a byte-order mark and Windows-1252", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
    expect(parseCsv("a;b\n1;2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv('a,b\n"line\nbreak",2')).toEqual([["a", "b"], ["line\nbreak", "2"]]);
    const t = csvImporter.read(enc("﻿# exported by some tool\nNombre;Finalidad\nNóminas;Pagar\n"));
    expect(t).toEqual({ headers: ["Nombre", "Finalidad"], rows: [["Nóminas", "Pagar"]] });
    // "Nóminas" saved by an older spreadsheet as Windows-1252.
    expect(decodeText(new Uint8Array([0x4e, 0xf3, 0x6d, 0x69, 0x6e, 0x61, 0x73]))).toBe("Nóminas");
  });

  it("has CSV as its one importer for now (the extension point for other formats)", () => {
    expect(IMPORTERS.map((i) => i.id)).toEqual(["csv"]);
    expect(importerFor("ropa.csv", enc(""))?.id).toBe("csv");
    expect(importerFor("export.xml", enc("<xml/>"))).toBeNull();
  });
});

describe("CSV import: matching columns", () => {
  it("matches English and Spanish headers, without case or accents, and common synonyms", () => {
    expect(suggestMapping("processingActivities", ["Name", "Purpose", "Legal basis", "Data subjects", "Retention period", "Whatever"])).toEqual([
      "name",
      "purpose",
      "legalBasis",
      "dataSubjects",
      "retentionPeriod",
      null,
    ]);
    expect(suggestMapping("processingActivities", ["NOMBRE DE LA ACTIVIDAD", "finalidad", "Base de legitimación", "Categorías de interesados", "Plazo de conservación"])).toEqual([
      "name",
      "purpose",
      "legalBasis",
      "dataSubjects",
      "retentionPeriod",
    ]);
    expect(suggestMapping("vendors", ["Supplier", "E-mail", "Criticality", "Países"])).toEqual(["name", "contactEmail", "riskTier", "countries"]);
    expect(suggestMapping("dataAssets", ["Sistema", "Tipo", "Ubicación", "ID"])).toEqual(["name", "type", "location", "id"]);
  });

  it("matches a field once: a second column naming it is left for the person to choose", () => {
    expect(suggestMapping("vendors", ["Name", "Vendor name"])).toEqual(["name", null]);
  });
});

describe("CSV import: rows into drafts", () => {
  const csv = [
    "Nombre;Finalidad;Base jurídica;Interesados;Categorías de datos;Decisiones automatizadas",
    'Nóminas;Pagar a la plantilla;Art. 6.1.b RGPD;Empleados;"Identificadores; Financieros";No',
    "Marketing;Boletín;Interés legítimo;Clientes|Leads;Identificadores;sí",
    "Sin base;Algo;;Clientes;;",
    "'=Fórmula;Prueba;Consentimiento;;Desconocida;",
  ].join("\r\n");

  it("reads words in either language back into codes, and leaves out a row without a legal basis", () => {
    const table = csvImporter.read(enc(csv));
    const mapping = suggestMapping("processingActivities", table.headers);
    const { programme, rows, leftOut, problems } = tableToProgramme("processingActivities", table, mapping);
    expect(rows).toBe(4);
    expect(leftOut).toBe(1);
    expect(programme.processingActivities).toHaveLength(3);
    const [payroll, marketing, formula] = programme.processingActivities;
    expect(payroll).toMatchObject({ name: "Nóminas", purpose: "Pagar a la plantilla", legalBasis: "CONTRACT", dataSubjects: ["Empleados"], categories: ["IDENTIFIERS", "FINANCIAL"], automatedDecisionMaking: false });
    expect(marketing).toMatchObject({ legalBasis: "LEGITIMATE_INTERESTS", dataSubjects: ["Clientes", "Leads"], automatedDecisionMaking: true });
    // The apostrophe that guards a formula is removed; an unknown category is reported, not guessed.
    expect(formula).toMatchObject({ name: "=Fórmula", legalBasis: "CONSENT", categories: [] });
    expect(problems.find((p) => p.row === 4)?.es).toMatch(/Fila no importada/);
    expect(problems.find((p) => p.row === 5 && p.field === "categories")?.en).toMatch(/Desconocida/);
  });

  it("shows a dry run, imports as drafts, and creates nothing the second time", async () => {
    const db = target();
    const table = csvImporter.read(enc(csv));
    const conversion = tableToProgramme("processingActivities", table, suggestMapping("processingActivities", table.headers));
    const summary = await planImport(db as unknown as Db, conversion.programme, opts);
    expect(summary.canImport).toBe(true);
    expect(summary.registers.processingActivity).toEqual({ inFile: 3, toCreate: 3, alreadyImported: 0, leftOut: 0 });
    expect(db.table("processingActivity")).toHaveLength(0);

    const first = await applyImport(db as unknown as Db, conversion.programme, opts);
    expect(first.created).toBe(3);
    const rows = db.table("processingActivity");
    expect(rows.every((r) => r.provenance === "IMPORTED" && r.confirmedAt === null && r.organizationId === TARGET_ORG)).toBe(true);
    expect(db.table("auditLog").at(-1)).toMatchObject({ action: "IMPORT_REGISTER", organizationId: TARGET_ORG });

    const again = tableToProgramme("processingActivities", csvImporter.read(enc(csv)), suggestMapping("processingActivities", table.headers));
    const second = await applyImport(db as unknown as Db, again.programme, opts);
    expect(second.created).toBe(0);
    expect(db.table("processingActivity")).toHaveLength(3);
    // The existing record was never touched.
    expect(db.table("vendor")).toEqual([expect.objectContaining({ id: "existing", name: "Existing" })]);
  });

  it("uses the column the person matched to Id as the source id", async () => {
    const db = target();
    const file = "ID,Supplier,Website\nV-1,Acme,https://acme.example\nV-2,Beta,\n";
    const table = csvImporter.read(enc(file));
    const mapping = suggestMapping("vendors", table.headers);
    expect(mapping).toEqual(["id", "name", "website"]);
    const conv = tableToProgramme("vendors", table, mapping);
    await applyImport(db as unknown as Db, conv.programme, opts);
    // The same ids with changed names: already imported, not overwritten.
    const changed = tableToProgramme("vendors", csvImporter.read(enc("ID,Supplier\nV-1,Acme renamed\nV-3,Gamma\n")), ["id", "name"]);
    const res = await applyImport(db as unknown as Db, changed.programme, opts);
    expect(res.summary.registers.vendor).toMatchObject({ toCreate: 1, alreadyImported: 1 });
    expect(db.table("vendor").map((v) => v.name).sort()).toEqual(["Acme", "Beta", "Existing", "Gamma"]);
  });

  it("lets the person change the match: an unmatched column is not imported", () => {
    const table = csvImporter.read(enc("Nombre,Notas\nCRM,Privado\n"));
    const conv = tableToProgramme("dataAssets", table, ["name", null]);
    expect(conv.programme.dataAssets[0]).toMatchObject({ name: "CRM", type: "OTHER" });
    expect(JSON.stringify(conv.programme)).not.toContain("Privado");
  });
});
