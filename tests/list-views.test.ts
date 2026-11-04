// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import {
  LIST_DEFS,
  activeFilterCount,
  isEmptyFilterSet,
  parseListFilters,
  sanitizeFilters,
  serializeListFilters,
  type ListFilters,
} from "@/lib/list-views";

describe("list-views vocabulary", () => {
  it("parses only values the list's vocabulary allows", () => {
    const params = new URLSearchParams(
      "q=acme&status=ACTIVE&riskTier=HIGH&sort=name&bogus=1&status2=x",
    );
    const filters = parseListFilters(LIST_DEFS.vendors, params);
    expect(filters).toEqual({ q: "acme", status: "ACTIVE", riskTier: "HIGH", sort: "name" });
  });

  it("drops an unknown enum value rather than trusting it", () => {
    const params = new URLSearchParams("status=NOT_A_STATUS&riskTier=HIGH");
    const filters = parseListFilters(LIST_DEFS.vendors, params);
    expect(filters.status).toBeUndefined();
    expect(filters.riskTier).toBe("HIGH");
  });

  it("ignores the department filter on a list that has none", () => {
    const params = new URLSearchParams("dept=dept-a&type=DPIA");
    const filters = parseListFilters(LIST_DEFS.assessments, params);
    expect(filters.dept).toBeUndefined();
    expect(filters.type).toBe("DPIA");
  });

  it("keeps the department filter on the data inventory", () => {
    const params = new URLSearchParams("dept=dept-a&assetType=DATABASE");
    const filters = parseListFilters(LIST_DEFS["data-inventory"], params);
    expect(filters.dept).toBe("dept-a");
    expect(filters.assetType).toBe("DATABASE");
  });

  it("round-trips through serialise/parse, dropping the default sort", () => {
    const filters: ListFilters = { q: "acme", status: "ACTIVE", sort: "newest" };
    const qs = serializeListFilters(LIST_DEFS.vendors, filters);
    expect(qs.get("sort")).toBeNull(); // newest is the default, so not written
    const back = parseListFilters(LIST_DEFS.vendors, qs);
    expect(back).toEqual({ q: "acme", status: "ACTIVE" });
  });

  it("writes a non-default sort", () => {
    const qs = serializeListFilters(LIST_DEFS.vendors, { sort: "name" });
    expect(qs.get("sort")).toBe("name");
  });

  it("counts active filters but not the sort", () => {
    const filters: ListFilters = { q: "x", status: "ACTIVE", sort: "name" };
    expect(activeFilterCount(LIST_DEFS.vendors, filters)).toBe(2);
    expect(isEmptyFilterSet(LIST_DEFS.vendors, filters)).toBe(false);
    expect(isEmptyFilterSet(LIST_DEFS.vendors, { sort: "name" })).toBe(true);
  });

  it("sanitises a stored filter object to the list's vocabulary", () => {
    const raw = { status: "ACTIVE", riskTier: "NONSENSE", q: "acme", evil: "x" };
    const clean = sanitizeFilters("vendors", raw);
    expect(clean).toEqual({ status: "ACTIVE", q: "acme" });
  });
});
