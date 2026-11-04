// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { isRecordComplete, missingRecordFields } from "@/lib/record-completeness";

describe("record completeness (Art. 30)", () => {
  it("a fully filled record is complete", () => {
    const record = {
      dataSubjects: ["customers"],
      categories: ["IDENTIFIERS"],
      recipients: ["a processor"],
      retentionPeriod: "5 years",
      retentionDays: null,
    };
    expect(missingRecordFields(record)).toEqual([]);
    expect(isRecordComplete(record)).toBe(true);
  });

  it("reports every missing field, in display order", () => {
    const record = {
      dataSubjects: [],
      categories: null,
      recipients: [],
      retentionPeriod: "",
      retentionDays: null,
    };
    expect(missingRecordFields(record)).toEqual([
      "dataSubjects",
      "categories",
      "recipients",
      "retention",
    ]);
    expect(isRecordComplete(record)).toBe(false);
  });

  it("accepts a retention expressed only in days", () => {
    const record = {
      dataSubjects: ["employees"],
      categories: ["EMPLOYMENT"],
      recipients: ["payroll"],
      retentionPeriod: null,
      retentionDays: 365,
    };
    expect(missingRecordFields(record)).toEqual([]);
  });

  it("treats a zero-day retention as no retention", () => {
    const record = {
      dataSubjects: ["x"],
      categories: ["OTHER"],
      recipients: ["y"],
      retentionPeriod: "   ",
      retentionDays: 0,
    };
    expect(missingRecordFields(record)).toEqual(["retention"]);
  });
});
