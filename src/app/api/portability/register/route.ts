// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/portability/register (multipart form): one register from a CSV file,
 * the bridge for exports from other platforms.
 *
 *   organizationId   the organisation
 *   register         "processingActivities", "dataAssets" or "vendors"
 *   file             the CSV file (comma, semicolon or tab separated)
 *   mapping          optional: JSON array, one field key (or null) per column;
 *                    without it the suggested match is used
 *   step             "check" (columns, match, dry run; writes nothing) or "import"
 *
 * Owners and admins only. Rows arrive as drafts; nothing is overwritten; the
 * same file twice creates nothing new. Recorded in the audit trail
 * (IMPORT_REGISTER). See src/server/services/portability/csv-import.ts.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isDsarModuleEnabled } from "@/config/features";
import {
  CSV_REGISTERS,
  importerFor,
  importFields,
  MAX_CSV_ROWS,
  REQUIRED_FIELDS,
  suggestMapping,
  tableToProgramme,
  type ColumnMapping,
  type CsvRegister,
} from "@/server/services/portability/csv-import";
import { applyImport, ImportRefusedError, planImport, type ImportOptions } from "@/server/services/portability/import";
import { importLimitChecker } from "@/server/services/portability/limits";
import { checkImportAccess, uploadedFile } from "@/server/services/portability/route-access";
import { MAX_UPLOAD_BYTES } from "@/server/services/portability/upload";

export const maxDuration = 60;

function parseMapping(raw: FormDataEntryValue | null, columns: number, register: CsvRegister): ColumnMapping | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return null;
    const allowed = new Set(importFields(register).map((f) => f.key));
    const out = value.slice(0, columns).map((v) => (typeof v === "string" && allowed.has(v) ? v : null));
    // A field matched to two columns keeps the first.
    const seen = new Set<string>();
    return out.map((k) => (k && !seen.has(k) ? (seen.add(k), k) : null));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the file as a multipart form." }, { status: 400 });
  }
  const step = form.get("step") === "import" ? "import" : "check";
  const locale = form.get("locale") === "es" ? "es" : "en";
  const access = await checkImportAccess(request, form.get("organizationId") as string | null, step, locale);
  if (!access.ok) return access.response;

  const register = form.get("register") as CsvRegister;
  if (!CSV_REGISTERS.includes(register)) {
    return Response.json({ error: "Unknown register." }, { status: 400 });
  }
  const file = await uploadedFile(form);
  if (!file) return Response.json({ error: "No file was sent." }, { status: 400 });
  if (file.bytes.length > MAX_UPLOAD_BYTES) return Response.json({ error: "The file is too large." }, { status: 413 });
  const importer = importerFor(file.name, file.bytes);
  if (!importer) {
    return Response.json({ error: "unsupported_file", message: "Only CSV files can be read for now." }, { status: 415 });
  }

  const table = importer.read(file.bytes);
  if (table.headers.length === 0) return Response.json({ error: "The file is empty." }, { status: 422 });
  const mapping = parseMapping(form.get("mapping"), table.headers.length, register) ?? suggestMapping(register, table.headers);
  const conversion = tableToProgramme(register, table, mapping);

  const options: ImportOptions = {
    organizationId: access.organizationId,
    userId: access.userId,
    includeRightsRequests: false,
    dsarModuleOn: isDsarModuleEnabled(),
    requireEmpty: false,
    mode: "register",
    checkLimits: importLimitChecker(prisma, access.organizationId),
  };

  const columns = {
    importer: importer.id,
    headers: table.headers,
    mapping,
    fields: importFields(register).map((f) => ({ key: f.key, en: f.en, es: f.es, required: REQUIRED_FIELDS[register].includes(f.key) })),
    preview: table.rows.slice(0, 5),
    rows: table.rows.length,
    truncated: table.rows.length > MAX_CSV_ROWS,
    leftOut: conversion.leftOut,
    rowProblems: conversion.problems.slice(0, 200),
    rowProblemCount: conversion.problems.length,
  };

  try {
    if (step === "check") {
      return Response.json({ step, columns, summary: await planImport(prisma, conversion.programme, options) });
    }
    const result = await applyImport(prisma, conversion.programme, options);
    return Response.json({ step, columns, summary: result.summary, created: result.created, importId: result.importId });
  } catch (err) {
    if (err instanceof ImportRefusedError) {
      return Response.json({ step, columns, error: "refused", summary: err.summary }, { status: 409 });
    }
    logger.error("Register import failed", err);
    return Response.json({ error: "The import failed and nothing was written. Try again." }, { status: 500 });
  }
}
