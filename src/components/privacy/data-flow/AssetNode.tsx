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
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import type { AssetNodeData } from "./useDataFlowGraph";
import {
  ASSET_TYPE_COLOR,
  SENSITIVITY_COLOR,
  abbrevCategory,
} from "./flow-palette";

const assetTypeIcons: Record<string, typeof Database> = {
  DATABASE: Server,
  APPLICATION: Database,
  CLOUD_SERVICE: Cloud,
  THIRD_PARTY: Building2,
  FILE_SYSTEM: FileSpreadsheet,
  PHYSICAL: HardDrive,
  OTHER: Box,
};

type AssetNodeProps = NodeProps<Node<AssetNodeData>>;

function AssetNodeComponent({ data, selected }: AssetNodeProps) {
  const {
    asset,
    incomingFlows,
    outgoingFlows,
    topCategories,
    peakSensitivity,
    isFocused,
    isDimmed,
  } = data;

  const Icon = assetTypeIcons[asset.type] || Box;
  const palette = ASSET_TYPE_COLOR[asset.type] ?? ASSET_TYPE_COLOR.OTHER;
  const sensitivity = SENSITIVITY_COLOR[peakSensitivity];

  const ringColor =
    peakSensitivity === "special"
      ? sensitivity.stroke
      : peakSensitivity === "sensitive"
        ? sensitivity.stroke
        : null;

  return (
    <div
      className="group relative transition-all duration-200"
      style={{
        opacity: isDimmed ? 0.25 : 1,
        filter: isDimmed ? "saturate(0.4)" : undefined,
      }}
    >
      {/* Risk halo — subtle colored border ring sitting behind the card */}
      {ringColor && (
        <div
          className="absolute -inset-[3px] pointer-events-none"
          style={{
            backgroundColor: ringColor,
            opacity: selected || isFocused ? 0.35 : 0.18,
            transition: "opacity 200ms",
          }}
          aria-hidden
        />
      )}

      {/* Card — explicit light theme for max legibility; stays light even in the dark app */}
      <div
        className={`
          relative flex flex-col
          transition-shadow duration-200
          w-[220px]
          ${selected || isFocused ? "shadow-lg" : "shadow-sm"}
        `}
        style={{
          backgroundColor: "#ffffff",
          borderTop: `1px solid ${selected || isFocused ? palette.stripe : "#e2e8f0"}`,
          borderRight: `1px solid ${selected || isFocused ? palette.stripe : "#e2e8f0"}`,
          borderBottom: `1px solid ${selected || isFocused ? palette.stripe : "#e2e8f0"}`,
          borderLeft: `4px solid ${palette.stripe}`,
          boxShadow:
            selected || isFocused
              ? `0 10px 20px -8px ${palette.stripe}33`
              : undefined,
        }}
      >
        {/* Handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !border-0"
          style={{ background: palette.stripe, borderRadius: 0 }}
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !border-0"
          style={{ background: palette.stripe, borderRadius: 0 }}
        />

        {/* Top row: icon, name, environment indicator */}
        <div className="flex items-start gap-2 px-3 pt-3 pb-2">
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ backgroundColor: palette.soft }}
          >
            <Icon className="w-4 h-4" style={{ color: palette.stripe }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-[13px] leading-tight line-clamp-2"
              style={{ color: "#0f172a" }}
            >
              {asset.name}
            </h3>
            <p
              className="text-[10px] uppercase tracking-wider mt-0.5 font-medium"
              style={{ color: palette.text }}
            >
              {palette.label}
              {asset.vendor && asset.type === "THIRD_PARTY" ? ` · ${asset.vendor}` : ""}
            </p>
          </div>
          {asset.isProduction && (
            <span
              className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5"
              style={{ backgroundColor: "#dcfce7", color: "#166534" }}
              title="Production environment"
            >
              PROD
            </span>
          )}
        </div>

        {/* Data category chip preview */}
        {topCategories.length > 0 && (
          <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
            {topCategories.map((cat) => {
              const c =
                SENSITIVITY_COLOR[
                  classifyByCategoryInline(cat)
                ];
              return (
                <span
                  key={cat}
                  className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                  style={{
                    backgroundColor: c.bg,
                    color: c.fg,
                  }}
                  title={cat.replace(/_/g, " ").toLowerCase()}
                >
                  {abbrevCategory(cat)}
                </span>
              );
            })}
          </div>
        )}

        {/* Bottom row: flow counts */}
        {(incomingFlows > 0 || outgoingFlows > 0) && (
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[10px] font-medium"
            style={{
              borderTop: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: "#64748b",
            }}
          >
            <span className="flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3" />
              <span className="font-semibold" style={{ color: "#0f172a" }}>{incomingFlows}</span>
              <span>in</span>
            </span>
            <span className="flex items-center gap-1">
              <span>out</span>
              <span className="font-semibold" style={{ color: "#0f172a" }}>{outgoingFlows}</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Local, safer classification for single-category chips (avoids over-tagging "general")
function classifyByCategoryInline(
  cat: string
): "special" | "sensitive" | "general" | "none" {
  const special = new Set([
    "HEALTH",
    "BIOMETRIC",
    "GENETIC",
    "POLITICAL",
    "RELIGIOUS",
    "SEXUAL_ORIENTATION",
    "CRIMINAL",
  ]);
  const sensitive = new Set(["IDENTIFIERS", "FINANCIAL"]);
  if (special.has(cat)) return "special";
  if (sensitive.has(cat)) return "sensitive";
  return "general";
}

export const AssetNode = memo(AssetNodeComponent);
