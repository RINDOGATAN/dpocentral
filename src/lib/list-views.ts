// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// The one filter vocabulary for every list in the dashboard, and the pure rules
// that read and write it to the URL. The five lists the stage-4 directive names
// — data inventory, vendors, assessments, rights requests and incidents — each
// declare their filters here, so a filter is the same thing whether it lives in
// the URL, in a saved-view row, or in the query.
//
// Everything here is pure and framework-free, so the meaning of each filter is
// tested without a browser or a database (src/lib/list-views.test.ts). The URL
// binding is in src/lib/use-list-filters.ts; the saved-view router validates a
// stored filter set through `sanitizeFilters`, so a view can never carry a value
// the filter cannot honour.

import type { EnumKind } from "@/lib/enum-labels";
import { DEFAULT_LIST_SORT, isListSort, type ListSort } from "@/lib/list-sort";

/// The lists that carry URL filters and saved views.
export const LIST_KEYS = [
  "data-inventory",
  "vendors",
  "assessments",
  "dsar",
  "incidents",
] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export function isListKey(value: unknown): value is ListKey {
  return typeof value === "string" && (LIST_KEYS as readonly string[]).includes(value);
}

/// The `dept` value the department filter uses for "no department assigned".
/// Shared with the server scope service, so the filter and the query agree.
export const UNASSIGNED_DEPARTMENT = "unassigned";

/// One select filter on a list: its URL parameter and filter key, the enum
/// group its option labels come from (or none, to de-snake), and the values it
/// accepts. A value outside `options` is dropped on parse.
export interface FilterFieldDef {
  key: string;
  kind?: EnumKind;
  options: readonly string[];
}

export interface ListDef {
  key: ListKey;
  fields: readonly FilterFieldDef[];
  /// Whether records on this list carry a department (data inventory does; the
  /// other four do not).
  hasDepartment: boolean;
  /// The sort orders this list offers.
  sorts: readonly ListSort[];
}

// The enum value sets, kept as plain string arrays (not imported from Prisma) so
// this module stays free of the database client and safe to bundle for the
// browser. They mirror prisma/schema.prisma; a regression is caught by a list
// page failing to filter, not by a type error, so keep them in step by hand.
const VENDOR_STATUS = ["PROSPECTIVE", "ACTIVE", "UNDER_REVIEW", "SUSPENDED", "TERMINATED"] as const;
const VENDOR_RISK_TIER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const ASSESSMENT_TYPE = ["DPIA", "PIA", "TIA", "LIA", "VENDOR", "CUSTOM"] as const;
const ASSESSMENT_STATUS = [
  "DRAFT",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
] as const;
const DSAR_TYPE = [
  "ACCESS",
  "RECTIFICATION",
  "ERASURE",
  "PORTABILITY",
  "OBJECTION",
  "RESTRICTION",
  "AUTOMATED_DECISION",
  "WITHDRAW_CONSENT",
  "OTHER",
] as const;
const DSAR_STATUS = [
  "SUBMITTED",
  "IDENTITY_PENDING",
  "IDENTITY_VERIFIED",
  "IN_PROGRESS",
  "DATA_COLLECTED",
  "REVIEW_PENDING",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
const INCIDENT_STATUS = [
  "REPORTED",
  "INVESTIGATING",
  "CONTAINED",
  "ERADICATED",
  "RECOVERING",
  "CLOSED",
  "FALSE_POSITIVE",
] as const;
const INCIDENT_SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const INCIDENT_TYPE = [
  "DATA_BREACH",
  "UNAUTHORIZED_ACCESS",
  "DATA_LOSS",
  "SYSTEM_COMPROMISE",
  "PHISHING",
  "RANSOMWARE",
  "INSIDER_THREAT",
  "PHYSICAL_SECURITY",
  "VENDOR_INCIDENT",
  "OTHER",
] as const;
const DATA_ASSET_TYPE = [
  "DATABASE",
  "APPLICATION",
  "FILE_SYSTEM",
  "CLOUD_SERVICE",
  "THIRD_PARTY",
  "PHYSICAL",
  "OTHER",
] as const;

export const LIST_DEFS: Record<ListKey, ListDef> = {
  "data-inventory": {
    key: "data-inventory",
    fields: [{ key: "assetType", kind: "dataAssetType", options: DATA_ASSET_TYPE }],
    hasDepartment: true,
    sorts: ["newest", "oldest", "name"],
  },
  vendors: {
    key: "vendors",
    fields: [
      { key: "status", kind: "vendorStatus", options: VENDOR_STATUS },
      { key: "riskTier", options: VENDOR_RISK_TIER },
    ],
    hasDepartment: false,
    sorts: ["newest", "oldest", "name"],
  },
  assessments: {
    key: "assessments",
    fields: [
      { key: "type", kind: "assessmentType", options: ASSESSMENT_TYPE },
      { key: "status", kind: "assessmentStatus", options: ASSESSMENT_STATUS },
    ],
    hasDepartment: false,
    sorts: ["newest", "oldest", "name"],
  },
  dsar: {
    key: "dsar",
    fields: [
      { key: "type", kind: "dsarType", options: DSAR_TYPE },
      { key: "status", kind: "dsarStatus", options: DSAR_STATUS },
    ],
    hasDepartment: false,
    sorts: ["newest", "oldest", "name"],
  },
  incidents: {
    key: "incidents",
    fields: [
      { key: "status", kind: "incidentStatus", options: INCIDENT_STATUS },
      { key: "severity", kind: "incidentSeverity", options: INCIDENT_SEVERITY },
      { key: "type", kind: "incidentType", options: INCIDENT_TYPE },
    ],
    hasDepartment: false,
    sorts: ["newest", "oldest", "name"],
  },
};

/// A parsed filter set. Reserved keys: `q` (search), `sort`, `dept`. Every other
/// key is a field key from the list's definition. Values are always strings.
export type ListFilters = {
  q?: string;
  sort?: ListSort;
  dept?: string;
} & Record<string, string | undefined>;

// The reserved parameter names, never used as a field key.
const Q = "q";
const SORT = "sort";
const DEPT = "dept";

/// Read a filter set out of URL search params for one list. Unknown or malformed
/// values are dropped rather than trusted, so a hand-edited URL can never inject
/// a value the vocabulary does not contain.
export function parseListFilters(def: ListDef, params: URLSearchParams): ListFilters {
  const filters: ListFilters = {};
  const q = params.get(Q)?.trim();
  if (q) filters.q = q;
  const sort = params.get(SORT);
  if (isListSort(sort) && def.sorts.includes(sort)) filters.sort = sort;
  if (def.hasDepartment) {
    const dept = params.get(DEPT)?.trim();
    if (dept) filters.dept = dept;
  }
  for (const field of def.fields) {
    const value = params.get(field.key);
    if (value && field.options.includes(value)) filters[field.key] = value;
  }
  return filters;
}

/// Serialise a filter set into URL search params, dropping empties so a plain
/// list has a clean URL. `sort` is only written when it is not the default, to
/// keep the common case tidy.
export function serializeListFilters(def: ListDef, filters: ListFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set(Q, filters.q);
  if (filters.sort && filters.sort !== DEFAULT_LIST_SORT && def.sorts.includes(filters.sort)) {
    params.set(SORT, filters.sort);
  }
  if (def.hasDepartment && filters.dept) params.set(DEPT, filters.dept);
  for (const field of def.fields) {
    const value = filters[field.key];
    if (value && field.options.includes(value)) params.set(field.key, value);
  }
  return params;
}

/// True when no filter narrows the list (a plain, unfiltered view). `sort` is
/// not a narrowing filter, so it is ignored here.
export function isEmptyFilterSet(def: ListDef, filters: ListFilters): boolean {
  if (filters.q) return false;
  if (def.hasDepartment && filters.dept) return false;
  return def.fields.every((field) => !filters[field.key]);
}

/// How many filters are active (for a chip count). `search` and `dept` count;
/// `sort` does not.
export function activeFilterCount(def: ListDef, filters: ListFilters): number {
  let count = 0;
  if (filters.q) count += 1;
  if (def.hasDepartment && filters.dept) count += 1;
  for (const field of def.fields) if (filters[field.key]) count += 1;
  return count;
}

/// Take a stored (or otherwise untrusted) filter object and return only the
/// values the list's vocabulary allows, in the parsed shape. Used by the saved-
/// view router so a saved view can never carry a value the filter cannot honour.
export function sanitizeFilters(listKey: ListKey, raw: Record<string, unknown>): ListFilters {
  const def = LIST_DEFS[listKey];
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value) params.set(key, value);
  }
  return parseListFilters(def, params);
}
