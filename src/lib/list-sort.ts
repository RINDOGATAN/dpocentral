// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// One sort vocabulary for every list in the dashboard (data inventory, vendors,
// assessments, rights requests, incidents, transfers, AI systems) and every
// picker. Newest first is the default everywhere, so a record just added is at
// the top rather than the bottom. Lists fetch their rows in full and sort in
// memory, so the comparator lives here rather than in each router.

export const LIST_SORTS = ["newest", "oldest", "name"] as const;
export type ListSort = (typeof LIST_SORTS)[number];
export const DEFAULT_LIST_SORT: ListSort = "newest";

export function isListSort(value: unknown): value is ListSort {
  return typeof value === "string" && (LIST_SORTS as readonly string[]).includes(value);
}

function toTime(value: Date | string | number | null | undefined): number {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Return a new array sorted by the chosen order. `date` reads the field that
 * "newest" means (creation, not last edit, where both exist); `name` reads the
 * label sorted alphabetically. A missing accessor makes that order a no-op so a
 * list without names can still offer newest/oldest.
 */
export function sortByListSort<T>(
  items: readonly T[],
  sort: ListSort,
  get: { date?: (item: T) => Date | string | number | null | undefined; name?: (item: T) => string },
): T[] {
  const copy = [...items];
  switch (sort) {
    case "oldest":
      if (!get.date) return copy;
      return copy.sort((a, b) => toTime(get.date!(a)) - toTime(get.date!(b)));
    case "name":
      if (!get.name) return copy;
      return copy.sort((a, b) => get.name!(a).localeCompare(get.name!(b)));
    case "newest":
    default:
      if (!get.date) return copy;
      return copy.sort((a, b) => toTime(get.date!(b)) - toTime(get.date!(a)));
  }
}
