// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The data map as a record:
 *   - every system is drawn, with or without a flow, once; repeated flows
 *     and self-loops are not drawn twice; parallel flows are numbered apart;
 *   - chips show the most sensitive categories first;
 *   - the transfer layer: a country node per destination outside the EEA, a
 *     node per vendor no system stands for, one edge per transfer with its
 *     safeguard and status, and a transfer with no starting point still
 *     counted on its country;
 *   - the server side (transfer-markers.ts): placement by the linked vendor,
 *     a status that is recorded or marked as suggested, vendor countries
 *     with no transfer record;
 *   - the catalogue locations of the quick start: EU, EEA and the UK are not
 *     SCC transfers, names are read as countries, the US with a declared DPF
 *     certification is recorded under the adequacy decision.
 */

import { describe, expect, it } from "vitest";
import {
  buildNodesAndEdges,
  buildTransferLayer,
  type AssetData,
  type FlowData,
  type OverlayTransferData,
} from "@/components/privacy/data-flow/useDataFlowGraph";
import { transferOverlay } from "@/server/services/data-flows/transfer-markers";
import {
  declaresDpf,
  requiresTransferSafeguards,
  resolveCatalogLocation,
  transferDestinationsFor,
} from "@/config/vendor-data-mappings";

const asset = (id: string, type: AssetData["type"] = "APPLICATION"): AssetData => ({
  id,
  name: `System ${id}`,
  type,
  isProduction: true,
});
const flow = (id: string, s: AssetData, d: AssetData, cats: string[] = ["IDENTIFIERS"]): FlowData => ({
  id,
  name: id,
  sourceAssetId: s.id,
  destinationAssetId: d.id,
  dataCategories: cats,
  isAutomated: false,
  sourceAsset: s,
  destinationAsset: d,
});

describe("the map's systems and flows", () => {
  const a = asset("a"), b = asset("b", "DATABASE"), c = asset("c", "THIRD_PARTY"), lone = asset("lone");

  it("draws systems without flows, marked, and counts them", () => {
    const { nodes, summary } = buildNodesAndEdges("all", undefined, [a, b, lone], [flow("f1", a, b)]);
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b", "lone"]);
    expect(nodes.find((n) => n.id === "lone")?.data.isIsolated).toBe(true);
    expect(nodes.find((n) => n.id === "a")?.data.isIsolated).toBe(false);
    expect(summary).toMatchObject({ systems: 3, isolatedSystems: 1, flows: 1 });
  });

  it("draws a map of systems only when there is no flow yet", () => {
    const { nodes, edges, summary } = buildNodesAndEdges("all", undefined, [a, b], []);
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(0);
    expect(summary.isolatedSystems).toBe(2);
  });

  it("never draws a system or a flow twice, nor a flow from a system to itself", () => {
    const { nodes, edges } = buildNodesAndEdges(
      "all",
      undefined,
      [a, a, b],
      [flow("f1", a, b), flow("f1", a, b), flow("loop", a, a)]
    );
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(edges.map((e) => e.id)).toEqual(["f1"]);
    expect(nodes.find((n) => n.id === "a")?.data.outgoingFlows).toBe(1);
  });

  it("numbers flows joining the same two systems in the same direction", () => {
    const { edges } = buildNodesAndEdges("all", undefined, [a, b], [flow("x", a, b), flow("y", a, b), flow("back", b, a)]);
    expect(edges.map((e) => [e.id, e.data?.parallelIndex, e.data?.parallelCount, e.data?.isReturn])).toEqual([
      ["x", 0, 2, false],
      ["y", 1, 2, false],
      ["back", 0, 1, true],
    ]);
  });

  it("shows the most sensitive categories first on a system, and how many more", () => {
    const { nodes } = buildNodesAndEdges(
      "all",
      undefined,
      [a, c],
      [flow("f", a, c, ["LOCATION", "BEHAVIORAL", "EMPLOYMENT", "IDENTIFIERS", "HEALTH"])]
    );
    const node = nodes.find((n) => n.id === "c")!;
    expect(node.data.topCategories).toEqual(["HEALTH", "IDENTIFIERS", "LOCATION"]);
    expect(node.data.moreCategories).toBe(2);
    expect(node.data.peakSensitivity).toBe("special");
  });
});

const tr = (id: string, country: string, extra: Partial<OverlayTransferData> = {}): OverlayTransferData => ({
  id,
  name: id,
  country,
  mechanism: "STANDARD_CONTRACTUAL_CLAUSES",
  status: "NEEDS_REVIEW",
  suggested: true,
  assetIds: [],
  vendorId: null,
  ...extra,
});

describe("the map's transfer layer", () => {
  it("draws a country node per destination and an edge per transfer from where it starts", () => {
    const layer = buildTransferLayer("all", undefined, new Set(["crm"]), {
      transfers: [
        tr("t1", "US", { assetIds: ["crm"] }),
        tr("t2", "US", { vendorId: "v1", status: "NON_COMPLIANT", suggested: false }),
        tr("t3", "IN"),
      ],
      vendors: [{ id: "v1", name: "Mailer", unrecordedCountries: [] }],
    });
    expect(layer.nodes.map((n) => n.id)).toEqual(["vendor:v1", "country:IN", "country:US"]);
    expect(layer.edges.map((e) => [e.source, e.target])).toEqual([
      ["crm", "country:US"],
      ["vendor:v1", "country:US"],
    ]);
    const us = layer.nodes.find((n) => n.id === "country:US");
    expect(us?.data.kind === "country" && us.data.worstStatus).toBe("NON_COMPLIANT");
    // A transfer with no system and no vendor still counts on its country.
    const india = layer.nodes.find((n) => n.id === "country:IN");
    expect(india?.data.kind === "country" && india.data.transfers.map((t) => t.id)).toEqual(["t3"]);
  });

  it("in a system's own map shows only its transfers, and no vendor nodes", () => {
    const layer = buildTransferLayer("asset", "crm", new Set(["crm", "db"]), {
      transfers: [tr("t1", "US", { assetIds: ["crm"] }), tr("t2", "IN", { assetIds: ["db"] })],
      vendors: [{ id: "v1", name: "Mailer", unrecordedCountries: [] }],
    });
    expect(layer.nodes.map((n) => n.id)).toEqual(["country:US"]);
    expect(layer.edges).toHaveLength(1);
  });

  it("draws nothing without transfer data", () => {
    expect(buildTransferLayer("all", undefined, new Set(), null)).toEqual({ nodes: [], edges: [] });
  });
});

describe("transfer overlay (server)", () => {
  const assets = [
    { id: "crm", name: "CRM", type: "CLOUD_SERVICE" },
    { id: "shop", name: "Web Shop", type: "APPLICATION" },
  ];

  it("places a transfer on the system named like its linked vendor", () => {
    const o = transferOverlay(
      assets,
      [{ id: "t1", destinationCountry: "US", destinationOrg: "Someone else", vendorId: "v1", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" }],
      new Map(),
      [{ id: "v1", name: "crm", countries: ["US"] }]
    );
    expect(o.markers.map((m) => m.assetId)).toEqual(["crm"]);
    expect(o.transfers[0]).toMatchObject({ assetIds: ["crm"], vendorId: "v1", status: "NEEDS_REVIEW", suggested: true });
    // The vendor is the CRM system: no node of its own, no unrecorded country.
    expect(o.vendors).toEqual([]);
    expect(o.markers[0]!.unrecordedCountries).toEqual([]);
  });

  it("uses the recorded status when there is one, and never shows the EEA", () => {
    const o = transferOverlay(
      assets,
      [
        { id: "t1", destinationCountry: "US", destinationOrg: "CRM", complianceStatus: "COMPLIANT", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" },
        { id: "t2", destinationCountry: "el", destinationOrg: "CRM", mechanism: "OTHER" },
      ],
      new Map()
    );
    expect(o.transfers.map((t) => [t.id, t.status, t.suggested])).toEqual([["t1", "COMPLIANT", false]]);
  });

  it("gives a vendor no system stands for its own node, with its unrecorded countries", () => {
    const o = transferOverlay(
      assets,
      [{ id: "t1", destinationCountry: "IN", vendorId: "v2", mechanism: "STANDARD_CONTRACTUAL_CLAUSES" }],
      new Map(),
      [{ id: "v2", name: "Payroll Ltd", countries: ["IN", "US", "DE", "UK"] }]
    );
    expect(o.vendors).toEqual([{ id: "v2", name: "Payroll Ltd", unrecordedCountries: ["GB", "US"] }]);
    expect(o.transfers[0]).toMatchObject({ assetIds: [], vendorId: "v2" });
  });

  it("flags a system's vendor countries with no transfer record", () => {
    const o = transferOverlay(assets, [], new Map(), [{ id: "v3", name: "Web Shop", countries: ["US", "FR", "EU", "EEA"] }]);
    expect(o.markers).toEqual([
      expect.objectContaining({ assetId: "shop", transferIds: [], unrecordedCountries: ["US"] }),
    ]);
  });
});

describe("catalogue locations in the quick start", () => {
  it("reads EU, EEA, EU-member and UK locations as needing no SCC transfer", () => {
    for (const raw of ["EU", "EEA", "EU (Germany)", "EU: Belgium (europe-west1)", "Ireland (multi-tenant SaaS)", "DE", "Europe"]) {
      const loc = resolveCatalogLocation(raw);
      if (raw === "Europe") expect(loc.kind, raw).toBe("UNRESOLVED");
      else expect(loc.kind, raw).toBe("EEA");
    }
    expect(resolveCatalogLocation("UK")).toEqual({ kind: "COUNTRY", code: "GB" });
    expect(requiresTransferSafeguards("UK")).toBe(false);
    expect(requiresTransferSafeguards("GB")).toBe(false);
  });

  it("reads country names as codes and keeps the rest to record by hand", () => {
    expect(resolveCatalogLocation("India (authentication data)")).toEqual({ kind: "COUNTRY", code: "IN" });
    expect(resolveCatalogLocation("United States (default endpoint)")).toEqual({ kind: "COUNTRY", code: "US" });
    expect(resolveCatalogLocation("Brazil (Sao Paulo)")).toEqual({ kind: "COUNTRY", code: "BR" });
    expect(resolveCatalogLocation("APAC").kind).toBe("UNRESOLVED");
  });

  it("asks for a transfer for the US, Canada and countries without adequacy, once each", () => {
    expect(
      transferDestinationsFor(["US", "United States (storage at rest)", "EU", "UK", "SG", "AU", "India", "CA", "BR", "JP", "APAC"])
    ).toEqual({ countries: ["US", "SG", "AU", "IN", "CA"], unresolved: ["APAC"] });
  });

  it("recognises a declared EU-US Data Privacy Framework certification", () => {
    expect(declaresDpf({ transferSafeguards: "EU-U.S. Data Privacy Framework, UK Extension" })).toBe(true);
    expect(declaresDpf({ frameworks: ["DPF"] })).toBe(true);
    expect(declaresDpf({ transferSafeguards: "EU Standard Contractual Clauses" })).toBe(false);
    expect(declaresDpf({})).toBe(false);
  });
});
