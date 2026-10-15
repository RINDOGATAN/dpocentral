"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A small key under the data map: what each category chip on a system means
 * (the same chips, with the full name beside them), and the other short words
 * on a system card (in / out flow counts, production). Only the categories the
 * map shows are listed, so the key stays short.
 */

import { useTranslations } from "next-intl";
import { SENSITIVITY_COLOR, chipSensitivity } from "./flow-palette";

export function FlowLegend({ categories }: { categories: string[] }) {
  const t = useTranslations("dataFlow.legend");
  const tNode = useTranslations("dataFlow.node");
  const tAbbr = useTranslations("dataFlow.abbr");
  const tCategory = useTranslations("enums.dataCategory");

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground"
      data-testid="flow-legend"
    >
      <span className="font-medium text-foreground">{t("title")}</span>
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
  );
}
