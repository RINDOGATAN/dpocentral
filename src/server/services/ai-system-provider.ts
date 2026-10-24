// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { displayAiSystemProvider } from "@/config/vendor-ai-detection";

type WithProvider = { provider: string | null; catalogSlug: string | null };

/** The one catalogue read this needs; the plain and the extended clients both fit. */
type CatalogReader = {
  vendorCatalog: {
    findMany(args: {
      where: { slug: { in: string[] } };
      select: { slug: true; name: true; legalName: true };
    }): Promise<{ slug: string; name: string; legalName: string | null }[]>;
  };
};

/**
 * AI systems with `provider` as shown: a provider the import wrote as the
 * catalogue product's name becomes the company behind the product, from the
 * catalogue's legal name (displayAiSystemProvider). One catalogue read.
 */
export async function withDisplayedProvider<T extends WithProvider>(
  prisma: CatalogReader,
  systems: T[],
): Promise<T[]> {
  const slugs = [
    ...new Set(
      systems.map((s) => s.catalogSlug).filter((s): s is string => !!s),
    ),
  ];
  if (slugs.length === 0) return systems;
  const rows = await prisma.vendorCatalog.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true, legalName: true },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return systems.map((s) => {
    const row = s.catalogSlug ? bySlug.get(s.catalogSlug) : undefined;
    return row
      ? {
          ...s,
          provider: displayAiSystemProvider(
            s.provider,
            row.name,
            row.legalName,
          ),
        }
      : s;
  });
}
