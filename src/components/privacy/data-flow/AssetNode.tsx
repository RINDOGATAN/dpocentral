"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import {
  Database,
  Server,
  Cloud,
  Building2,
  FileSpreadsheet,
  HardDrive,
  Box,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AssetNodeData } from "./useDataFlowGraph";

const assetTypeIcons: Record<string, typeof Database> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
  PHYSICAL: HardDrive,
  OTHER: Box,
};

const assetTypeLabels: Record<string, string> = {
  DATABASE: "Database",
  APPLICATION: "Application",
  CLOUD_SERVICE: "Cloud",
  THIRD_PARTY: "Third Party",
  FILE_SYSTEM: "File System",
  PHYSICAL: "Physical",
  OTHER: "Other",
};

type AssetNodeProps = NodeProps<Node<AssetNodeData>>;

function AssetNodeComponent({ data, selected }: AssetNodeProps) {
  const { asset, incomingFlows, outgoingFlows, isFocused } = data;
  const Icon = assetTypeIcons[asset.type] || Box;

  return (
    <div
      className={`
        relative bg-card border-2 p-3 min-w-[200px] max-w-[240px]
        transition-all duration-200
        ${selected || isFocused ? "border-primary shadow-lg shadow-primary/20" : "border-border"}
        ${isFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
      `}
      style={{ borderRadius: 0 }}
    >
      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
        style={{ borderRadius: 0 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
        style={{ borderRadius: 0 }}
      />

      {/* Header with icon and type */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="w-8 h-8 bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
          {assetTypeLabels[asset.type] || asset.type}
        </Badge>
      </div>

      {/* Asset name */}
      <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
        {asset.name}
      </h3>

      {/* Owner */}
      {asset.owner && (
        <p className="text-xs text-muted-foreground truncate mb-2">
          {asset.owner}
        </p>
      )}

      {/* Flow stats */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {incomingFlows > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-primary">&larr;</span>
            {incomingFlows} in
          </span>
        )}
        {outgoingFlows > 0 && (
          <span className="flex items-center gap-1">
            {outgoingFlows} out
            <span className="text-primary">&rarr;</span>
          </span>
        )}
      </div>

      {/* Production indicator */}
      {asset.isProduction && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-primary" title="Production" />
      )}
    </div>
  );
}

export const AssetNode = memo(AssetNodeComponent);
