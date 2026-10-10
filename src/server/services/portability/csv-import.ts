// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The bridge for registers kept elsewhere: a spreadsheet of processing
 * activities, systems or vendors (often an export from another platform)
 * becomes drafts here.
 *
 *   1. read the file into a table of text cells (an Importer, below);
 *   2. match its columns to our fields (suggestMapping: by header, in English
 *      or Spanish, with common synonyms); the person can change the match;
 *   3. turn each row into a record of the programme format (./format.ts);
 *   4. hand those records to the programme importer (./import.ts), which does
 *      the dry run and the import as drafts, never overwriting anything.
 *
 * EXTENSION POINT. A source that is not CSV (for example one vendor's XML
 * export) is supported by adding an Importer to IMPORTERS: it turns the file
 * into headers and rows of text, and everything after that (matching, dry
 * run, drafts, idempotency) is shared. No XML importer exists yet: the format
 * of a given platform's XML is to be built from a real sample, not guessed.
 *
 * Idempotent: a row's source id is its value in the column matched to "Id",
 * else a digest of the row's mapped cells, so uploading the same file twice
 * creates nothing the second time.
 */

import { createHash } from "crypto";
import { Programme, PROGRAMME_FORMAT, type ProgrammeDoc } from "./format";
import { enumWords, mainTable, normalizeHeader, type CsvColumn, type EnumName } from "./registers";

// ── Importers ───────────────────────────────────────────────────────────────

export interface TextTable {
  headers: string[];
  rows: string[][];
}

/** Turns an uploaded file into a table of text. One per source format. */
export interface Importer {
  /** Short stable name, recorded with the import ("csv"). */
  id: string;
  /** Whether this importer reads the file (by name and first bytes). */
  accepts(fileName: string, bytes: Uint8Array): boolean;
  read(bytes: Uint8Array): TextTable;
}

export const MAX_CSV_ROWS = 20_000;

/** Text of the file: UTF-8 (with or without a byte-order mark), else Windows-1252 as older spreadsheets save it. */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** The separator of the header line: comma, semicolon (Spanish spreadsheets) or tab. */
function detectSeparator(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim() && !l.startsWith("#")) ?? "";
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]!++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
  return n > 0 ? best : ",";
}

/** RFC 4180 CSV: quoted cells, doubled quotes, line breaks inside quotes. */
export function parseCsv(text: string, separator = detectSeparator(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === separator) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export const csvImporter: Importer = {
  id: "csv",
  accepts: (fileName) => /\.(csv|txt|tsv)$/i.test(fileName),
  read(bytes) {
    const text = decodeText(bytes);
    // Comment lines before the header (a "#" line, as some exports write) are skipped.
    const lines = parseCsv(text);
    let start = 0;
    while (start < lines.length && lines[start]![0]?.startsWith("#")) start++;
    const [headers = [], ...rows] = lines.slice(start);
    return { headers: headers.map((h) => h.trim()), rows };
  },
};

/** Every importer this build has. Add new source formats here. */
export const IMPORTERS: Importer[] = [csvImporter];

export function importerFor(fileName: string, bytes: Uint8Array): Importer | null {
  return IMPORTERS.find((i) => i.accepts(fileName, bytes)) ?? null;
}

// ── Registers and fields ────────────────────────────────────────────────────

export const CSV_REGISTERS = ["processingActivities", "dataAssets", "vendors"] as const;
export type CsvRegister = (typeof CSV_REGISTERS)[number];

/** Columns of our own views that are not fields one imports (derived or internal). */
const NOT_IMPORTED = new Set(["confirmationState", "createdAt", "updatedAt", "systems", "contracts", "businessUnitId"]);

/** The fields a column of an uploaded file can be matched to. */
export function importFields(register: CsvRegister): CsvColumn[] {
  return (mainTable(register)?.columns ?? []).filter((c) => !NOT_IMPORTED.has(c.key));
}

/** Fields without which a row cannot become a record. */
export const REQUIRED_FIELDS: Record<CsvRegister, string[]> = {
  processingActivities: ["name", "legalBasis"],
  dataAssets: ["name"],
  vendors: ["name"],
};

/** Column index → field key (or null: not imported). */
export type ColumnMapping = Array<string | null>;

/**
 * The suggested match of each header: its field's key, English or Spanish
 * header, or a synonym, compared without case, accents or punctuation. A
 * field is matched once (the first header that names it).
 */
export function suggestMapping(register: CsvRegister, headers: string[]): ColumnMapping {
  const fields = importFields(register);
  const used = new Set<string>();
  const names = fields.map((f) => ({
    key: f.key,
    words: new Set([f.key, f.en, f.es, ...(f.synonyms ?? [])].map(normalizeHeader)),
  }));
  return headers.map((h) => {
    const n = normalizeHeader(h);
    const hit = names.find((f) => !used.has(f.key) && f.words.has(n));
    if (!hit) return null;
    used.add(hit.key);
    return hit.key;
  });
}

// ── Cells ───────────────────────────────────────────────────────────────────

const TRUE = new Set(["yes", "si", "true", "1", "x", "y", "s", "verdadero"]);
const FALSE = new Set(["no", "false", "0", "n", "falso"]);

/** "Art. 6.1.b", "6(1)(f)", "article 6 1 a": the GDPR letter → our legal basis. */
const GDPR_LETTER: Record<string, string> = {
  a: "CONSENT",
  b: "CONTRACT",
  c: "LEGAL_OBLIGATION",
  d: "VITAL_INTERESTS",
  e: "PUBLIC_TASK",
  f: "LEGITIMATE_INTERESTS",
};

function legalBasisFrom(text: string): string | null {
  const m = /6\s*[.(]?\s*1\s*[.)]?\s*[.(]?\s*([a-f])\b/i.exec(text);
  return m ? GDPR_LETTER[m[1]!.toLowerCase()]! : null;
}

const enumCache = new Map<EnumName, Map<string, string>>();
function enumValue(name: EnumName, text: string): string | null {
  let words = enumCache.get(name);
  if (!words) {
    words = enumWords(name);
    enumCache.set(name, words);
  }
  const hit = words.get(normalizeHeader(text));
  if (hit) return hit;
  if (name === "LegalBasis") return legalBasisFrom(text);
  return null;
}

/** A cell as written, without the apostrophe that guards a formula. */
function clean(raw: string): string {
  const t = raw.trim();
  return /^'[=+\-@]/.test(t) ? t.slice(1) : t;
}

function splitList(text: string): string[] {
  return text
    .split(/[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface RowProblem {
  row: number;
  field: string;
  en: string;
  es: string;
}

function readCell(col: CsvColumn, raw: string, row: number, problems: RowProblem[]): unknown {
  const text = clean(raw);
  if (text === "") return col.kind === "list" || col.kind === "enumList" ? [] : null;
  switch (col.kind) {
    case "number": {
      const n = Number(text.replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(n)) return Math.round(n);
      problems.push({ row, field: col.key, en: `"${text}" is not a number: left empty.`, es: `"${text}" no es un número: queda vacío.` });
      return null;
    }
    case "bool": {
      const n = normalizeHeader(text);
      if (TRUE.has(n)) return true;
      if (FALSE.has(n)) return false;
      problems.push({ row, field: col.key, en: `"${text}" is not yes or no: left empty.`, es: `"${text}" no es sí o no: queda vacío.` });
      return null;
    }
    case "list":
      return splitList(text);
    case "enum": {
      const v = col.enumName ? enumValue(col.enumName, text) : text;
      if (v) return v;
      problems.push({ row, field: col.key, en: `"${text}" is not one of the values of ${col.en}.`, es: `"${text}" no es uno de los valores de ${col.es}.` });
      return null;
    }
    case "enumList": {
      const out: string[] = [];
      for (const part of splitList(text)) {
        const v = col.enumName ? enumValue(col.enumName, part) : part;
        if (v) {
          if (!out.includes(v)) out.push(v);
        } else {
          problems.push({ row, field: col.key, en: `"${part}" is not one of the values of ${col.en}: left out.`, es: `"${part}" no es uno de los valores de ${col.es}: no se importa.` });
        }
      }
      return out;
    }
    default:
      return text;
  }
}

// ── Rows into a programme ───────────────────────────────────────────────────

export interface CsvConversion {
  programme: ProgrammeDoc;
  rows: number;
  /** Rows left out (missing a required field). */
  leftOut: number;
  problems: RowProblem[];
}

/**
 * Turn the table into a programme holding one register. `row` numbers in
 * problems count the header as row 1, as a spreadsheet does.
 */
export function tableToProgramme(
  register: CsvRegister,
  table: TextTable,
  mapping: ColumnMapping,
  now: Date = new Date(),
): CsvConversion {
  const fields = new Map(importFields(register).map((f) => [f.key, f]));
  const problems: RowProblem[] = [];
  const records: Record<string, unknown>[] = [];
  const rowOf: number[] = [];
  let leftOut = 0;
  const required = REQUIRED_FIELDS[register];
  const hasIdColumn = mapping.includes("id");
  const rows = table.rows.slice(0, MAX_CSV_ROWS);

  rows.forEach((cells, i) => {
    const rowNo = i + 2;
    const rec: Record<string, unknown> = {};
    mapping.forEach((key, col) => {
      if (!key) return;
      const field = fields.get(key);
      if (!field) return;
      rec[key] = readCell(field, cells[col] ?? "", rowNo, problems);
    });
    const missing = required.filter((k) => rec[k] === null || rec[k] === undefined || rec[k] === "");
    if (missing.length) {
      leftOut++;
      const names = missing.map((k) => fields.get(k)!);
      problems.push({
        row: rowNo,
        field: missing.join(","),
        en: `Row left out: ${names.map((f) => f.en).join(", ")} is empty or not recognised.`,
        es: `Fila no importada: ${names.map((f) => f.es).join(", ")} está vacío o no se reconoce.`,
      });
      return;
    }
    const digest = createHash("sha256")
      .update(JSON.stringify(mapping.map((k, col) => (k ? clean(cells[col] ?? "") : null))))
      .digest("hex")
      .slice(0, 32);
    const id = hasIdColumn && typeof rec.id === "string" && rec.id ? rec.id.slice(0, 200) : `row-${digest}`;
    records.push({ ...rec, id });
    rowOf.push(rowNo);
  });

  const base = {
    dataAssets: [] as unknown[],
    processingActivities: [] as unknown[],
    vendors: [] as unknown[],
  };
  if (register === "dataAssets") {
    base.dataAssets = records.map((r) => ({
      ...r,
      type: r.type ?? "OTHER",
      metadata: { csvImport: true },
    }));
  } else if (register === "processingActivities") {
    base.processingActivities = records.map((r) => ({
      ...r,
      purpose: r.purpose ?? "",
      assets: [],
      metadata: { csvImport: true },
    }));
  } else {
    base.vendors = records.map((r) => ({ ...r, contracts: [], reviews: [], questionnaireResponses: [], metadata: { csvImport: true } }));
  }

  const draft = {
    format: PROGRAMME_FORMAT,
    exportedAt: now.toISOString(),
    source: { system: "csv", version: null, organizationId: hasIdColumn ? register : `${register}:row` },
    contents: { rightsRequests: false, auditTrail: false },
    organization: { id: "csv", name: "csv" },
    jurisdictions: [],
    people: [],
    businessUnits: [],
    dataElements: [],
    dataFlows: [],
    dataTransfers: [],
    assessmentTemplates: [],
    assessments: [],
    incidents: [],
    aiSystems: [],
    rightsRequestForms: [],
    rightsRequests: [],
    documents: [],
    auditTrail: [],
    ...base,
  };

  // Through the format's own validation, which also fills the defaults.
  const parsed = Programme.safeParse(draft);
  if (!parsed.success) {
    const bad = new Set<number>();
    for (const issue of parsed.error.issues) {
      const index = typeof issue.path[1] === "number" ? issue.path[1] : -1;
      const field = String(issue.path[2] ?? "");
      if (index < 0) throw new Error(`CSV conversion produced an invalid programme: ${issue.message}`);
      bad.add(index);
      problems.push({
        row: rowOf[index] ?? 0,
        field,
        en: `Row left out: ${field} cannot be read (${issue.message}).`,
        es: `Fila no importada: no se puede leer ${field} (${issue.message}).`,
      });
    }
    base[register] = base[register].filter((_, i) => !bad.has(i));
    Object.assign(draft, base);
    leftOut += bad.size;
  }
  const programme: ProgrammeDoc = Programme.parse(draft);

  return { programme, rows: rows.length, leftOut, problems };
}
