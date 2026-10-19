// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A minimal XLSX writer (Office Open XML, ECMA-376): text cells only, a bold
 * header row that stays in view, a filter on the header, column widths and
 * wrapped text. Enough for a register of one row per record, without adding
 * a spreadsheet library to an application that ships to self-hosters. The
 * archive is written with ./zip.ts.
 *
 * Every value is written as an inline string, so nothing is ever read as a
 * formula, a number or a date by the spreadsheet.
 */

import { createZip } from "./zip";

export interface XlsxSheet {
  /** Shown on the tab: at most 31 characters, none of []:*?/\ */
  name: string;
  rows: string[][];
  /** The first row is a header: bold, frozen and filterable. */
  header?: boolean;
  /** Column widths in characters; otherwise worked out from the content. */
  widths?: number[];
}

export interface XlsxOptions {
  title?: string;
  /** BCP-47 language of the content, for the document properties. */
  language?: string;
}

const esc = (s: string) =>
  s
    // Characters XML 1.0 does not allow.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i++})`;
    base = base.slice(0, 31 - suffix.length);
    candidate = base + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function widthsFor(sheet: XlsxSheet, cols: number): number[] {
  if (sheet.widths) return sheet.widths;
  const out: number[] = [];
  for (let c = 0; c < cols; c++) {
    let max = 8;
    for (const row of sheet.rows) {
      const longestLine = (row[c] ?? "").split("\n").reduce((m, l) => Math.max(m, l.length), 0);
      max = Math.max(max, longestLine);
    }
    out.push(Math.min(60, max + 2));
  }
  return out;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const widths = widthsFor(sheet, cols);
  const lastCol = columnLetter(Math.max(0, cols - 1));
  const rowsXml = sheet.rows
    .map((row, ri) => {
      const style = sheet.header && ri === 0 ? 1 : 2;
      const cells = row
        .map((v, ci) => {
          const ref = `${columnLetter(ci)}${ri + 1}`;
          if (v === "") return `<c r="${ref}" s="${style}"/>`;
          return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const pane = sheet.header
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const colsXml = cols
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const filter = sheet.header && cols && sheet.rows.length > 1
    ? `<autoFilter ref="A1:${lastCol}${sheet.rows.length}"/>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `${pane}<sheetFormatPr defaultRowHeight="15"/>${colsXml}<sheetData>${rowsXml}</sheetData>${filter}` +
    `</worksheet>`
  );
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE7EEF5"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

export function createXlsx(sheets: XlsxSheet[], opts: XlsxOptions = {}): Uint8Array {
  const used = new Set<string>();
  const named = sheets.map((s) => ({ ...s, name: safeSheetName(s.name, used) }));
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    named
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<bookViews><workbookView/></bookViews><sheets>` +
    named.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets>` +
    (named.some((s) => s.header && s.rows.length > 1)
      ? `<definedNames>${named
          .map((s, i) => {
            if (!s.header || s.rows.length <= 1) return "";
            const cols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
            const sheetRef = `'${s.name.replace(/'/g, "''")}'`;
            return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(`${sheetRef}!$A$1:$${columnLetter(cols - 1)}$${s.rows.length}`)}</definedName>`;
          })
          .join("")}</definedNames>`
      : "") +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    named
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    (opts.title ? `<dc:title>${esc(opts.title)}</dc:title>` : "") +
    (opts.language ? `<dc:language>${esc(opts.language)}</dc:language>` : "") +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `</cp:coreProperties>`;

  const app =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>DPO Central</Application></Properties>`;

  return createZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/core.xml", data: core },
    { name: "docProps/app.xml", data: app },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: STYLES },
    ...named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ]);
}

export const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
