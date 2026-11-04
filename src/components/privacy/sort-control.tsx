"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIST_SORTS, type ListSort } from "@/lib/list-sort";

const OPTION_KEY: Record<ListSort, string> = {
  newest: "sortNewest",
  oldest: "sortOldest",
  name: "sortName",
};

/**
 * The visible sort control shared by every list and picker. Newest first is the
 * default; `options` limits the choices where a name sort does not apply.
 */
export function SortControl({
  value,
  onChange,
  options = LIST_SORTS,
  className,
}: {
  value: ListSort;
  onChange: (value: ListSort) => void;
  options?: readonly ListSort[];
  className?: string;
}) {
  const tc = useTranslations("common");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ListSort)}>
      <SelectTrigger className={`w-auto gap-2 ${className ?? ""}`} aria-label={tc("sortLabel")}>
        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {tc(OPTION_KEY[opt])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
