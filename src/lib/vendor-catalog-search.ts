// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Ranking for the vendor catalogue search: what a person typed is a vendor's
 * name far more often than a word of its description. Name matches rank by
 * how well they match (exact, starts with, a word starts with, contains),
 * then the slug; description matches are used only when no name or slug
 * matches, so typing "Microsoft 365" does not list a vendor whose description
 * merely mentions it.
 */

export interface SearchableCatalogRow {
  name: string;
  slug: string;
  isVerified?: boolean | null;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Lower is better; null when neither the name nor the slug matches. */
export function nameMatchRank(row: SearchableCatalogRow, query: string): number | null {
  const q = fold(query);
  if (!q) return null;
  const name = fold(row.name);
  const slug = fold(row.slug);
  if (name === q || slug === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/[\s\-_.(),/]+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  if (slug.includes(q.replace(/\s+/g, "-"))) return 4;
  return null;
}

/**
 * Orders the candidate rows: name and slug matches by rank (verified first
 * within a rank, then by name); description-only matches only when there is
 * no name or slug match at all.
 */
export function rankCatalogSearch<T extends SearchableCatalogRow>(rows: readonly T[], query: string): T[] {
  const ranked = rows
    .map((row) => ({ row, rank: nameMatchRank(row, query) }))
    .filter((x): x is { row: T; rank: number } => x.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(!!b.row.isVerified) - Number(!!a.row.isVerified) ||
        a.row.name.localeCompare(b.row.name)
    )
    .map((x) => x.row);
  if (ranked.length > 0) return ranked;
  return [...rows].sort(
    (a, b) => Number(!!b.isVerified) - Number(!!a.isVerified) || a.name.localeCompare(b.name)
  );
}
