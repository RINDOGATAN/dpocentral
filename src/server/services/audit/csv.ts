// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The audit trail as CSV (GET /api/export/audit-trail).
 *
 * The file counsel hands over when asked who changed what and when, so it
 * carries every column the trail shows, including the recorded detail as it
 * was written, rather than a prettified subset. Entries about rights requests
 * carry the reference and the action only (src/lib/audit-access.ts).
 *
 * Above the table, comment lines say when and from which build the file was
 * made, for which organisation, with which filters, and whether the row
 * ceiling cut it short. Pure: no database, no request.
 */

import type { AuditEntryView } from "@/lib/audit-access";
import { stampLines, type ExportStamp } from "@/server/services/export/integrity";
import type { AuditFilters } from "./trail";

/** A hard ceiling, so one request can never stream an unbounded table. */
export const AUDIT_CSV_MAX_ROWS = 50000;

const HEADERS = {
  en: [
    "Timestamp (UTC)",
    "Action",
    "Record type",
    "Record id",
    "Reference",
    "Actor name",
    "Actor email",
    "Actor id",
    "Recorded detail",
    "Metadata",
  ],
  es: [
    "Fecha y hora (UTC)",
    "Acción",
    "Tipo de registro",
    "Id del registro",
    "Referencia",
    "Nombre de quien actúa",
    "Correo de quien actúa",
    "Id de quien actúa",
    "Detalle registrado",
    "Metadatos",
  ],
} as const;

const WORDS = {
  en: {
    organisation: "Organisation",
    rows: "Rows",
    truncated: (max: number) => ` (cut at the ${max} row limit; narrow the dates)`,
    filters: "Filters",
    none: "none",
    withheld: "withheld: rights request, open the request to read it",
  },
  es: {
    organisation: "Organización",
    rows: "Filas",
    truncated: (max: number) => ` (cortado en el límite de ${max} filas; acota las fechas)`,
    filters: "Filtros",
    none: "ninguno",
    withheld: "omitido: solicitud de derechos, abre la solicitud para leerla",
  },
} as const;

/** One cell, quoted where it holds a separator, a quote or a line break. */
export function csvCell(v: string): string {
  // A cell that a spreadsheet would read as a formula is prefixed with a quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function json(v: unknown): string {
  return v === null || v === undefined ? "" : JSON.stringify(v);
}

export function auditTrailCsv(params: {
  entries: AuditEntryView[];
  stamp: ExportStamp;
  orgName: string;
  filters: AuditFilters;
  locale: "en" | "es";
}): string {
  const { entries, stamp, orgName, filters, locale } = params;
  const w = WORDS[locale];
  const filterText =
    [
      filters.entityType ? `entityType=${filters.entityType}` : null,
      filters.action ? `action=${filters.action}` : null,
      filters.userId ? `actor=${filters.userId}` : null,
      filters.from ? `from=${filters.from.toISOString()}` : null,
      filters.to ? `to=${filters.to.toISOString()}` : null,
    ]
      .filter(Boolean)
      .join(" ") || w.none;
  const preamble = [
    ...stampLines(stamp, locale).map((l) => `# ${l}`),
    `# ${w.organisation}: ${orgName}`,
    `# ${w.rows}: ${entries.length}${entries.length >= AUDIT_CSV_MAX_ROWS ? w.truncated(AUDIT_CSV_MAX_ROWS) : ""}`,
    `# ${w.filters}: ${filterText}`,
  ].map(csvCell);

  const body = entries.map((e) =>
    [
      e.createdAt.toISOString(),
      e.action,
      e.entityType,
      e.restricted ? "" : e.entityId,
      e.reference ?? "",
      e.actorName ?? "",
      e.actorEmail ?? "",
      e.actorId ?? "",
      e.restricted ? w.withheld : json(e.changes),
      e.restricted ? "" : json(e.metadata),
    ]
      .map((v) => csvCell(String(v)))
      .join(","),
  );

  // A byte-order mark, so a spreadsheet opens the accents correctly.
  return `﻿${[...preamble, HEADERS[locale].join(","), ...body].join("\r\n")}\r\n`;
}
