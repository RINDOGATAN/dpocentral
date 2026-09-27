"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings: "Layout: Guided / Classic (will be retired)". A choice for this
 * browser, kept in a cookie (src/lib/skin.ts); the change applies at once.
 */

import { useTranslations } from "next-intl";
import { LayoutPanelLeft, LayoutPanelTop } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Skin } from "@/lib/skin";
import { useSkin } from "./skin-context";

const OPTIONS: { value: Skin; icon: typeof LayoutPanelTop }[] = [
  { value: "guided", icon: LayoutPanelLeft },
  { value: "classic", icon: LayoutPanelTop },
];

export function LayoutCard() {
  const t = useTranslations("guided.layout");
  const { skin, setSkin } = useSkin();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="group" aria-label={t("title")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIONS.map(({ value, icon: Icon }) => {
            const selected = skin === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (selected) return;
                  setSkin(value);
                  toast.success(t("changed"));
                }}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg border p-3 text-left text-sm motion-safe:transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className={cn("p-2 rounded-lg shrink-0", selected ? "bg-primary/10 text-primary" : "bg-secondary")}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="font-medium">{t(value)}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
