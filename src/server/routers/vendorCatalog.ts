import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const vendorCatalogUpdateSchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  privacyPolicyUrl: z.string().optional().nullable(),
  trustCenterUrl: z.string().optional().nullable(),
  dpaUrl: z.string().optional().nullable(),
  securityPageUrl: z.string().optional().nullable(),
  certifications: z.array(z.string()).optional(),
  frameworks: z.array(z.string()).optional(),
  gdprCompliant: z.boolean().optional().nullable(),
  ccpaCompliant: z.boolean().optional().nullable(),
  hipaaCompliant: z.boolean().optional().nullable(),
  dataLocations: z.array(z.string()).optional(),
  hasEuDataCenter: z.boolean().optional().nullable(),
  subprocessors: z.any().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  isVerified: z.boolean().optional(),
});

const vendorCatalogCreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  privacyPolicyUrl: z.string().optional(),
  trustCenterUrl: z.string().optional(),
  dpaUrl: z.string().optional(),
  securityPageUrl: z.string().optional(),
  certifications: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  gdprCompliant: z.boolean().optional(),
  ccpaCompliant: z.boolean().optional(),
  hipaaCompliant: z.boolean().optional(),
  dataLocations: z.array(z.string()).default([]),
  hasEuDataCenter: z.boolean().optional(),
  subprocessors: z.any().optional(),
  logoUrl: z.string().optional(),
  source: z.string().optional(),
});

export const vendorCatalogRouter = createTRPCRouter({
  // ============================================================
  // PUBLIC QUERIES (for vendor lookup/autofill)
  // ============================================================

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

  // ============================================================
  // ADMIN QUERIES
  // ============================================================

  // List all vendors with pagination
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        isVerified: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;

      const vendors = await ctx.prisma.vendorCatalog.findMany({
        where: {
          ...(input?.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
            ],
          }),
          ...(input?.category && { category: input.category }),
          ...(input?.isVerified !== undefined && { isVerified: input.isVerified }),
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (vendors.length > limit) {
        const nextItem = vendors.pop();
        nextCursor = nextItem?.id;
      }

      return { vendors, nextCursor };
    }),

  // Get catalog stats for admin dashboard
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [
      totalVendors,
      verifiedVendors,
      byCategory,
    ] = await Promise.all([
      ctx.prisma.vendorCatalog.count(),
      ctx.prisma.vendorCatalog.count({ where: { isVerified: true } }),
      ctx.prisma.vendorCatalog.groupBy({
        by: ["category"],
        _count: true,
        orderBy: { _count: { category: "desc" } },
        take: 10,
      }),
    ]);

    return {
      totalVendors,
      verifiedVendors,
      unverifiedVendors: totalVendors - verifiedVendors,
      topCategories: byCategory.map((c: { category: string; _count: number }) => ({
        category: c.category,
        count: c._count,
      })),
    };
  }),

  // ============================================================
  // ADMIN MUTATIONS
  // ============================================================

  // Update vendor info
  update: adminProcedure
    .input(vendorCatalogUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { slug, isVerified, ...data } = input;

      const existing = await ctx.prisma.vendorCatalog.findUnique({
        where: { slug },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found in catalog",
        });
      }

      return ctx.prisma.vendorCatalog.update({
        where: { slug },
        data: {
          ...data,
          ...(isVerified !== undefined && {
            isVerified,
            verifiedAt: isVerified ? new Date() : null,
            verifiedBy: isVerified ? ctx.session.user.email : null,
          }),
        },
      });
    }),

  // Create new vendor
  create: adminProcedure
    .input(vendorCatalogCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.vendorCatalog.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A vendor with this slug already exists",
        });
      }

      return ctx.prisma.vendorCatalog.create({
        data: {
          ...input,
          source: input.source || "manual",
        },
      });
    }),

  // Bulk import/update vendors
  bulkImport: adminProcedure
    .input(z.array(vendorCatalogCreateSchema))
    .mutation(async ({ ctx, input }) => {
      let created = 0;
      let updated = 0;

      for (const vendor of input) {
        const existing = await ctx.prisma.vendorCatalog.findUnique({
          where: { slug: vendor.slug },
        });

        if (existing) {
          await ctx.prisma.vendorCatalog.update({
            where: { slug: vendor.slug },
            data: vendor,
          });
          updated++;
        } else {
          await ctx.prisma.vendorCatalog.create({
            data: {
              ...vendor,
              source: vendor.source || "bulk-import",
            },
          });
          created++;
        }
      }

      return { created, updated, total: input.length };
    }),

  // Delete vendor from catalog
  delete: adminProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.vendorCatalog.findUnique({
        where: { slug: input.slug },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found in catalog",
        });
      }

      await ctx.prisma.vendorCatalog.delete({
        where: { slug: input.slug },
      });

      return { success: true };
    }),
});
