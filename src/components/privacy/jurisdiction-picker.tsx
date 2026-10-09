"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Where does your organisation operate?": the places of the jurisdiction
 * catalog as three groups of check boxes (Europe, United States, rest of the
 * world). Used by the quick start's first step (owner's decision d8), as AI
 * Sentinel's quick start uses its own picker. The list of places and their
 * names are in src/config/jurisdiction-places.ts.
 */

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { PLACE_GROUPS, placeOptions } from "@/config/jurisdiction-places";

export function JurisdictionPicker({
  value,
  onChange,
  disabled = false,
  idPrefix = "jurisdiction",
}: {
  value: readonly string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const t = useTranslations("jurisdictionPicker");
  const locale = useLocale();
  const options = useMemo(() => placeOptions(locale), [locale]);
  const chosen = new Set(value);

  const toggle = (code: string) => {
    const next = new Set(chosen);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Keep the catalog's order, so the saved list reads the same every time.
    onChange(options.filter((o) => next.has(o.code)).map((o) => o.code));
  };

  return (
    <div className="space-y-4" data-testid="jurisdiction-picker">
      {PLACE_GROUPS.map((group) => {
        const items = options.filter((o) => o.group === group);
        if (items.length === 0) return null;
        return (
          <fieldset key={group} className="space-y-2" disabled={disabled}>
            <legend className="text-sm font-medium mb-2">{t(`group.${group}`)}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
              {items.map((o) => {
                const id = `${idPrefix}-${o.code}`;
                return (
                  <label
                    key={o.code}
                    htmlFor={id}
                    className="flex items-start gap-2 min-h-9 py-1 cursor-pointer text-sm"
                  >
                    <Checkbox
                      id={id}
                      checked={chosen.has(o.code)}
                      onCheckedChange={() => toggle(o.code)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 break-words leading-snug">
                      {o.place}
                      <span className="text-muted-foreground"> ({o.law})</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
