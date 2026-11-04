"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// A list's filters live in the URL, so a filtered view can be shared and
// bookmarked exactly as the person left it. This hook reads the filter set out
// of the query string and writes it back, using router.replace so filtering
// never floods the browser history. The vocabulary and the parsing rules are in
// src/lib/list-views.ts; this is only the URL binding.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  LIST_DEFS,
  parseListFilters,
  serializeListFilters,
  type ListFilters,
  type ListKey,
} from "@/lib/list-views";

export function useListFilters(listKey: ListKey) {
  const def = LIST_DEFS[listKey];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseListFilters(def, new URLSearchParams(searchParams.toString())),
    [def, searchParams],
  );

  const applyAll = useCallback(
    (next: ListFilters) => {
      const qs = serializeListFilters(def, next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [def, router, pathname],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const next: ListFilters = { ...filters };
      if (value === undefined || value === null || value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      applyAll(next);
    },
    [filters, applyAll],
  );

  // Clearing keeps the sort, which is a preference rather than a filter.
  const clearAll = useCallback(() => {
    applyAll(filters.sort ? { sort: filters.sort } : {});
  }, [applyAll, filters.sort]);

  return { def, filters, setFilter, applyAll, clearAll };
}
