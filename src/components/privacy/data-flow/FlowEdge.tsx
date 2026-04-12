"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { FlowEdgeData } from "./useDataFlowGraph";

type FlowEdgeProps = EdgeProps<Edge<FlowEdgeData>>;

function FlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style = {},
}: FlowEdgeProps) {
  const isReturn = data?.isReturn ?? false;
  const isBidirectional = data?.isBidirectional ?? false;

  // Offset return edges vertically so bidirectional pairs don't overlap
  const offset = isReturn ? 30 : isBidirectional ? -30 : 0;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: sourceY + offset,
    sourcePosition,
    targetX,
    targetY: targetY + offset,
    targetPosition,
  });

  const flow = data?.flow;
  const categoryCount = flow?.dataCategories?.length || 0;
  const label = isBidirectional
    ? flow?.name || "Flow"
    : categoryCount > 0
      ? `${categoryCount} categories`
      : flow?.name || "Flow";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)",
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: isReturn ? "6 3" : undefined,
        }}
        markerEnd="url(#arrowhead)"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className={`
            px-2 py-0.5 text-[10px] font-medium
            bg-background border border-border
            transition-all duration-200 cursor-pointer
            ${selected ? "border-primary text-primary" : "text-muted-foreground"}
          `}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const FlowEdge = memo(FlowEdgeComponent);
