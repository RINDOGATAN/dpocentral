// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { dedupeCatalogRows } from "@/lib/vendor-catalog-display";
import { rankCatalogSearch } from "@/lib/vendor-catalog-search";

// Vendor catalog is now owned by Vendor.Watch.
// DPO Central retains read-only access for vendor form autofill.

export const vendorCatalogRouter = createTRPCRouter({
  // Search vendors with fuzzy matching
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        category: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // A vendor recorded twice in the catalogue (same website, same name)
      // shows once, as its richer record (lib/vendor-catalog-display.ts). A
      // few extra rows are read so the list still fills the limit.
      // Name and slug matches first, ranked by how well the name matches;
      // description matches only when nothing matches by name
      // (lib/vendor-catalog-search.ts).
      const category = input.category ? { category: input.category } : {};
      const slugQuery = input.query.trim().replace(/\s+/g, "-");
      const byName = await ctx.prisma.vendorCatalog.findMany({
        where: {
          AND: [
            category,
            {
              OR: [
                { name: { contains: input.query.trim(), mode: "insensitive" } },
                { slug: { contains: slugQuery, mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 200,
      });
      const rows =
        byName.length > 0
          ? byName
          : await ctx.prisma.vendorCatalog.findMany({
              where: { AND: [category, { description: { contains: input.query.trim(), mode: "insensitive" } }] },
              orderBy: [{ isVerified: "desc" }, { name: "asc" }],
              take: input.limit + 10,
            });
      return dedupeCatalogRows(rankCatalogSearch(rows, input.query)).slice(0, input.limit);
    }),

  // Get single vendor by slug
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendorCatalog.findUnique({
        where: { slug: input.slug },
      });

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found in catalog",
        });
      }

      return vendor;
    }),

  // List all distinct categories
  listCategories: publicProcedure.query(async ({ ctx }) => {
    const categories = await ctx.prisma.vendorCatalog.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    return categories.map((c: { category: string }) => c.category);
  }),
});
