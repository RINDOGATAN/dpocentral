// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The register import beyond CSV: Excel workbooks (first sheet), empty
 * templates per register in the reader's language, and vendor names matched
 * against the vendor catalogue (linked when matched, kept with a note when not).
 */

import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import {
  catalogueIndex,
  csvImporter,
  importerFor,
  matchCatalogue,
  MAX_XLSX_UNPACKED_BYTES,
  needsCatalogue,
  suggestMapping,
  tableToProgramme,
  UnreadableFileError,
  xlsxImporter,
} from "@/server/services/portability/csv-import";
import { csvTemplate, templateHeaders, xlsxTemplate } from "@/server/services/portability/register-template";

const enc = (s: string) => new TextEncoder().encode(s);

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * A small workbook as spreadsheet programs save it: shared strings, numbers,
 * a boolean and a date (a number styled with the built-in date format 14).
 * Cells: string (shared), number, boolean, or { date: serial }.
 */
function workbook(rows: Array<Array<string | number | boolean | { date: number } | null>>, sheets = 1): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = (text: string) => {
    let i = shared.indexOf(text);
    if (i < 0) i = shared.push(text) - 1;
    return i;
  };
  const col = (i: number) => String.fromCharCode(65 + i);
  const sheetXml = (data: typeof rows) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    data
      .map(
        (row, r) =>
          `<row r="${r + 1}">` +
          row
            .map((v, c) => {
              const ref = `${col(c)}${r + 1}`;
              if (v === null) return "";
              if (typeof v === "string") return `<c r="${ref}" t="s"><v>${sharedIndex(v)}</v></c>`;
              if (typeof v === "boolean") return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
              if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
              return `<c r="${ref}" s="1"><v>${v.date}</v></c>`;
            })
            .join("") +
          `</row>`,
      )
      .join("") +
    `</sheetData></worksheet>`;

  const sheetBodies = [sheetXml(rows), ...Array.from({ length: sheets - 1 }, () => sheetXml([["Other sheet"], ["Ignored"]]))];
  const zip = new AdmZip();
  const add = (name: string, body: string) => zip.addFile(name, Buffer.from(body, "utf8"));
  add(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      sheetBodies.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`,
  );
  add(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  add(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
      sheetBodies.map((_, i) => `<sheet name="Sheet${i + 1}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheetBodies.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
      `<Relationship Id="rT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  );
  add(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>`,
  );
  sheetBodies.forEach((body, i) => add(`xl/worksheets/sheet${i + 1}.xml`, body));
  add(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("") +
      `</sst>`,
  );
  return new Uint8Array(zip.toBuffer());
}

describe("Excel import (.xlsx, first sheet)", () => {
  it("reads strings, numbers, booleans and dates of the first sheet as text", async () => {
    const bytes = workbook(
      [
        ["Nombre", "Finalidad", "Base jurídica", "Se conserva (días)", "En uso", "Revisada"],
        ["Nóminas", "Pagar a la plantilla", "Art. 6.1.b RGPD", 365, true, { date: 46023 }],
        [null, null, null, null, null, null],
        ["Marketing", "Boletín", "Consentimiento", 30, false, null],
      ],
      2,
    );
    expect(importerFor("ropa.xlsx", bytes)?.id).toBe("xlsx");
    const table = await xlsxImporter.read(bytes);
    expect(table.headers).toEqual(["Nombre", "Finalidad", "Base jurídica", "Se conserva (días)", "En uso", "Revisada"]);
    expect(table.rows[0]).toEqual(["Nóminas", "Pagar a la plantilla", "Art. 6.1.b RGPD", "365", "yes", "2026-01-01"]);
    // The empty row is skipped; the second sheet is not read.
    expect(table.rows).toHaveLength(2);
    expect(JSON.stringify(table)).not.toContain("Ignored");

    const conv = tableToProgramme("processingActivities", table, suggestMapping("processingActivities", table.headers));
    expect(conv.programme.processingActivities[0]).toMatchObject({ name: "Nóminas", legalBasis: "CONTRACT", retentionDays: 365, isActive: true });
    expect(conv.programme.processingActivities[1]).toMatchObject({ name: "Marketing", legalBasis: "CONSENT", isActive: false });
  });

  it("refuses a damaged workbook and one that would unpack beyond the limit, before reading it", async () => {
    const damaged = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    await expect(xlsxImporter.read(damaged)).rejects.toBeInstanceOf(UnreadableFileError);

    const zip = new AdmZip();
    zip.addFile("xl/worksheets/sheet1.xml", Buffer.alloc(MAX_XLSX_UNPACKED_BYTES + 1, 0x20));
    const bomb = new Uint8Array(zip.toBuffer());
    expect(bomb.length).toBeLessThan(1024 * 1024);
    const err = await Promise.resolve(xlsxImporter.read(bomb)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnreadableFileError);
    expect((err as UnreadableFileError).es).toMatch(/una vez descomprimido/);
  });
});

describe("Templates per register", () => {
  it("lists the fields the import reads, in the reader's language, required fields first, without Id", () => {
    expect(templateHeaders("processingActivities", "en").slice(0, 2)).toEqual(["Name", "Legal basis"]);
    expect(templateHeaders("processingActivities", "es")).toContain("Proveedores o sistemas");
    expect(templateHeaders("vendors", "en")).not.toContain("Id");
  });

  it("round-trips: every header of the CSV and Excel templates is matched by the import", async () => {
    for (const register of ["processingActivities", "dataAssets", "vendors"] as const) {
      for (const locale of ["en", "es"] as const) {
        const csv = csvImporter.read(enc(csvTemplate(register, locale)));
        expect(csv.headers).toEqual(templateHeaders(register, locale));
        expect(suggestMapping(register, csv.headers)).not.toContain(null);

        const xlsx = await xlsxImporter.read(new Uint8Array(xlsxTemplate(register, locale)));
        expect(xlsx.headers).toEqual(templateHeaders(register, locale));
        expect(xlsx.rows).toEqual([]);
      }
    }
    // Spanish spreadsheets expect semicolons; the byte-order mark keeps the accents.
    expect(csvTemplate("vendors", "es").startsWith("﻿Nombre;")).toBe(true);
  });
});

describe("Vendor names against the catalogue", () => {
  const index = catalogueIndex([
    { slug: "slack", name: "Slack" },
    { slug: "google-workspace", name: "Google Workspace" },
    { slug: "acme-one", name: "Acme" },
    { slug: "acme-two", name: "ACME" },
  ]);

  it("matches exactly after normalising case, accents and punctuation, by name or slug", () => {
    expect(matchCatalogue(index, "  SLACK ")).toEqual({ status: "matched", entry: { slug: "slack", name: "Slack" } });
    expect(matchCatalogue(index, "google-workspace")).toMatchObject({ status: "matched" });
    expect(matchCatalogue(index, "Google Workspace (mail)")).toEqual({ status: "none" });
    // Two entries with the same name: not linked to either.
    expect(matchCatalogue(index, "acme")).toEqual({ status: "ambiguous" });
  });

  it("links the vendors register by metadata.catalogSlug and notes the names it cannot link", () => {
    const table = csvImporter.read(enc("Supplier;Website\nSlack;https://slack.example\nTiny local firm;\nAcme;\n"));
    const mapping = suggestMapping("vendors", table.headers);
    expect(needsCatalogue("vendors", mapping)).toBe(true);
    const conv = tableToProgramme("vendors", table, mapping, new Date(), index);
    const [slack, tiny, acme] = conv.programme.vendors;
    expect(slack!.metadata).toMatchObject({ csvImport: true, catalogSlug: "slack" });
    expect(tiny!.metadata).not.toHaveProperty("catalogSlug");
    expect(acme!.metadata).not.toHaveProperty("catalogSlug");
    expect(conv.catalogueLinks).toBe(1);
    expect(conv.notes.map((n) => n.row)).toEqual([3, 4]);
    expect(conv.notes[0]!.en).toMatch(/not in the vendor catalogue: kept as written/);
    expect(conv.notes[1]!.es).toMatch(/más de un proveedor/);
    // Notes do not leave rows out.
    expect(conv.leftOut).toBe(0);
  });

  it("keeps the vendors or systems of a processing activity in its metadata, linked where matched", () => {
    const table = csvImporter.read(enc("Name,Legal basis,Vendors\nSupport,Contract,Slack; In-house ticketing\n"));
    const mapping = suggestMapping("processingActivities", table.headers);
    expect(mapping).toEqual(["name", "legalBasis", "vendorNames"]);
    const conv = tableToProgramme("processingActivities", table, mapping, new Date(), index);
    const activity = conv.programme.processingActivities[0]!;
    expect(activity.metadata).toMatchObject({
      vendors: [
        { name: "Slack", catalogSlug: "slack" },
        { name: "In-house ticketing", catalogSlug: null },
      ],
    });
    expect(activity).not.toHaveProperty("vendorNames");
    expect(conv.notes).toHaveLength(1);
  });

  it("links the provider of a system, and needs no catalogue when no vendor column is matched", () => {
    const table = csvImporter.read(enc("System,Vendor\nChat,Slack\n"));
    const conv = tableToProgramme("dataAssets", table, ["name", "vendor"], new Date(), index);
    expect(conv.programme.dataAssets[0]!.metadata).toMatchObject({ vendorCatalogSlug: "slack" });
    expect(needsCatalogue("dataAssets", ["name", null])).toBe(false);
    expect(needsCatalogue("processingActivities", ["name", "legalBasis"])).toBe(false);
  });
});
