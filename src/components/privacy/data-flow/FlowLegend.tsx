"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The key under the data map. It explains every mark the map uses:
 *   - line colour (the most sensitive class the flow carries), dashed lines
 *     (generated flows to confirm) and line thickness (frequency);
 *   - the coloured stripe on a system card (its type), for the types shown;
 *   - the transfer badges (outside the EEA, coloured by status; vendor
 *     countries with no transfer record), when the map has any;
 *   - the category chips the map shows (with the full name beside them),
 *     and the other short words on a card (in / out, production).
 */

import { useTranslations } from "next-intl";
import type { DataAssetType } from "@prisma/client";
import {
  ASSET_TYPE_COLOR,
  SENSITIVITY_COLOR,
  TRANSFER_STATUS_COLOR,
  chipSensitivity,
} from "./flow-palette";

const STATUS_ORDER = ["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT", "PENDING"] as const;

function Line({ color, dashed, dotted, width = 2 }: { color: string; dashed?: boolean; dotted?: boolean; width?: number }) {
  return (
    <svg width="26" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="4"
        x2="25"
        y2="4"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dotted ? "1 3" : dashed ? "4 3" : undefined}
        strokeLinecap={dotted ? "round" : undefined}
      />
    </svg>
  );
}

export function FlowLegend({
  categories,
  types = [],
  showTransfers = false,
  showUnrecorded = false,
}: {
  categories: string[];
  /** The system types on the map, for the stripe key. */
  types?: DataAssetType[];
  /** The map has at least one transfer badge. */
  showTransfers?: boolean;
  /** The map has at least one "no transfer record" badge. */
  showUnrecorded?: boolean;
}) {
  const t = useTranslations("dataFlow.legend");
  const tNode = useTranslations("dataFlow.node");
  const tAbbr = useTranslations("dataFlow.abbr");
  const tCategory = useTranslations("enums.dataCategory");
  const tAssetType = useTranslations("pages.newAsset.assetType");
  const tStatus = useTranslations("pages.transfers.status_option");

  return (
    <div className="mt-2 space-y-1.5 text-xs text-muted-foreground" data-testid="flow-legend">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-medium text-foreground">{t("title")}</span>
        <span className="inline-flex items-center gap-1" data-testid="legend-special">
          <Line color={SENSITIVITY_COLOR.special.stroke} />
          {t("lineSpecial")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Line color={SENSITIVITY_COLOR.sensitive.stroke} />
          {t("lineHigherRisk")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Line color={SENSITIVITY_COLOR.general.stroke} />
          {t("lineOther")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Line color={SENSITIVITY_COLOR.none.stroke} />
          {t("lineUnclassified")}
        </span>
        <span className="inline-flex items-center gap-1" data-testid="legend-dashed">
          <Line color="#64748b" dashed />
          {t("dashed")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Line color="#64748b" width={3.5} />
          {t("thickness")}
        </span>
      </div>

      {types.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="legend-types">
          <span className="font-medium text-foreground">{t("stripe")}</span>
          {types.map((type) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-1 h-3 shrink-0"
                style={{ backgroundColor: (ASSET_TYPE_COLOR[type] ?? ASSET_TYPE_COLOR.OTHER).stripe }}
                aria-hidden="true"
              />
              {tAssetType(type)}
            </span>
          ))}
        </div>
      )}

      {(showTransfers || showUnrecorded) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="legend-transfers">
          <span className="font-medium text-foreground">{t("transfers")}</span>
          {showTransfers && (
            <span className="inline-flex items-center gap-1">
              <Line color="#64748b" dotted />
              {t("transferLine")}
            </span>
          )}
          {showTransfers &&
            STATUS_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span
                  className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                  style={{ backgroundColor: TRANSFER_STATUS_COLOR[s].bg, color: TRANSFER_STATUS_COLOR[s].fg }}
                  aria-hidden="true"
                >
                  {t("outsideEeaShort")}
                </span>
                {tStatus(s)}
              </span>
            ))}
          {showUnrecorded && (
            <span className="inline-flex items-center gap-1">
              <span
                className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                style={{ backgroundColor: "#ffffff", color: "#991b1b", border: "1px dashed #dc2626" }}
                aria-hidden="true"
              >
                {t("outsideEeaShort")}
              </span>
              {t("unrecorded")}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {categories.map((cat) => {
          const c = SENSITIVITY_COLOR[chipSensitivity(cat)];
          return (
            <span key={cat} className="inline-flex items-center gap-1">
              <span
                className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                style={{ backgroundColor: c.bg, color: c.fg }}
                aria-hidden="true"
              >
                {tAbbr.has(cat as never) ? tAbbr(cat as never) : cat.slice(0, 3)}
              </span>
              <span>{tCategory.has(cat as never) ? tCategory(cat as never) : cat}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold text-foreground">{tNode("inbound")}</span>
          <span>{t("inbound")}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold text-foreground">{tNode("outbound")}</span>
          <span>{t("outbound")}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5"
            style={{ backgroundColor: "#dcfce7", color: "#166534" }}
            aria-hidden="true"
          >
            {tNode("production")}
          </span>
          <span>{tNode("productionTitle")}</span>
        </span>
      </div>
    </div>
  );
}
