"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Database } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

import { AssetNode } from "./AssetNode";
import { FlowEdge } from "./FlowEdge";
import { FlowDetailsPanel } from "./FlowDetailsPanel";
import { CreateFlowSheet, type CreateFlowData } from "./CreateFlowSheet";
import {
  useDataFlowGraph,
  type FlowData,
  type AssetData,
  type AssetNode as AssetNodeType,
  type FlowEdge as FlowEdgeType,
} from "./useDataFlowGraph";

const nodeTypes = {
  assetNode: AssetNode,
};

const edgeTypes = {
  flowEdge: FlowEdge,
};

interface DataFlowVisualizationProps {
  mode: "all" | "asset";
  organizationId: string;
  assetId?: string;
  height?: string;
}

export function DataFlowVisualization({
  mode,
  organizationId,
  assetId,
  height = "500px",
}: DataFlowVisualizationProps) {
  const router = useRouter();
  const [selectedFlow, setSelectedFlow] = useState<FlowData | null>(null);
  const [isFlowPanelOpen, setIsFlowPanelOpen] = useState(false);
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);

  // Fetch data
  const { data: assetsData, isLoading: assetsLoading } = trpc.dataInventory.listAssets.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const { data: flowsData, isLoading: flowsLoading } = trpc.dataInventory.listFlows.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const utils = trpc.useUtils();

  const createFlow = trpc.dataInventory.createFlow.useMutation({
    onSuccess: () => {
      utils.dataInventory.listFlows.invalidate();
      setIsCreateFlowOpen(false);
    },
  });

  const deleteFlow = trpc.dataInventory.deleteFlow.useMutation({
    onSuccess: () => {
      utils.dataInventory.listFlows.invalidate();
      setIsFlowPanelOpen(false);
      setSelectedFlow(null);
    },
  });

  const isLoading = assetsLoading || flowsLoading;

  // Transform assets to our format
  const assets: AssetData[] = useMemo(() => {
    return (assetsData?.assets ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      type: a.type,
      owner: a.owner,
      location: a.location,
      hostingType: a.hostingType,
      vendor: a.vendor,
      isProduction: a.isProduction,
    }));
  }, [assetsData]);

  // Transform flows to our format
  const flows: FlowData[] = useMemo(() => {
    return (flowsData ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      sourceAssetId: f.sourceAssetId,
      destinationAssetId: f.destinationAssetId,
      dataCategories: f.dataCategories as string[],
      frequency: f.frequency,
      volume: f.volume,
      encryptionMethod: f.encryptionMethod,
      isAutomated: f.isAutomated,
      sourceAsset: {
        id: f.sourceAsset.id,
        name: f.sourceAsset.name,
        description: f.sourceAsset.description,
        type: f.sourceAsset.type,
        owner: f.sourceAsset.owner,
        location: f.sourceAsset.location,
        hostingType: f.sourceAsset.hostingType,
        vendor: f.sourceAsset.vendor,
        isProduction: f.sourceAsset.isProduction,
      },
      destinationAsset: {
        id: f.destinationAsset.id,
        name: f.destinationAsset.name,
        description: f.destinationAsset.description,
        type: f.destinationAsset.type,
        owner: f.destinationAsset.owner,
        location: f.destinationAsset.location,
        hostingType: f.destinationAsset.hostingType,
        vendor: f.destinationAsset.vendor,
        isProduction: f.destinationAsset.isProduction,
      },
    }));
  }, [flowsData]);

  // Build graph
  const { nodes: graphNodes, edges: graphEdges } = useDataFlowGraph({
    mode,
    assetId,
    assets,
    flows,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<AssetNodeType>(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(graphEdges);

  // Update nodes/edges when data changes
  useEffect(() => {
    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [graphNodes, graphEdges, setNodes, setEdges]);

  // Handle node double-click - navigate to asset detail
  const handleNodeDoubleClick: NodeMouseHandler<AssetNodeType> = useCallback(
    (_event, node) => {
      router.push(`/privacy/data-inventory/${node.id}`);
    },
    [router]
  );

  // Handle edge click - show flow details
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: FlowEdgeType) => {
      if (edge.data?.flow) {
        setSelectedFlow(edge.data.flow);
        setIsFlowPanelOpen(true);
      }
    },
    []
  );

  // Handle create flow
  const handleCreateFlow = (data: CreateFlowData) => {
    createFlow.mutate({
      organizationId,
      name: data.name,
      description: data.description,
      sourceAssetId: data.sourceAssetId,
      destinationAssetId: data.destinationAssetId,
      dataCategories: data.dataCategories,
      frequency: data.frequency || undefined,
      volume: data.volume || undefined,
      encryptionMethod: data.encryptionMethod || undefined,
      isAutomated: data.isAutomated,
    });
  };

  // Handle delete flow
  const handleDeleteFlow = (flow: FlowData) => {
    if (!confirm(`Delete flow "${flow.name}"?`)) return;
    deleteFlow.mutate({ organizationId, id: flow.id });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Loading data flow visualization...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No data assets found</p>
          <p className="text-sm mb-4">Add data assets first to visualize data flows</p>
          <Button onClick={() => router.push("/privacy/data-inventory/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No flows state
  if (flows.length === 0 && mode === "all") {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No data flows defined yet</p>
          <p className="text-sm mb-4">Create flows to visualize how data moves between systems</p>
          <Button onClick={() => setIsCreateFlowOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Flow
          </Button>
          <CreateFlowSheet
            isOpen={isCreateFlowOpen}
            onClose={() => setIsCreateFlowOpen(false)}
            assets={assets}
            onSubmit={handleCreateFlow}
            isSubmitting={createFlow.isPending}
            error={createFlow.error?.message}
          />
        </CardContent>
      </Card>
    );
  }

  // Asset mode with no connected flows
  if (mode === "asset" && nodes.length <= 1) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No data flows connected to this asset</p>
          <p className="text-sm mb-4">Create a flow to connect this asset to other systems</p>
          <Button onClick={() => setIsCreateFlowOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Flow
          </Button>
          <CreateFlowSheet
            isOpen={isCreateFlowOpen}
            onClose={() => setIsCreateFlowOpen(false)}
            assets={assets}
            onSubmit={handleCreateFlow}
            isSubmitting={createFlow.isPending}
            error={createFlow.error?.message}
            defaultSourceId={assetId}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div style={{ height }} className="relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeClick={handleEdgeClick as never}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              type: "flowEdge",
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color="hsl(var(--border))"
              gap={20}
              size={1}
            />
            <Controls
              showInteractive={false}
              className="!bg-background !border-border [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
              style={{ borderRadius: 0 }}
            />
            {mode === "all" && (
              <MiniMap
                nodeColor="hsl(var(--primary))"
                maskColor="hsl(var(--background) / 0.8)"
                className="!bg-card !border-border"
                style={{ borderRadius: 0 }}
              />
            )}

            {/* Custom toolbar */}
            <Panel position="top-right" className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateFlowOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Flow
              </Button>
            </Panel>

            {/* SVG Marker for arrow heads */}
            <svg style={{ position: "absolute", top: 0, left: 0 }}>
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="6"
                  orient="auto"
                >
                  <path
                    d="M2,2 L10,6 L2,10 L4,6 Z"
                    fill="hsl(var(--primary))"
                  />
                </marker>
              </defs>
            </svg>
          </ReactFlow>
        </div>
      </Card>

      {/* Flow Details Panel */}
      <FlowDetailsPanel
        flow={selectedFlow}
        isOpen={isFlowPanelOpen}
        onClose={() => {
          setIsFlowPanelOpen(false);
          setSelectedFlow(null);
        }}
        onDelete={handleDeleteFlow}
      />

      {/* Create Flow Sheet */}
      <CreateFlowSheet
        isOpen={isCreateFlowOpen}
        onClose={() => setIsCreateFlowOpen(false)}
        assets={assets}
        onSubmit={handleCreateFlow}
        isSubmitting={createFlow.isPending}
        error={createFlow.error?.message}
        defaultSourceId={mode === "asset" ? assetId : undefined}
      />
    </>
  );
}
