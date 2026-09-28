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
