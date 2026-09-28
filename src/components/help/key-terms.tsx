"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A small "Key terms" row for the top of a screen: the terms that screen leans
 * on, each an explainable Term (dotted underline, popover with its meaning).
 * Non-intrusive, so it can sit under a page header without disturbing the copy.
 * Unknown ids are dropped by Term, so the row only ever shows real terms.
 */

import { useTranslations } from "next-intl";
import { Term } from "@/components/help/term";
import { glossaryTerm } from "@/config/help/glossary";

export function KeyTerms({ ids, className }: { ids: string[]; className?: string }) {
  const t = useTranslations("help");
  const known = ids.filter((id) => glossaryTerm(id));
  if (known.length === 0) return null;

  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${className ?? ""}`}>
      <span className="font-medium">{t("keyTerms")}:</span>
      {known.map((id) => (
        <Term key={id} id={id} className="text-muted-foreground" />
      ))}
    </p>
  );
}
