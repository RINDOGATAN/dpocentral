// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Take your programme with you": the whole programme as one ZIP, streamed.
 *
 *   programme.json                the programme (./format.ts)
 *   csv/<register>.csv            one table per register (./registers.ts)
 *   schema/programme.schema.json  the JSON Schema, draft 2020-12 (./docs.ts)
 *   schema/README.md, LEEME.md    every field explained, English and Spanish
 *   manifest.json                 every file's size and SHA-256, the counts
 *
 * The archive is produced as it is sent: records are read a page at a time
 * (./read.ts), compressed and written out (src/lib/zip-stream.ts), so memory
 * stays flat however large the organisation is. The CSV tables read the
 * records a second time rather than keeping them; a record changed during the
 * download can therefore differ between programme.json and its CSV row.
 *
 * Who may export, and the audit entry, are the route's business
 * (src/app/api/export/programme/route.ts).
 */

import { createHash } from "crypto";
import type { Db } from "@/lib/prisma";
import { csvCell } from "@/server/services/audit/csv";
import { ZipStreamWriter } from "@/lib/zip-stream";
import { PROGRAMME_FORMAT, REGISTER_KEYS, type RegisterKey } from "./format";
import { readContext, readOrganization, readRegister, type ReadContext, type ReadOptions } from "./read";
import { CSV_TABLES, cellText, type CsvTable, type Locale } from "./registers";
import { programmeJsonSchema, programmeReadme } from "./docs";

export interface ProgrammeExportOptions extends ReadOptions {
  /** Language of the CSV headers and values. */
  locale: Locale;
  now?: Date;
  /** The running build, for the manifest. */
  appVersion?: string | null;
  commit?: string | null;
}

export interface ManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ProgrammeManifest {
  format: typeof PROGRAMME_FORMAT;
  generatedAt: string;
  appVersion: string | null;
  commit: string | null;
  contents: { rightsRequests: boolean };
  counts: Partial<Record<RegisterKey, number>>;
  files: ManifestFile[];
}

/** Records per page as indented JSON lines inside the programme's array. */
function indent(json: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return json
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}

async function* programmeJson(
  db: Db,
  opts: ProgrammeExportOptions,
  ctx: ReadContext,
  counts: Partial<Record<RegisterKey, number>>,
  now: Date,
): AsyncGenerator<string> {
  const organization = await readOrganization(db, opts.organizationId);
  const rightsRequests = opts.dsarModuleOn && opts.includeRightsRequests;
  const header = {
    format: PROGRAMME_FORMAT,
    exportedAt: now.toISOString(),
    source: { system: "DPO Central", version: opts.appVersion ?? null, organizationId: organization.id },
    contents: { rightsRequests, auditTrail: true },
    organization,
  };
  const head = JSON.stringify(header, null, 2);
  yield head.slice(0, head.lastIndexOf("}")).trimEnd();
  for (const key of REGISTER_KEYS) {
    yield `,\n  ${JSON.stringify(key)}: [`;
    let n = 0;
    for await (const page of readRegister(db, key, opts, ctx)) {
      const parts: string[] = [];
      for (const record of page) {
        parts.push(`${n === 0 ? "" : ","}\n${indent(JSON.stringify(record, null, 2), 4)}`);
        n++;
      }
      yield parts.join("");
    }
    counts[key] = n;
    yield n === 0 ? "]" : "\n  ]";
  }
  yield "\n}\n";
}

async function* csvFile(
  db: Db,
  table: CsvTable,
  opts: ProgrammeExportOptions,
  ctx: ReadContext,
): AsyncGenerator<string> {
  const { locale } = opts;
  // A byte-order mark, so a spreadsheet opens the accents correctly.
  yield `﻿${table.columns.map((col) => csvCell(col[locale])).join(",")}\r\n`;
  for await (const page of readRegister(db, table.register, opts, ctx)) {
    const lines: string[] = [];
    for (const record of page) {
      for (const row of table.rows ? table.rows(record) : [record]) {
        lines.push(
          table.columns
            .map((col) => csvCell(cellText(col, col.get ? col.get(row) : row[col.key], locale)))
            .join(","),
        );
      }
    }
    if (lines.length) yield `${lines.join("\r\n")}\r\n`;
  }
}

/** The tables this export carries: rights requests only when they are included. */
export function exportTables(opts: Pick<ReadOptions, "includeRightsRequests" | "dsarModuleOn">): CsvTable[] {
  return CSV_TABLES.filter(
    (t) => t.register !== "rightsRequests" || (opts.dsarModuleOn && opts.includeRightsRequests),
  );
}

/**
 * The archive's bytes, in order. `onManifest` receives the manifest once the
 * last file is written (the route records the counts in the audit trail).
 */
export async function* programmeArchive(
  db: Db,
  opts: ProgrammeExportOptions,
  onManifest?: (manifest: ProgrammeManifest) => void | Promise<void>,
): AsyncGenerator<Uint8Array> {
  const now = opts.now ?? new Date();
  const zip = new ZipStreamWriter(now);
  const ctx = await readContext(db);
  const rightsRequests = opts.dsarModuleOn && opts.includeRightsRequests;
  const manifest: ProgrammeManifest = {
    format: PROGRAMME_FORMAT,
    generatedAt: now.toISOString(),
    appVersion: opts.appVersion ?? null,
    commit: opts.commit ?? null,
    contents: { rightsRequests },
    counts: {},
    files: [],
  };

  async function* put(path: string, source: AsyncIterable<string> | string): AsyncGenerator<Uint8Array> {
    const hash = createHash("sha256");
    let bytes = 0;
    yield* zip.entry(path, source, (chunk) => {
      hash.update(chunk);
      bytes += chunk.length;
    });
    manifest.files.push({ path, bytes, sha256: hash.digest("hex") });
  }

  yield* put("programme.json", programmeJson(db, opts, ctx, manifest.counts, now));
  for (const table of exportTables(opts)) {
    yield* put(`csv/${table.file}`, csvFile(db, table, opts, ctx));
  }
  yield* put("schema/programme.schema.json", `${JSON.stringify(programmeJsonSchema(), null, 2)}\n`);
  yield* put("schema/README.md", programmeReadme("en", { rightsRequests }));
  yield* put("schema/LEEME.md", programmeReadme("es", { rightsRequests }));
  // The manifest lists every file before it; it cannot list itself.
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  yield* zip.entry("manifest.json", manifestText);
  yield* zip.finish();
  await onManifest?.(manifest);
}
