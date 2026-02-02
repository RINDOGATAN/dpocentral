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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const flow = data?.flow;
  const categoryCount = flow?.dataCategories?.length || 0;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)",
          strokeWidth: selected ? 3 : 2,
        }}
        markerEnd="url(#arrowhead)"
      />
      {/* Edge label showing data category count */}
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
          {categoryCount > 0 ? `${categoryCount} categories` : flow?.name || "Flow"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const FlowEdge = memo(FlowEdgeComponent);
