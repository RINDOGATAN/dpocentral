// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The in-app data flow map draws exactly the recorded flows: one node per
 * system of the organisation (with or without a flow), plus any system at
 * either end of a flow (even when the system list it was given is a partial
 * page), one edge per flow, source to destination.
 */
import { describe, expect, it } from "vitest";
import { buildNodesAndEdges, type AssetData, type FlowData } from "@/components/privacy/data-flow/useDataFlowGraph";

const asset = (id: string, type: AssetData["type"] = "APPLICATION"): AssetData => ({ id, name: `System ${id}`, type, isProduction: true });
const flow = (id: string, s: AssetData, d: AssetData, cats: string[] = ["IDENTIFIERS"]): FlowData => ({
  id, name: id, sourceAssetId: s.id, destinationAssetId: d.id, dataCategories: cats, isAutomated: false, sourceAsset: s, destinationAsset: d,
});

describe("buildNodesAndEdges", () => {
  const a = asset("a"), b = asset("b", "DATABASE"), c = asset("c", "THIRD_PARTY"), lonely = asset("lonely");

  it("has one node per system, with or without a flow, and one edge per flow", () => {
    const { nodes, edges } = buildNodesAndEdges("all", undefined, [a, b, c, lonely], [flow("f1", a, b), flow("f2", b, c)]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c", "lonely"]);
    expect(nodes.find((n) => n.id === "lonely")?.data.isIsolated).toBe(true);
    expect(edges.map((e) => [e.id, e.source, e.target])).toEqual([["f1", "a", "b"], ["f2", "b", "c"]]);
  });

  it("still draws a flow whose systems are missing from the list it was given", () => {
    // e.g. the 51st system and beyond, past the first page of the list
    const { nodes, edges } = buildNodesAndEdges("all", undefined, [a], [flow("f1", a, b), flow("f2", b, c)]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(edges).toHaveLength(2);
    expect(nodes.find((n) => n.id === "c")?.data.label).toBe("System c");
  });

  it("marks the two directions of a pair as bidirectional, the second as the return", () => {
    const { edges } = buildNodesAndEdges("all", undefined, [a, b], [flow("out", a, b), flow("back", b, a)]);
    expect(edges.map((e) => [e.id, e.data?.isBidirectional, e.data?.isReturn])).toEqual([["out", true, false], ["back", true, true]]);
  });

  it("in asset mode shows the system and its direct neighbours only", () => {
    const { nodes } = buildNodesAndEdges("asset", "b", [a, b, c, lonely], [flow("f1", a, b), flow("f2", b, c), flow("f3", c, lonely)]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
  });
});
