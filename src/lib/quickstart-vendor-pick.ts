// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The quick start's vendor search: a click on a result adds the vendor (or
 * removes it when it was already chosen). Adding clears the search box, so
 * the next vendor starts from an empty box instead of the last name typed;
 * removing leaves the search as it is, so the person can pick another result
 * from the same list.
 *
 * Pure, so the rule is tested without rendering the page.
 */
export function pickVendor(
  selected: readonly string[],
  slug: string,
): { selected: string[]; clearSearch: boolean } {
  if (selected.includes(slug)) {
    return { selected: selected.filter((s) => s !== slug), clearSearch: false };
  }
  return { selected: [...selected, slug], clearSearch: true };
}
