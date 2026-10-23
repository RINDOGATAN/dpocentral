"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Where does your organisation operate?": the places of the jurisdiction
 * catalog as three groups of check boxes (Europe, United States, rest of the
 * world). Used by the quick start's first step, as AI
 * Sentinel's quick start uses its own picker. The list of places and their
 * names are in src/config/jurisdiction-places.ts.
 *
 * Europe is open; the United States and the rest of the world fold behind one
 * line each (open from the start when one of their places is already chosen),
 * so the step stays short on a phone.
 */

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { PLACE_GROUPS, placeOptions, type PlaceGroup } from "@/config/jurisdiction-places";

/** Groups shown open whatever is chosen; the others fold. */
export const OPEN_PLACE_GROUPS: readonly PlaceGroup[] = ["europe"];

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
  // A folding group is open when the person opened it, or, until they fold or
  // open it themselves, when it holds a chosen place (the stored places can
  // arrive after the first render).
  const [toggled, setToggled] = useState<Partial<Record<PlaceGroup, boolean>>>({});

  const toggle = (code: string) => {
    const next = new Set(chosen);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    // Keep the catalog's order, so the saved list reads the same every time.
    onChange(options.filter((o) => next.has(o.code)).map((o) => o.code));
  };

  const isOpen = (group: PlaceGroup, chosenHere: number) =>
    OPEN_PLACE_GROUPS.includes(group) || (toggled[group] ?? chosenHere > 0);

  return (
    <div className="space-y-4" data-testid="jurisdiction-picker">
      {PLACE_GROUPS.map((group) => {
        const items = options.filter((o) => o.group === group);
        if (items.length === 0) return null;
        const folds = !OPEN_PLACE_GROUPS.includes(group);
        const chosenHere = items.filter((o) => chosen.has(o.code)).length;
        const open = isOpen(group, chosenHere);
        const listId = `${idPrefix}-group-${group}`;
        return (
          <fieldset key={group} className="space-y-2" disabled={disabled}>
            {folds ? (
              <legend className="w-full">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 min-h-9 text-left text-sm font-medium"
                  aria-expanded={open}
                  aria-controls={listId}
                  data-testid={`place-group-${group}`}
                  onClick={() => setToggled((prev) => ({ ...prev, [group]: !open }))}
                >
                  <span>
                    {t(`group.${group}`)}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {t("placeCount", { count: items.length })}
                      {chosenHere > 0 && ` · ${t("chosenCount", { count: chosenHere })}`}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
              </legend>
            ) : (
              <legend className="text-sm font-medium mb-2">{t(`group.${group}`)}</legend>
            )}
            {open && (
              <div id={listId} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
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
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
