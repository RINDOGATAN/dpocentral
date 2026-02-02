"use client";

import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import type { DataAssetType } from "@prisma/client";

export interface FlowData {
  id: string;
  name: string;
  description?: string | null;
  sourceAssetId: string;
  destinationAssetId: string;
  dataCategories: string[];
  frequency?: string | null;
  volume?: string | null;
  encryptionMethod?: string | null;
  isAutomated: boolean;
  sourceAsset: AssetData;
  destinationAsset: AssetData;
}

export interface AssetData {
  id: string;
  name: string;
  description?: string | null;
  type: DataAssetType;
  owner?: string | null;
  location?: string | null;
  hostingType?: string | null;
  vendor?: string | null;
  isProduction: boolean;
}

export interface AssetNodeData extends Record<string, unknown> {
  label: string;
  asset: AssetData;
  incomingFlows: number;
  outgoingFlows: number;
  isHighlighted?: boolean;
  isFocused?: boolean;
}

export interface FlowEdgeData extends Record<string, unknown> {
  flow: FlowData;
  label: string;
}

export type AssetNode = Node<AssetNodeData>;
export type FlowEdge = Edge<FlowEdgeData>;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

function getLayoutedElements(
  nodes: AssetNode[],
  edges: FlowEdge[],
  direction: "LR" | "TB" = "LR"
): { nodes: AssetNode[]; edges: FlowEdge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 150,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

interface UseDataFlowGraphOptions {
  mode: "all" | "asset";
  assetId?: string;
  assets: AssetData[];
  flows: FlowData[];
}

export function useDataFlowGraph({
  mode,
  assetId,
  assets,
  flows,
}: UseDataFlowGraphOptions) {
  const { nodes, edges } = useMemo(() => {
    // Filter assets and flows based on mode
    let relevantAssetIds: Set<string>;
    let relevantFlows: FlowData[];

    if (mode === "asset" && assetId) {
      // Find flows connected to this asset (1-hop neighbors)
      relevantFlows = flows.filter(
        (f) => f.sourceAssetId === assetId || f.destinationAssetId === assetId
      );

      // Collect asset IDs from these flows
      relevantAssetIds = new Set<string>();
      relevantAssetIds.add(assetId);
      relevantFlows.forEach((f) => {
        relevantAssetIds.add(f.sourceAssetId);
        relevantAssetIds.add(f.destinationAssetId);
      });
    } else {
      // Show all assets that have at least one flow
      relevantFlows = flows;
      relevantAssetIds = new Set<string>();
      flows.forEach((f) => {
        relevantAssetIds.add(f.sourceAssetId);
        relevantAssetIds.add(f.destinationAssetId);
      });
    }

    // Build asset map for quick lookup
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    // Calculate flow counts per asset
    const incomingFlowCounts = new Map<string, number>();
    const outgoingFlowCounts = new Map<string, number>();

    relevantFlows.forEach((flow) => {
      incomingFlowCounts.set(
        flow.destinationAssetId,
        (incomingFlowCounts.get(flow.destinationAssetId) || 0) + 1
      );
      outgoingFlowCounts.set(
        flow.sourceAssetId,
        (outgoingFlowCounts.get(flow.sourceAssetId) || 0) + 1
      );
    });

    // Create nodes
    const nodes: AssetNode[] = [];
    for (const id of relevantAssetIds) {
      const asset = assetMap.get(id);
      if (!asset) continue;

      nodes.push({
        id: asset.id,
        type: "assetNode",
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          label: asset.name,
          asset,
          incomingFlows: incomingFlowCounts.get(asset.id) || 0,
          outgoingFlows: outgoingFlowCounts.get(asset.id) || 0,
          isHighlighted: false,
          isFocused: mode === "asset" && asset.id === assetId,
        },
      });
    }

    // Create edges
    const edges: FlowEdge[] = relevantFlows.map((flow) => ({
      id: flow.id,
      source: flow.sourceAssetId,
      target: flow.destinationAssetId,
      type: "flowEdge",
      animated: flow.isAutomated,
      data: {
        flow,
        label: flow.name,
      },
    }));

    // Apply layout
    if (nodes.length > 0) {
      return getLayoutedElements(nodes, edges, "LR");
    }

    return { nodes, edges };
  }, [mode, assetId, assets, flows]);

  return { nodes, edges };
}
