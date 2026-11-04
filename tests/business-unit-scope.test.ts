// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import {
  businessUnitScopeWhere,
  departmentScopeConditions,
  requestedDepartmentWhere,
  UNASSIGNED_DEPARTMENT,
  type BusinessUnitScope,
} from "@/server/services/business-units/scope";

const ALL: BusinessUnitScope = { all: true };
const LIMITED: BusinessUnitScope = { all: false, businessUnitIds: ["dept-a", "dept-b"] };

describe("department scope (pure)", () => {
  it("imposes no condition on an unlimited member", () => {
    expect(businessUnitScopeWhere(ALL)).toBeNull();
    expect(departmentScopeConditions(ALL)).toEqual([]);
  });

  it("confines a limited member to their departments", () => {
    expect(businessUnitScopeWhere(LIMITED)).toEqual({ businessUnitId: { in: ["dept-a", "dept-b"] } });
  });

  it("a limit with no departments matches nothing (never falls back to the whole org)", () => {
    expect(businessUnitScopeWhere({ all: false, businessUnitIds: [] })).toEqual({
      businessUnitId: { in: [] },
    });
  });

  it("turns a requested department into an equality, and 'unassigned' into null", () => {
    expect(requestedDepartmentWhere("dept-a")).toEqual({ businessUnitId: "dept-a" });
    expect(requestedDepartmentWhere(UNASSIGNED_DEPARTMENT)).toEqual({ businessUnitId: null });
    expect(requestedDepartmentWhere(undefined)).toBeNull();
  });

  it("ANDs the member scope and the requested department together", () => {
    expect(departmentScopeConditions(LIMITED, "dept-a")).toEqual([
      { businessUnitId: { in: ["dept-a", "dept-b"] } },
      { businessUnitId: "dept-a" },
    ]);
  });

  it("a requested department alone narrows an unlimited member", () => {
    expect(departmentScopeConditions(ALL, "dept-a")).toEqual([{ businessUnitId: "dept-a" }]);
  });
});
