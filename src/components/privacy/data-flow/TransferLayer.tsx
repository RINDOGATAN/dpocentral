"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The transfer layer of the data map: a node per vendor that no system
 * stands for, a node per destination country outside the EEA, and an edge
 * per transfer (system or vendor to country) labelled with its safeguard
 * and coloured by its status. Light canvas colours, like the system cards.
 */

import { memo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Building2, Globe2 } from "lucide-react";
import { countryName } from "@/lib/country-code";
import { TRANSFER_STATUS_COLOR } from "./flow-palette";
import type { CountryNodeData, TransferEdgeData, VendorNodeData } from "./useDataFlowGraph";

const STATUS_STROKE = {
  COMPLIANT: "#16a34a",
  NEEDS_REVIEW: "#d97706",
  NON_COMPLIANT: "#dc2626",
  PENDING: "#64748b",
} as const;

function VendorNodeComponent({ data }: NodeProps<Node<VendorNodeData>>) {
  const t = useTranslations("dataFlow.node");
  const { vendor, isDimmed } = data;
  return (
    <div
      className="w-[200px] shadow-sm"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderLeft: "4px solid #d97706",
        opacity: isDimmed ? 0.25 : 1,
      }}
      data-testid="vendor-node"
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-0" style={{ background: "#d97706", borderRadius: 0 }} />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !border-0" style={{ background: "#d97706", borderRadius: 0 }} />
      <div className="flex items-start gap-2 px-3 py-2">
        <Building2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#d97706" }} aria-hidden />
        <div className="min-w-0">
          <Link
            href={`/privacy/vendors/${vendor.id}`}
            className="nodrag nopan font-semibold text-[13px] leading-tight line-clamp-2 hover:underline"
            style={{ color: "#0f172a" }}
          >
            {vendor.name}
          </Link>
          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#92400e" }}>
            {t("vendor")}
          </p>
        </div>
      </div>
      {vendor.unrecordedCountries.length > 0 && (
        <div className="px-3 pb-2">
          <Link
            href="/privacy/transfers"
            className="nodrag nopan inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 hover:underline"
            style={{ backgroundColor: "#ffffff", color: "#991b1b", border: "1px dashed #dc2626" }}
            title={t("unrecordedTitle")}
          >
            <Globe2 className="w-3 h-3 shrink-0" aria-hidden />
            {t("unrecorded", { countries: vendor.unrecordedCountries.join(", ") })}
          </Link>
        </div>
      )}
    </div>
  );
}

function CountryNodeComponent({ data }: NodeProps<Node<CountryNodeData>>) {
  const t = useTranslations("dataFlow.node");
  const tStatus = useTranslations("pages.transfers.status_option");
  const locale = useLocale();
  const { country, transfers, worstStatus, isDimmed } = data;
  const color = TRANSFER_STATUS_COLOR[worstStatus];
  return (
    <div
      className="w-[180px] shadow-sm"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderLeft: `4px solid ${STATUS_STROKE[worstStatus]}`,
        opacity: isDimmed ? 0.25 : 1,
      }}
      data-testid="country-node"
      data-status={worstStatus}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-0" style={{ background: STATUS_STROKE[worstStatus], borderRadius: 0 }} />
      <div className="flex items-start gap-2 px-3 py-2">
        <Globe2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: STATUS_STROKE[worstStatus] }} aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-[13px] leading-tight" style={{ color: "#0f172a" }}>
            {countryName(country, locale)}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#475569" }}>
            {t("outsideEeaCountry", { count: transfers.length })}
          </p>
        </div>
      </div>
      <div className="px-3 pb-2">
        <Link
          href={transfers.length === 1 ? `/privacy/transfers/${transfers[0]!.id}` : "/privacy/transfers"}
          className="nodrag nopan inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 hover:underline"
          style={{ backgroundColor: color.bg, color: color.fg }}
        >
          {tStatus(worstStatus)}
        </Link>
      </div>
    </div>
  );
}

function TransferEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<TransferEdgeData>>) {
  const tMech = useTranslations("pages.dataInventory.mechanism");
  const tStatus = useTranslations("pages.transfers.status_option");
  const tNode = useTranslations("dataFlow.node");
  const transfer = data?.transfer;
  const status = transfer?.status ?? "PENDING";
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.18,
  });
  const mechanism =
    transfer?.mechanism && tMech.has(transfer.mechanism as never)
      ? tMech(transfer.mechanism as never)
      : tNode("noMechanism");
  const statusText = transfer?.suggested
    ? tNode("suggestedStatus", { status: tStatus(status) })
    : tStatus(status);
  const color = TRANSFER_STATUS_COLOR[status];
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: STATUS_STROKE[status],
          strokeWidth: 1.5,
          strokeDasharray: "1 3",
          strokeLinecap: "round",
          opacity: data?.isDimmed ? 0.12 : 0.9,
        }}
      />
      <EdgeLabelRenderer>
        <Link
          href={transfer ? `/privacy/transfers/${transfer.id}` : "/privacy/transfers"}
          className="nodrag nopan absolute px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider hover:underline"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            backgroundColor: color.bg,
            color: color.fg,
            opacity: data?.isDimmed ? 0.15 : 1,
          }}
          title={transfer?.name}
          data-testid="transfer-edge-label"
        >
          {mechanism} · {statusText}
        </Link>
      </EdgeLabelRenderer>
    </>
  );
}

export const VendorNode = memo(VendorNodeComponent);
export const CountryNode = memo(CountryNodeComponent);
export const TransferEdge = memo(TransferEdgeComponent);
