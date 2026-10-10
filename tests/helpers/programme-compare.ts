// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Comparing two exports of the same programme (the round-trip tests): ids the
 * target made are replaced with the source ids they came from (from the
 * import's own mapping), and what an import changes on purpose (dates of
 * creation, metadata, confirmation, the children's own ids) is set aside.
 */

type Rec = Record<string, unknown>;

export function canonical(value: unknown, idMap: Map<string, string>, unmatched: Set<string>): unknown {
  if (typeof value === "string") {
    if (idMap.has(value)) return idMap.get(value);
    if (unmatched.has(value)) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => canonical(v, idMap, unmatched));
  if (value && typeof value === "object") {
    const out: Rec = {};
    for (const [k, v] of Object.entries(value as Rec)) out[k] = canonical(v, idMap, unmatched);
    return out;
  }
  return value;
}

const VOLATILE = new Set(["createdAt", "updatedAt", "metadata", "confirmation", "reference"]);
const CHILD_LISTS = new Set([
  "contracts",
  "reviews",
  "questionnaireResponses",
  "mitigations",
  "timeline",
  "tasks",
  "notifications",
  "documents",
  "communications",
]);

export function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => strip(v));
  if (value && typeof value === "object") {
    const out: Rec = {};
    for (const [k, v] of Object.entries(value as Rec)) {
      if (VOLATILE.has(k)) continue;
      out[k] =
        CHILD_LISTS.has(k) && Array.isArray(v)
          ? v.map((c) => {
              const rest = { ...(c as Rec) };
              delete rest.id;
              return strip(rest);
            })
          : strip(v);
    }
    return out;
  }
  return value;
}

export const byId = (list: Rec[]) =>
  [...list].sort((a, b) => String(a.id ?? a.name).localeCompare(String(b.id ?? b.name)));

/** new id → source id, from the rows the import wrote to programme_import_records. */
export function idMapFrom(rows: Array<{ localId: string; sourceKey: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.localId, r.sourceKey.split(":").slice(2).join(":"));
  return map;
}

/** Registers compared record for record after a round trip. */
export const ROUND_TRIP_REGISTERS = [
  "businessUnits",
  "dataAssets",
  "dataElements",
  "processingActivities",
  "dataFlows",
  "dataTransfers",
  "vendors",
  "incidents",
  "rightsRequestForms",
  "rightsRequests",
] as const;
