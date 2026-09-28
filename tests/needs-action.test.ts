// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { buildNeedsAction, needsActionTotal } from "@/lib/needs-action";

describe("needs-action builder", () => {
  it("drops empty categories and keeps a fixed order", () => {
    const items = buildNeedsAction({
      reviewDue: 2,
      dsarDue: 0,
      breachWindow: 1,
      assessmentApproval: 3,
    });
    expect(items.map((i) => i.kind)).toEqual(["review-due", "breach-window", "assessment-approval"]);
    expect(needsActionTotal(items)).toBe(6);
  });

  it("treats a null org-wide count (department view) as absent", () => {
    const items = buildNeedsAction({
      reviewDue: 4,
      dsarDue: null,
      breachWindow: null,
      assessmentApproval: null,
    });
    expect(items.map((i) => i.kind)).toEqual(["review-due"]);
    expect(needsActionTotal(items)).toBe(4);
  });

  it("returns nothing when there is no work", () => {
    const items = buildNeedsAction({
      reviewDue: 0,
      dsarDue: 0,
      breachWindow: 0,
      assessmentApproval: 0,
    });
    expect(items).toEqual([]);
    expect(needsActionTotal(items)).toBe(0);
  });

  it("gives every category a link", () => {
    const items = buildNeedsAction({ reviewDue: 1, dsarDue: 1, breachWindow: 1, assessmentApproval: 1 });
    for (const item of items) expect(item.href).toMatch(/^\/privacy\//);
  });
});
