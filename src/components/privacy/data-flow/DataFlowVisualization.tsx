"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type Node,
  type Edge,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2, Plus, Database, List, Network } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

import { AssetNode } from "./AssetNode";
import { CountryNode, TransferEdge, VendorNode } from "./TransferLayer";
import { FlowEdge } from "./FlowEdge";
import { FlowDetailsPanel } from "./FlowDetailsPanel";
import { CreateFlowSheet, type CreateFlowData } from "./CreateFlowSheet";
import {
  FlowFilterToolbar,
  DEFAULT_FILTERS,
  type FlowFilters,
} from "./FlowFilterToolbar";
import { classifyCategories, legendCategories } from "./flow-palette";
import { FlowLegend } from "./FlowLegend";
import { FlowListView } from "./FlowListView";
import { DataCategory } from "@prisma/client";
import {
  useDataFlowGraph,
  type FlowData,
  type AssetData,
  type AssetNode as AssetNodeType,
  type FlowEdge as FlowEdgeType,
} from "./useDataFlowGraph";
import { useOrgRole } from "@/lib/use-org-role";

const nodeTypes = {
  assetNode: AssetNode,
  vendorNode: VendorNode,
  countryNode: CountryNode,
};

const edgeTypes = {
  flowEdge: FlowEdge,
  transferEdge: TransferEdge,
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
  const { canWrite, isAdmin } = useOrgRole();
  const t = useTranslations("toasts");
  const tFlow = useTranslations("dataFlow");
  const tConfirm = useTranslations("confirms");
  const tCommon = useTranslations("common");
  const [pendingDeleteFlow, setPendingDeleteFlow] = useState<FlowData | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<FlowData | null>(null);
  const [isFlowPanelOpen, setIsFlowPanelOpen] = useState(false);
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<FlowData | null>(null);

  // Fetch data
  // The largest page the procedure serves: the add-flow sheet offers every
  // system (the default page of 50 left the rest out of reach).
  const { data: assetsData, isLoading: assetsLoading } = trpc.dataInventory.listAssets.useQuery(
    { organizationId, limit: 500 },
    { enabled: !!organizationId }
  );

  const { data: flowsData, isLoading: flowsLoading } = trpc.dataInventory.listFlows.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const { data: transferOverlay } = trpc.dataInventory.mapTransferMarkers.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );

  const utils = trpc.useUtils();

  const createFlow = trpc.dataInventory.createFlow.useMutation({
    onSuccess: () => {
      toast.success(t("dataFlow.created"));
      // Flows, systems and transfer markers all feed the map.
      utils.dataInventory.invalidate();
      setIsCreateFlowOpen(false);
    },
    onError: () => toast.error(t("dataFlow.createFailed")),
  });

  const updateFlow = trpc.dataInventory.updateFlow.useMutation({
    onSuccess: () => {
      toast.success(t("dataFlow.updated"));
      utils.dataInventory.invalidate();
      setEditingFlow(null);
      setIsFlowPanelOpen(false);
      setSelectedFlow(null);
    },
    onError: () => toast.error(t("dataFlow.updateFailed")),
  });

  const deleteFlow = trpc.dataInventory.deleteFlow.useMutation({
    onSuccess: () => {
      toast.success(t("dataFlow.deleted"));
      utils.dataInventory.invalidate();
      setIsFlowPanelOpen(false);
      setSelectedFlow(null);
    },
    onError: () => toast.error(t("dataFlow.deleteFailed")),
  });

  const confirmFlow = trpc.dataInventory.confirmFlow.useMutation({
    onSuccess: () => {
      toast.success(tFlow("details.confirmed"));
      utils.dataInventory.invalidate();
      setIsFlowPanelOpen(false);
      setSelectedFlow(null);
    },
    onError: () => toast.error(t("dataFlow.updateFailed")),
  });

  const dataLoading = assetsLoading || flowsLoading;

  // Transform assets to our format
  const markerByAsset = useMemo(
    () =>
      new Map(
        (transferOverlay?.markers ?? []).map((m) => [
          m.assetId,
          {
            transferIds: m.transferIds,
            countries: m.countries,
            transfers: m.transfers,
            worstStatus: m.worstStatus,
            unrecordedCountries: m.unrecordedCountries,
          },
        ])
      ),
    [transferOverlay]
  );
  const transferLayer = useMemo(
    () =>
      transferOverlay
        ? { transfers: transferOverlay.transfers, vendors: transferOverlay.vendors }
        : null,
    [transferOverlay]
  );
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
      transfersOutsideEea: markerByAsset.get(a.id) ?? null,
    }));
  }, [assetsData, markerByAsset]);

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

  // The categories the map shows, for the key under it.
  const shownCategories = useMemo(
    () => legendCategories(flows),
    [flows]
  );

  // Build graph
  const {
    nodes: graphNodes,
    edges: graphEdges,
    overlayNodes,
    transferEdges,
    isLoading: graphLoading,
    summary,
  } = useDataFlowGraph({
    mode,
    assetId,
    assets,
    flows,
    transferLayer,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ─── Filter + focus state ────────────────────────────────────────────────
  const [filters, setFilters] = useState<FlowFilters>(DEFAULT_FILTERS);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  // Map or list (the list reads the same records, for keyboard, screen
  // reader and phone use, and for an auditor's review).
  const [view, setView] = useState<"map" | "list">("map");
  // On a phone the list is the readable view: start there.
  useEffect(() => {
    try {
      if (window.matchMedia("(max-width: 639px)").matches) setView("list");
    } catch {
      /* no matchMedia: keep the map */
    }
  }, []);

  // Processing activities, for the activity filter.
  const { data: activitiesPage } = trpc.dataInventory.listActivities.useQuery(
    { organizationId, limit: 500, isActive: true },
    { enabled: !!organizationId && mode === "all" }
  );
  const activityOptions = useMemo(
    () =>
      (activitiesPage?.activities ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        assetIds: a.assets.map((l) => l.dataAssetId),
      })),
    [activitiesPage]
  );

  const openFlow = useCallback((flow: FlowData) => {
    setSelectedFlow(flow);
    setIsFlowPanelOpen(true);
  }, []);

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
    const activitySystems = filters.activityId
      ? new Set(activityOptions.find((a) => a.id === filters.activityId)?.assetIds ?? [])
      : null;
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

      if (activitySystems) {
        const fromActivity =
          (flow.metadata as { activityId?: string } | null | undefined)?.activityId === filters.activityId;
        const between = activitySystems.has(flow.sourceAssetId) && activitySystems.has(flow.destinationAssetId);
        if (!fromActivity && !between) return false;
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
          onSelect: openFlow,
        },
      };
    });

    const filtering =
      filters.sensitivity !== "all" ||
      !filters.showAutoGenerated ||
      filters.categories.size > 0 ||
      !!filters.activityId;
    const displayNodes = graphNodes.map((n): AssetNodeType => {
      const hasVisibleEdge = activeAssetIds.has(n.id);
      // A system without flows is drawn at full strength until a filter is on.
      const dim =
        (activitySystems ? !activitySystems.has(n.id) && !hasVisibleEdge : false) ||
        (!activitySystems && !hasVisibleEdge && (filtering || !n.data.isIsolated)) ||
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
  }, [graphNodes, graphEdges, filters, focusedNodeId, openFlow, activityOptions]);

  // Update nodes/edges whenever derived output changes. A new layout places
  // the nodes; a hover or a filter keeps where the person dragged them.
  const laidOutFrom = useRef<AssetNodeType[] | null>(null);
  useEffect(() => {
    const freshLayout = laidOutFrom.current !== graphNodes;
    laidOutFrom.current = graphNodes;
    // Transfer edges and country/vendor nodes dim with the focus like the rest.
    const focusTouches = (id: string) =>
      !focusedNodeId ||
      id === focusedNodeId ||
      transferEdges.some(
        (e) =>
          (e.source === focusedNodeId && e.target === id) ||
          (e.target === focusedNodeId && e.source === id)
      );
    const overlay: Node[] = overlayNodes.map((n) => ({
      ...n,
      data: { ...n.data, isDimmed: !focusTouches(n.id) },
    }));
    const tEdges: Edge[] = transferEdges.map((e) => ({
      ...e,
      data: {
        ...e.data!,
        isDimmed: !!focusedNodeId && e.source !== focusedNodeId && e.target !== focusedNodeId,
      },
    }));
    const next: Node[] = [...displayNodes, ...overlay];
    setNodes((prev) => {
      if (freshLayout) return next;
      const at = new Map(prev.map((n) => [n.id, n.position]));
      return next.map((n) => ({ ...n, position: at.get(n.id) ?? n.position }));
    });
    setEdges([...displayEdges, ...tEdges]);
  }, [graphNodes, displayNodes, displayEdges, overlayNodes, transferEdges, focusedNodeId, setNodes, setEdges]);

  const handleNodeMouseEnter: NodeMouseHandler<Node> = useCallback(
    (_e, node) => setFocusedNodeId(node.id),
    []
  );
  const handleNodeMouseLeave: NodeMouseHandler<Node> = useCallback(
    () => setFocusedNodeId(null),
    []
  );

  // Handle node double-click - navigate to asset detail
  const nodeHref = useCallback((id: string): string | null => {
    if (id.startsWith("vendor:")) return `/privacy/vendors/${id.slice("vendor:".length)}`;
    if (id.startsWith("country:")) return "/privacy/transfers";
    return `/privacy/data-inventory/${id}`;
  }, []);
  const handleNodeDoubleClick: NodeMouseHandler<Node> = useCallback(
    (_event, node) => {
      const href = nodeHref(node.id);
      if (href) router.push(href);
    },
    [router, nodeHref]
  );

  // Handle edge click - show flow details
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const flow = (edge as FlowEdgeType).data?.flow;
      if (edge.type === "flowEdge" && flow) openFlow(flow);
    },
    [openFlow]
  );

  // Keyboard: Enter or Space on a focused system opens it; on a focused
  // flow, its details.
  const flowById = useMemo(() => new Map(flows.map((f) => [f.id, f])), [flows]);
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".react-flow__node");
      const nodeId = nodeEl?.getAttribute("data-id");
      if (nodeId) {
        const href = nodeHref(nodeId);
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      const edgeEl = target.closest(".react-flow__edge");
      const edgeId = edgeEl?.getAttribute("data-id") ?? edgeEl?.getAttribute("data-testid")?.replace(/^rf__edge-/, "");
      const flow = edgeId ? flowById.get(edgeId) : undefined;
      if (flow) {
        e.preventDefault();
        openFlow(flow);
      }
    },
    [router, flowById, openFlow, nodeHref]
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

  // Memoised: the edit sheet refills its form only when it opens, so a
  // failed save keeps the person's changes.
  const editInitialData: CreateFlowData | undefined = useMemo(
    () =>
      editingFlow
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
        : undefined,
    [editingFlow]
  );

  // The system types on the map, for the key.
  const shownTypes = useMemo(
    () => [...new Set(graphNodes.map((n) => n.data.asset.type))].sort(),
    [graphNodes]
  );
  const hasTransferBadges =
    graphNodes.some((n) => (n.data.asset.transfersOutsideEea?.transferIds.length ?? 0) > 0) ||
    overlayNodes.some((n) => n.data.kind === "country");
  const hasUnrecordedBadges =
    graphNodes.some((n) => (n.data.asset.transfersOutsideEea?.unrecordedCountries?.length ?? 0) > 0) ||
    overlayNodes.some((n) => n.data.kind === "vendor" && n.data.vendor.unrecordedCountries.length > 0);

  // Loading state: only before the first layout, so a later re-layout keeps
  // the canvas (and its zoom and pan) in place.
  if (dataLoading || (graphLoading && graphNodes.length === 0)) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>{tFlow("empty.loading")}</p>
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
          <p>{tFlow("empty.noAssetsTitle")}</p>
          <p className="text-sm mb-4">{tFlow("empty.noAssetsBody")}</p>
          <Button onClick={() => router.push("/privacy/data-inventory/new")}>
            <Plus className="w-4 h-4 mr-2" />
            {tFlow("actions.addAsset")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Asset mode with no connected flows
  if (mode === "asset" && graphNodes.length <= 1 && overlayNodes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{tFlow("empty.noAssetFlowsTitle")}</p>
          <p className="text-sm mb-4">{tFlow("empty.noAssetFlowsBody")}</p>
          {canWrite && (
            <Button onClick={() => setIsCreateFlowOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {tFlow("sheet.createFlow")}
            </Button>
          )}
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

  const noFlows = mode === "all" && summary.flows === 0;

  return (
    <>
      {/* Counts, and the switch between the map and the list */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p data-testid="flow-summary">
          {tFlow("summary.counts", {
            systems: summary.systems,
            flows: summary.flows,
            isolated: summary.isolatedSystems,
            transfers: summary.transfers,
            countries: summary.countries,
            vendors: summary.vendors,
          })}
        </p>
        <div className="flex gap-1" role="group" aria-label={tFlow("view.label")}>
          <Button
            type="button"
            size="sm"
            variant={view === "map" ? "default" : "outline"}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
            data-testid="flow-view-map"
          >
            <Network className="w-4 h-4 mr-1.5" aria-hidden />
            {tFlow("view.map")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            data-testid="flow-view-list"
          >
            <List className="w-4 h-4 mr-1.5" aria-hidden />
            {tFlow("view.list")}
          </Button>
        </div>
      </div>

      {/* Filters above the canvas, never over it (on a phone they wrap) */}
      {view === "map" && !noFlows && (
        <div className="mb-2">
          <FlowFilterToolbar
            filters={filters}
            onChange={setFilters}
            edgeCount={visibleEdgeCount}
            totalEdges={graphEdges.length}
            activities={activityOptions}
          />
        </div>
      )}

      {view === "list" ? (
        <FlowListView
          nodes={graphNodes}
          flows={graphEdges.map((e) => e.data!.flow)}
          overlay={overlayNodes}
          onOpenFlow={openFlow}
        />
      ) : (
      <Card className="overflow-hidden">
        {/* Mobile: 360px fixed (any taller is unusable on a phone). sm+: caller's height. */}
        <div
          className="relative h-[360px] sm:h-[var(--df-h)]"
          style={{ ["--df-h" as string]: height }}
          role="region"
          aria-label={tFlow("view.canvasLabel", { systems: summary.systems, flows: summary.flows })}
          onKeyDown={handleCanvasKeyDown}
        >
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
            fitViewOptions={{ padding: 0.12 }}
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
              // Light like the canvas it summarises (the app may be dark);
              // left out on a phone, where it would cover most of the map.
              <MiniMap
                nodeColor="#94a3b8"
                maskColor="rgba(226, 232, 240, 0.55)"
                className="!hidden sm:!block"
                style={{ borderRadius: 0, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}
              />
            )}


            {/* No flow yet: the systems are drawn; say how to join them */}
            {noFlows && (
              <Panel position="bottom-center" className="max-w-[calc(100%-24px)] sm:max-w-md">
                <div
                  className="border bg-white px-3 py-2 text-xs shadow-sm"
                  style={{ borderColor: "#e2e8f0", color: "#334155" }}
                  data-testid="flow-empty-hint"
                >
                  <p className="font-semibold" style={{ color: "#0f172a" }}>{tFlow("empty.noFlowsTitle")}</p>
                  <p className="mt-0.5">{tFlow("empty.noFlowsHint")}</p>
                </div>
              </Panel>
            )}

            {/* Add-flow CTA (right) */}
            <Panel position="top-right" className="flex gap-2">
              {canWrite && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateFlowOpen(true)}
                aria-label={tFlow("actions.addFlow")}
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                {/* Icon only on a phone, where the filters need the width. */}
                <span className="hidden sm:inline">{tFlow("actions.addFlow")}</span>
              </Button>
              )}
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
      )}
      <FlowLegend
        categories={shownCategories}
        types={shownTypes}
        showTransfers={hasTransferBadges}
        showUnrecorded={hasUnrecordedBadges}
      />

      {/* Flow Details Panel */}
      <FlowDetailsPanel
        // The latest copy of the flow, so a renamed system shows its new name.
        flow={selectedFlow ? flowById.get(selectedFlow.id) ?? selectedFlow : null}
        destinationTransfers={
          selectedFlow ? markerByAsset.get(selectedFlow.destinationAssetId) ?? null : null
        }
        isOpen={isFlowPanelOpen}
        onClose={() => {
          setIsFlowPanelOpen(false);
          setSelectedFlow(null);
        }}
        onEdit={canWrite ? handleEditFlow : undefined}
        onDelete={isAdmin ? handleDeleteFlow : undefined}
        onConfirm={canWrite ? (flow) => confirmFlow.mutate({ organizationId, id: flow.id }) : undefined}
        confirming={confirmFlow.isPending}
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
