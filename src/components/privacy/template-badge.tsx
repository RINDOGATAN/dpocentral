"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * "From the … template" / "From quick start" — a quiet badge shown wherever a
 * record that an industry template or the quick start created is listed or
 * opened. Reads the provenance the quick start writes into the record's
 * `metadata` JSON (`source`, `templateName`); renders nothing for records a
 * person made by hand.
 *
 * DPO Central has no dedicated provenance column yet; the removal of these
 * items and the queryable schema come in stage 3 (per the directive). Until
 * then this reads the `metadata` blob, which every relevant model already has.
 */
export function TemplateBadge({
  metadata,
  className,
}: {
  metadata: unknown;
  className?: string;
}) {
  const tc = useTranslations("common");
  const meta = (metadata ?? {}) as { source?: unknown; templateName?: unknown };
  const source = typeof meta.source === "string" ? meta.source : null;
  if (source !== "template" && source !== "quickstart") return null;

  const label =
    source === "template"
      ? typeof meta.templateName === "string" && meta.templateName
        ? tc("fromTemplate", { name: meta.templateName })
        : tc("fromTemplateGeneric")
      : tc("fromQuickstart");

  return (
    <Badge variant="outline" className={`gap-1 text-muted-foreground font-normal ${className ?? ""}`}>
      <LayoutTemplate className="w-3 h-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
