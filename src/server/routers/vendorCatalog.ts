// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { dedupeCatalogRows } from "@/lib/vendor-catalog-display";

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
      const rows = await ctx.prisma.vendorCatalog.findMany({
        where: {
          AND: [
            input.category ? { category: input.category } : {},
            {
              OR: [
                { name: { contains: input.query, mode: "insensitive" } },
                { slug: { contains: input.query, mode: "insensitive" } },
                { description: { contains: input.query, mode: "insensitive" } },
              ],
            },
          ],
        },
        orderBy: [
          { isVerified: "desc" },
          { name: "asc" },
        ],
        take: input.limit + 10,
      });
      return dedupeCatalogRows(rows).slice(0, input.limit);
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
