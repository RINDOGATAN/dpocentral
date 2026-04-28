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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, Plus, Database } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

import { AssetNode } from "./AssetNode";
import { FlowEdge } from "./FlowEdge";
import { FlowDetailsPanel } from "./FlowDetailsPanel";
import { CreateFlowSheet, type CreateFlowData } from "./CreateFlowSheet";
import {
  FlowFilterToolbar,
  DEFAULT_FILTERS,
  type FlowFilters,
} from "./FlowFilterToolbar";
import { classifyCategories } from "./flow-palette";
import { DataCategory } from "@prisma/client";
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
  const t = useTranslations("toasts");
  const tConfirm = useTranslations("confirms");
  const tCommon = useTranslations("common");
  const [pendingDeleteFlow, setPendingDeleteFlow] = useState<FlowData | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<FlowData | null>(null);
  const [isFlowPanelOpen, setIsFlowPanelOpen] = useState(false);
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<FlowData | null>(null);

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
      toast.success(t("dataFlow.created"));
      utils.dataInventory.listFlows.invalidate();
      setIsCreateFlowOpen(false);
    },
    onError: (error) => toast.error(error.message || t("dataFlow.createFailed")),
  });

  const updateFlow = trpc.dataInventory.updateFlow.useMutation({
    onSuccess: () => {
      toast.success(t("dataFlow.updated"));
      utils.dataInventory.listFlows.invalidate();
      setEditingFlow(null);
      setIsFlowPanelOpen(false);
      setSelectedFlow(null);
    },
    onError: (error) => toast.error(error.message || t("dataFlow.updateFailed")),
  });

  const deleteFlow = trpc.dataInventory.deleteFlow.useMutation({
    onSuccess: () => {
      toast.success(t("dataFlow.deleted"));
      utils.dataInventory.listFlows.invalidate();
      setIsFlowPanelOpen(false);
      setSelectedFlow(null);
    },
    onError: (error) => toast.error(error.message || t("dataFlow.deleteFailed")),
  });

  const dataLoading = assetsLoading || flowsLoading;

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
      metadata: (f as { metadata?: unknown }).metadata,
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
  const { nodes: graphNodes, edges: graphEdges, isLoading: graphLoading } = useDataFlowGraph({
    mode,
    assetId,
    assets,
    flows,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<AssetNodeType>(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(graphEdges);

  // ─── Filter + focus state ────────────────────────────────────────────────
  const [filters, setFilters] = useState<FlowFilters>(DEFAULT_FILTERS);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  /**
   * Derive the displayed nodes/edges from graph + filters + focus.
   * Applies:
   *  - sensitivity filter (hide edges whose categories don't match the class)
   *  - category filter (hide edges lacking any selected category)
   *  - auto-generated toggle (hide auto-gen edges when off)
   *  - focus dim (edges not touching the focused node are dimmed)
   *  - orphan node dim (a node becomes dim if none of its visible edges survive)
   */
  const { displayNodes, displayEdges, visibleEdgeCount } = useMemo(() => {
    const edgePasses = (e: FlowEdgeType): boolean => {
      const flow = e.data?.flow;
      if (!flow) return false;

      if (!filters.showAutoGenerated && e.data?.isAutoGenerated) return false;

      if (filters.sensitivity !== "all") {
        if (classifyCategories(flow.dataCategories) !== filters.sensitivity) return false;
      }

      if (filters.categories.size > 0) {
        const hit = flow.dataCategories.some((c) => filters.categories.has(c));
        if (!hit) return false;
      }

      return true;
    };

    const kept = graphEdges.filter(edgePasses);
    const activeAssetIds = new Set<string>();
    for (const e of kept) {
      activeAssetIds.add(e.source);
      activeAssetIds.add(e.target);
    }

    // Focus neighbours (1-hop from the focused node)
    const focusNeighbours = new Set<string>();
    if (focusedNodeId) {
      focusNeighbours.add(focusedNodeId);
      for (const e of kept) {
        if (e.source === focusedNodeId) focusNeighbours.add(e.target);
        else if (e.target === focusedNodeId) focusNeighbours.add(e.source);
      }
    }

    const displayEdges = graphEdges.map((e): FlowEdgeType => {
      const pass = edgePasses(e);
      const touchesFocus =
        !focusedNodeId ||
        e.source === focusedNodeId ||
        e.target === focusedNodeId;
      return {
        ...e,
        hidden: !pass,
        data: {
          ...e.data!,
          isDimmed: pass && focusedNodeId !== null && !touchesFocus,
        },
      };
    });

    const displayNodes = graphNodes.map((n): AssetNodeType => {
      const hasVisibleEdge = activeAssetIds.has(n.id);
      const dim =
        !hasVisibleEdge ||
        (focusedNodeId !== null && !focusNeighbours.has(n.id));
      return {
        ...n,
        data: {
          ...n.data,
          isDimmed: dim,
          isFocused:
            n.data.isFocused ||
            (focusedNodeId !== null && n.id === focusedNodeId),
        },
      };
    });

    return { displayNodes, displayEdges, visibleEdgeCount: kept.length };
  }, [graphNodes, graphEdges, filters, focusedNodeId]);

  // Update nodes/edges whenever derived output changes
  useEffect(() => {
    setNodes(displayNodes);
    setEdges(displayEdges);
  }, [displayNodes, displayEdges, setNodes, setEdges]);

  const handleNodeMouseEnter: NodeMouseHandler<AssetNodeType> = useCallback(
    (_e, node) => setFocusedNodeId(node.id),
    []
  );
  const handleNodeMouseLeave: NodeMouseHandler<AssetNodeType> = useCallback(
    () => setFocusedNodeId(null),
    []
  );

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
    setPendingDeleteFlow(flow);
  };
  const confirmDeleteFlow = () => {
    if (!pendingDeleteFlow) return;
    const id = pendingDeleteFlow.id;
    setPendingDeleteFlow(null);
    deleteFlow.mutate({ organizationId, id });
  };

  // Handle edit flow
  const handleEditFlow = (flow: FlowData) => {
    setEditingFlow(flow);
    setIsFlowPanelOpen(false);
  };

  const handleEditSubmit = (data: CreateFlowData) => {
    if (!editingFlow) return;
    const toNull = (v: string | undefined) => (v && v.length > 0 ? v : null);
    updateFlow.mutate({
      organizationId,
      id: editingFlow.id,
      name: data.name,
      description: toNull(data.description),
      sourceAssetId: data.sourceAssetId,
      destinationAssetId: data.destinationAssetId,
      dataCategories: data.dataCategories,
      frequency: toNull(data.frequency),
      volume: toNull(data.volume),
      encryptionMethod: toNull(data.encryptionMethod),
      isAutomated: data.isAutomated,
    });
  };

  const editInitialData: CreateFlowData | undefined = editingFlow
    ? {
        name: editingFlow.name,
        description: editingFlow.description ?? "",
        sourceAssetId: editingFlow.sourceAssetId,
        destinationAssetId: editingFlow.destinationAssetId,
        dataCategories: editingFlow.dataCategories as DataCategory[],
        frequency: editingFlow.frequency ?? "",
        volume: editingFlow.volume ?? "",
        encryptionMethod: editingFlow.encryptionMethod ?? "",
        isAutomated: editingFlow.isAutomated,
      }
    : undefined;

  // Loading state
  if (dataLoading || graphLoading) {
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
        {/* Mobile: 360px fixed (any taller is unusable on a phone). sm+: caller's height. */}
        <div className="relative h-[360px] sm:h-[var(--df-h)]" style={{ ["--df-h" as string]: height }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeMouseEnter={handleNodeMouseEnter}
            onNodeMouseLeave={handleNodeMouseLeave}
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
            style={{ backgroundColor: "#ffffff" }}
          >
            <Background
              color="#e2e8f0"
              gap={22}
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

            {/* Filter toolbar (left) */}
            <Panel position="top-left" className="max-w-[calc(100%-140px)]">
              <FlowFilterToolbar
                filters={filters}
                onChange={setFilters}
                edgeCount={visibleEdgeCount}
                totalEdges={graphEdges.length}
              />
            </Panel>

            {/* Add-flow CTA (right) */}
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

            {/* SVG markers — one arrowhead per sensitivity class */}
            <svg style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0 }}>
              <defs>
                {[
                  { id: "arrowhead-special", color: "#dc2626" },
                  { id: "arrowhead-sensitive", color: "#d97706" },
                  { id: "arrowhead-general", color: "#2563eb" },
                  { id: "arrowhead-none", color: "#94a3b8" },
                ].map((m) => (
                  <marker
                    key={m.id}
                    id={m.id}
                    markerWidth="12"
                    markerHeight="12"
                    refX="10"
                    refY="6"
                    orient="auto"
                  >
                    <path d="M2,2 L10,6 L2,10 L4,6 Z" fill={m.color} />
                  </marker>
                ))}
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
        onEdit={handleEditFlow}
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

      {/* Edit Flow Sheet */}
      <CreateFlowSheet
        mode="edit"
        isOpen={!!editingFlow}
        onClose={() => setEditingFlow(null)}
        assets={assets}
        onSubmit={handleEditSubmit}
        isSubmitting={updateFlow.isPending}
        error={updateFlow.error?.message}
        initialData={editInitialData}
      />

      <ConfirmDialog
        open={!!pendingDeleteFlow}
        onOpenChange={(open) => !open && setPendingDeleteFlow(null)}
        title={tConfirm("deleteFlowTitle")}
        description={tConfirm("deleteFlowDesc", { name: pendingDeleteFlow?.name ?? "" })}
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        danger
        pending={deleteFlow.isPending}
        onConfirm={confirmDeleteFlow}
      />
    </>
  );
}
