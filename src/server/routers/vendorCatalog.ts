import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

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
      return ctx.prisma.vendorCatalog.findMany({
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
        take: input.limit,
      });
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
