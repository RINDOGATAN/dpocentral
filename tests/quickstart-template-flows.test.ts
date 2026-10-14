// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { flowPairKey, newTemplateFlowCount } from "@/server/services/program/quickstart-flows";

const flows = [
  { sourceAssetName: "KYC", destAssetName: "Accounts" },
  { sourceAssetName: "Ledger", destAssetName: "Reporting", returnFlow: { description: "back" } },
];

describe("quick start template flows", () => {
  it("counts every record on a first run (a two-way flow is two)", () => {
    expect(newTemplateFlowCount(flows, new Map(), new Set())).toBe(3);
  });

  it("counts nothing when every direction is already recorded", () => {
    const ids = new Map([
      ["KYC", "a1"],
      ["Accounts", "a2"],
      ["Ledger", "a3"],
      ["Reporting", "a4"],
    ]);
    const pairs = new Set([flowPairKey("a1", "a2"), flowPairKey("a3", "a4"), flowPairKey("a4", "a3")]);
    expect(newTemplateFlowCount(flows, ids, pairs)).toBe(0);
  });

  it("counts only the missing direction", () => {
    const ids = new Map([
      ["Ledger", "a3"],
      ["Reporting", "a4"],
    ]);
    expect(newTemplateFlowCount(flows, ids, new Set([flowPairKey("a3", "a4")]))).toBe(2);
  });

  it("keeps the direction in the key", () => {
    expect(flowPairKey("a", "b")).not.toBe(flowPairKey("b", "a"));
  });
});
