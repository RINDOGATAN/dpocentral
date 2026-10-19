// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// What makes a processing record (a record of processing, Art. 30) complete, in
// one place. The "Incomplete" list uses this to show a person exactly what is
// missing on each record and links to fill it.
//
// A record is created with a name, a purpose and a legal basis (all required at
// creation), so those are always present and are not re-checked here. What Art.
// 30 also asks for, and a person may leave out, is: the categories of data
// subjects, the categories of personal data, the categories of recipients, and
// a retention period. A record missing any of these is incomplete.

/// The required fields on a processing record checked for completeness. Each key
/// is both the field name and an i18n key under `views.field.*`.
export const RECORD_FIELDS = [
  "dataSubjects",
  "categories",
  "recipients",
  "retention",
] as const;

export type RecordField = (typeof RECORD_FIELDS)[number];

/// The shape the completeness check reads. Callers pass what they have from a
/// ProcessingActivity row.
export interface RecordSubject {
  dataSubjects?: readonly string[] | null;
  categories?: readonly string[] | null;
  recipients?: readonly string[] | null;
  retentionPeriod?: string | null;
  retentionDays?: number | null;
}

function isBlankList(value: readonly string[] | null | undefined): boolean {
  return !value || value.length === 0;
}

/// The record fields still missing on this record, in display order. Empty means
/// the record is complete.
export function missingRecordFields(subject: RecordSubject): RecordField[] {
  const missing: RecordField[] = [];
  if (isBlankList(subject.dataSubjects)) missing.push("dataSubjects");
  if (isBlankList(subject.categories)) missing.push("categories");
  if (isBlankList(subject.recipients)) missing.push("recipients");
  const hasRetention =
    (subject.retentionPeriod != null && subject.retentionPeriod.trim() !== "") ||
    (subject.retentionDays != null && subject.retentionDays > 0);
  if (!hasRetention) missing.push("retention");
  return missing;
}

/// True when nothing is missing.
export function isRecordComplete(subject: RecordSubject): boolean {
  return missingRecordFields(subject).length === 0;
}

/// The minimum a processing record needs before it can make the "Records of
/// processing" step done: who it is about, which personal data, and how long it
/// is kept (the legal basis is required at creation). Recipients may lawfully be
/// none, so their absence keeps a record on the Incomplete list but does not
/// hold the step back.
export const MINIMUM_RECORD_FIELDS: readonly RecordField[] = ["dataSubjects", "categories", "retention"];

/// The minimum fields still missing on this record, in display order.
export function missingMinimumFields(subject: RecordSubject): RecordField[] {
  return missingRecordFields(subject).filter((f) => MINIMUM_RECORD_FIELDS.includes(f));
}

/// What a vendor needs before it can make the "Vendors and processors" step
/// done: it is in use (not only a prospect), and the personal data it processes
/// and where it processes them are recorded.
export const VENDOR_FIELDS = ["inUse", "dataProcessed", "countries"] as const;
export type VendorField = (typeof VENDOR_FIELDS)[number];

export interface VendorSubject {
  status?: string | null;
  dataProcessed?: readonly string[] | null;
  countries?: readonly string[] | null;
}

export function missingVendorFields(v: VendorSubject): VendorField[] {
  const missing: VendorField[] = [];
  if (!v.status || v.status === "PROSPECTIVE") missing.push("inUse");
  if (isBlankList(v.dataProcessed)) missing.push("dataProcessed");
  if (isBlankList(v.countries)) missing.push("countries");
  return missing;
}

/// The fields missing on the record closest to complete: what one more edit
/// needs to finish a step. Empty when one record is already complete, or when
/// there is no record at all.
export function closestMissing<F extends string>(rows: readonly F[][]): F[] {
  if (rows.length === 0) return [];
  return rows.reduce((best, row) => (row.length < best.length ? row : best));
}
