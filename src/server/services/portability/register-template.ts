// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Empty templates for the register import (./csv-import.ts): one header row
 * with the fields the import reads, in the reader's language, as CSV or as
 * an Excel workbook. The Id column is left out: without it, each row's
 * source id is a digest of its cells.
 *
 * The workbook is written by hand (a handful of fixed XML parts in a ZIP):
 * one sheet, inline strings, no styles. Pure: no database.
 */

import AdmZip from "adm-zip";
import { importFields, REQUIRED_FIELDS, type CsvRegister } from "./csv-import";
import type { Locale } from "./registers";

export type TemplateFormat = "csv" | "xlsx";

const FILE_NAMES: Record<CsvRegister, Record<Locale, string>> = {
  processingActivities: { en: "processing-activities-template", es: "plantilla-actividades-de-tratamiento" },
  dataAssets: { en: "systems-template", es: "plantilla-sistemas" },
  vendors: { en: "vendors-template", es: "plantilla-proveedores" },
};

/** The headers of the template, in the reader's language, required fields first. */
export function templateHeaders(register: CsvRegister, locale: Locale): string[] {
  const fields = importFields(register).filter((f) => f.key !== "id");
  const required = REQUIRED_FIELDS[register];
  const ordered = [...fields.filter((f) => required.includes(f.key)), ...fields.filter((f) => !required.includes(f.key))];
  return ordered.map((f) => f[locale]);
}

export function templateFileName(register: CsvRegister, locale: Locale, format: TemplateFormat): string {
  return `${FILE_NAMES[register][locale]}.${format}`;
}

function csvCell(text: string, separator: string): string {
  return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The CSV template: UTF-8 with a byte-order mark (so spreadsheets read the
 * accents), separated by semicolons in Spanish (as Spanish spreadsheets
 * expect) and by commas in English. The import reads both.
 */
export function csvTemplate(register: CsvRegister, locale: Locale): string {
  const separator = locale === "es" ? ";" : ",";
  return "﻿" + templateHeaders(register, locale).map((h) => csvCell(h, separator)).join(separator) + "\r\n";
}

function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Column letters: 0 is A, 25 is Z, 26 is AA. */
function columnName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";

/** The Excel template: one sheet whose first row holds the headers. */
export function xlsxTemplate(register: CsvRegister, locale: Locale): Buffer {
  const headers = templateHeaders(register, locale);
  const sheetName = locale === "es" ? "Plantilla" : "Template";
  const cells = headers
    .map((h, i) => `<c r="${columnName(i)}1" t="inlineStr"><is><t>${xml(h)}</t></is></c>`)
    .join("");
  const cols = headers
    .map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(14, h.length + 4))}" customWidth="1"/>`)
    .join("");

  const zip = new AdmZip();
  const add = (name: string, content: string) => zip.addFile(name, Buffer.from(XML_HEAD + content, "utf8"));
  add(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`,
  );
  add(
    "_rels/.rels",
    `<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  );
  add(
    "xl/workbook.xml",
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `<Relationships xmlns="${NS_PKG_REL}">` +
      `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`,
  );
  add(
    "xl/worksheets/sheet1.xml",
    `<worksheet xmlns="${NS_MAIN}"><cols>${cols}</cols><sheetData><row r="1">${cells}</row></sheetData></worksheet>`,
  );
  return zip.toBuffer();
}
