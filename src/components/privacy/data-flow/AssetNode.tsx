"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  Globe2,
  MapPin,
} from "lucide-react";
import type { AssetNodeData } from "./useDataFlowGraph";
import {
  ASSET_TYPE_COLOR,
  SENSITIVITY_COLOR,
  TRANSFER_STATUS_COLOR,
  chipSensitivity,
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
  const t = useTranslations("dataFlow.node");
  // Type label comes from the shared asset-type messages; flow-palette.ts
  // stays colours-only so it never carries untranslatable copy.
  const tAssetType = useTranslations("pages.newAsset.assetType");
  const tAbbr = useTranslations("dataFlow.abbr");
  const tCategory = useTranslations("enums.dataCategory");
  const tMech = useTranslations("pages.dataInventory.mechanism");
  const tStatus = useTranslations("pages.transfers.status_option");
  const {
    asset,
    incomingFlows,
    outgoingFlows,
    topCategories,
    moreCategories,
    isIsolated,
    peakSensitivity,
    isFocused,
    isDimmed,
  } = data;
  const marker = asset.transfersOutsideEea;
  const hasRecordedTransfers = !!marker && marker.transferIds.length > 0;
  const unrecorded = marker?.unrecordedCountries ?? [];
  const markerStatus = marker?.worstStatus ?? "PENDING";
  const markerColor = TRANSFER_STATUS_COLOR[markerStatus];
  // One line per transfer: country, safeguard, status.
  const markerDetail = (marker?.transfers ?? [])
    .map((tr) =>
      t("transferLine", {
        country: tr.country,
        mechanism: tr.mechanism && tMech.has(tr.mechanism as never) ? tMech(tr.mechanism as never) : t("noMechanism"),
        status: tr.suggested ? t("suggestedStatus", { status: tStatus(tr.status) }) : tStatus(tr.status),
      })
    )
    .join("\n");

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
              {tAssetType(asset.type)}
              {asset.vendor && asset.type === "THIRD_PARTY" ? ` · ${asset.vendor}` : ""}
            </p>
          </div>
          {asset.isProduction && (
            <span
              className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5"
              style={{ backgroundColor: "#dcfce7", color: "#166534" }}
              title={t("productionTitle")}
            >
              {t("production")}
            </span>
          )}
        </div>

        {/* Location, and the transfers outside the EEA placed on this system */}
        {(asset.location || hasRecordedTransfers || unrecorded.length > 0) && (
          <div className="px-3 pb-2 flex flex-col gap-1">
            {asset.location && (
              <p
                className="flex items-center gap-1 text-[10px] leading-tight"
                style={{ color: "#475569" }}
                data-testid="node-location"
              >
                <MapPin className="w-3 h-3 shrink-0" aria-hidden />
                <span className="sr-only">{t("location")}: </span>
                <span className="truncate">{asset.location}</span>
              </p>
            )}
            {marker && hasRecordedTransfers && (
              <Link
                href={
                  marker.transferIds.length === 1
                    ? `/privacy/transfers/${marker.transferIds[0]}`
                    : "/privacy/transfers"
                }
                className="nodrag nopan self-start flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 hover:underline max-w-full"
                style={{ backgroundColor: markerColor.bg, color: markerColor.fg }}
                title={[t("outsideEeaTitle", { count: marker.transferIds.length }), markerDetail].filter(Boolean).join("\n")}
                onClick={(e) => e.stopPropagation()}
                data-testid="node-transfer-marker"
                data-status={markerStatus}
              >
                <Globe2 className="w-3 h-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {t("outsideEeaStatus", {
                    countries: marker.countries.join(", "),
                    status: tStatus(markerStatus),
                  })}
                </span>
                {markerDetail && <span className="sr-only">{markerDetail}</span>}
              </Link>
            )}
            {unrecorded.length > 0 && (
              <Link
                href="/privacy/transfers"
                className="nodrag nopan self-start flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 hover:underline max-w-full"
                style={{ backgroundColor: "#ffffff", color: "#991b1b", border: "1px dashed #dc2626" }}
                title={t("unrecordedTitle")}
                onClick={(e) => e.stopPropagation()}
                data-testid="node-unrecorded-transfer"
              >
                <Globe2 className="w-3 h-3 shrink-0" aria-hidden />
                <span className="truncate">{t("unrecorded", { countries: unrecorded.join(", ") })}</span>
              </Link>
            )}
          </div>
        )}

        {/* Data category chip preview */}
        {topCategories.length > 0 && (
          <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
            {topCategories.map((cat) => {
              const c =
                SENSITIVITY_COLOR[chipSensitivity(cat)];
              return (
                <span
                  key={cat}
                  className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                  style={{
                    backgroundColor: c.bg,
                    color: c.fg,
                  }}
                  title={tCategory.has(cat as never) ? tCategory(cat as never) : cat}
                >
                  {tAbbr.has(cat as never) ? tAbbr(cat as never) : cat.slice(0, 3)}
                </span>
              );
            })}
            {moreCategories > 0 && (
              <span
                className="text-[8px] font-bold px-1 py-0.5"
                style={{ color: "#475569" }}
                title={t("moreCategories", { count: moreCategories })}
              >
                +{moreCategories}
              </span>
            )}
          </div>
        )}

        {/* A system no recorded flow touches */}
        {isIsolated && (
          <div
            className="px-3 py-1.5 text-[10px] font-medium"
            style={{ borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#64748b" }}
            data-testid="node-no-flows"
          >
            {t("noFlows")}
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
              <span>{t("inbound")}</span>
            </span>
            <span className="flex items-center gap-1">
              <span>{t("outbound")}</span>
              <span className="font-semibold" style={{ color: "#0f172a" }}>{outgoingFlows}</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const AssetNode = memo(AssetNodeComponent);
