// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The vendor catalogue holds a few rows that describe the same vendor twice:
 * the same website and the same name once company suffixes are set aside
 * (two slugs for one vendor, or "Name" beside "Name io"). Catalogue search
 * shows one of them, the richer record, and keeps the rest of the data as it
 * is. Rows that share a website but carry different names (two products of
 * one company) are distinct and both stay.
 *
 * Pure, so the rule is tested without a database.
 */

export interface DedupeCatalogRow {
  slug: string;
  name: string;
  website?: string | null;
  description?: string | null;
  isVerified?: boolean | null;
  publicProfileEnabled?: boolean | null;
  certifications?: readonly string[] | null;
  subprocessors?: unknown;
}

/** The host of a vendor website, lower case and without "www.". */
export function catalogDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.includes("://") ? website : `https://${website}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

const NAME_NOISE = new Set(["inc", "llc", "ltd", "gmbh", "corp", "corporation", "co", "the", "io", "hq"]);

/** A vendor name reduced for comparison: no case, punctuation or company suffix. */
export function catalogNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !NAME_NOISE.has(w))
    .join(" ");
}

/** How much a record holds, to keep the richer of two duplicates. */
function richness(row: DedupeCatalogRow): number {
  const subprocessors = Array.isArray(row.subprocessors) ? row.subprocessors.length : 0;
  return (
    (row.isVerified ? 10_000 : 0) +
    (row.publicProfileEnabled ? 5_000 : 0) +
    (row.certifications?.length ?? 0) * 100 +
    Math.min(subprocessors, 99) * 10 +
    (row.description ? 1 + Math.min(row.description.length, 9) / 10 : 0)
  );
}

/**
 * The rows with each duplicate group (same domain, same name key) reduced to
 * its richest record, in the place of the group's first row; order otherwise
 * kept. A row without a website is never treated as a duplicate.
 */
export function dedupeCatalogRows<T extends DedupeCatalogRow>(rows: readonly T[]): T[] {
  const best = new Map<string, { index: number; row: T }>();
  const out: (T | null)[] = [];
  for (const row of rows) {
    const domain = catalogDomain(row.website);
    const nameKey = catalogNameKey(row.name);
    if (!domain || !nameKey) {
      out.push(row);
      continue;
    }
    const key = `${domain}|${nameKey}`;
    const seen = best.get(key);
    if (!seen) {
      best.set(key, { index: out.length, row });
      out.push(row);
    } else if (richness(row) > richness(seen.row)) {
      out[seen.index] = row;
      best.set(key, { index: seen.index, row });
    }
  }
  return out.filter((r): r is T => r !== null);
}

/**
 * The catalogue's vendor description for a screen in `locale`, or null. The
 * catalogue holds descriptions in English only (there is no Spanish field), so
 * a Spanish screen shows none rather than an English line in Spanish text.
 */
export function catalogDescriptionFor(description: string | null | undefined, locale: string): string | null {
  return locale === "en" && description ? description : null;
}
