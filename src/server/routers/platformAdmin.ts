import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { CustomerType, LicenseType, EntitlementStatus } from "@prisma/client";
import {
  createEntitlement,
  suspendEntitlement,
  reactivateEntitlement,
} from "../services/licensing/entitlement";

export const platformAdminRouter = createTRPCRouter({
  // ============================================================
  // ADMIN CHECK
  // ============================================================

  // Check if current user is a platform admin
  isAdmin: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user?.email) {
      return { isAdmin: false };
    }

    const admin = await ctx.prisma.platformAdmin.findUnique({
      where: { email: ctx.session.user.email },
    });

    return { isAdmin: !!admin?.isActive };
  }),

  // ============================================================
  // CUSTOMERS
  // ============================================================

  // List all customers
  listCustomers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const customers = await ctx.prisma.customer.findMany({
        where: input?.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          organizations: {
            include: {
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          entitlements: {
            include: {
              skillPackage: true,
            },
          },
          _count: {
            select: {
              organizations: true,
              entitlements: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (customers.length > limit) {
        const nextItem = customers.pop();
        nextCursor = nextItem?.id;
      }

      return { customers, nextCursor };
    }),

  // Get customer by ID
  getCustomer: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.id },
        include: {
          organizations: {
            include: {
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          entitlements: {
            include: {
              skillPackage: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      return customer;
    }),

  // Create customer
  createCustomer: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        type: z.nativeEnum(CustomerType),
        stripeCustomerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.customer.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A customer with this email already exists",
        });
      }

      return ctx.prisma.customer.create({
        data: input,
      });
    }),

  // Update customer
  updateCustomer: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        type: z.nativeEnum(CustomerType).optional(),
        stripeCustomerId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const customer = await ctx.prisma.customer.findUnique({
        where: { id },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      return ctx.prisma.customer.update({
        where: { id },
        data,
      });
    }),

  // Link organization to customer
  linkOrganization: adminProcedure
    .input(
      z.object({
        customerId: z.string(),
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify both exist
      const [customer, organization] = await Promise.all([
        ctx.prisma.customer.findUnique({ where: { id: input.customerId } }),
        ctx.prisma.organization.findUnique({ where: { id: input.organizationId } }),
      ]);

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found",
        });
      }

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      return ctx.prisma.customerOrganization.upsert({
        where: {
          customerId_organizationId: {
            customerId: input.customerId,
            organizationId: input.organizationId,
          },
        },
        update: {},
        create: {
          customerId: input.customerId,
          organizationId: input.organizationId,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    }),

  // Unlink organization from customer
  unlinkOrganization: adminProcedure
    .input(
      z.object({
        customerId: z.string(),
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customerOrganization.delete({
        where: {
          customerId_organizationId: {
            customerId: input.customerId,
            organizationId: input.organizationId,
          },
        },
      });
    }),

  // ============================================================
  // SKILL PACKAGES
  // ============================================================

  // List skill packages
  listSkillPackages: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.skillPackage.findMany({
      include: {
        _count: {
          select: { entitlements: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }),

  // ============================================================
  // ENTITLEMENTS
  // ============================================================

  // Create entitlement
  createEntitlement: adminProcedure
    .input(
      z.object({
        customerId: z.string(),
        skillPackageId: z.string(),
        licenseType: z.nativeEnum(LicenseType),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createEntitlement(input);
    }),

  // Suspend entitlement
  suspendEntitlement: adminProcedure
    .input(z.object({ entitlementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return suspendEntitlement(input.entitlementId);
    }),

  // Reactivate entitlement
  reactivateEntitlement: adminProcedure
    .input(z.object({ entitlementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return reactivateEntitlement(input.entitlementId);
    }),

  // Delete entitlement
  deleteEntitlement: adminProcedure
    .input(z.object({ entitlementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.skillEntitlement.delete({
        where: { id: input.entitlementId },
      });
    }),

  // ============================================================
  // ORGANIZATIONS (for admin lookup)
  // ============================================================

  // Search organizations
  searchOrganizations: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.organization.findMany({
        where: input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { slug: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : undefined,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: {
            select: { members: true },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  // ============================================================
  // DASHBOARD STATS
  // ============================================================

  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    const [
      totalCustomers,
      totalOrganizations,
      totalEntitlements,
      activeEntitlements,
      entitlementsByStatus,
      entitlementsByType,
    ] = await Promise.all([
      ctx.prisma.customer.count(),
      ctx.prisma.organization.count(),
      ctx.prisma.skillEntitlement.count(),
      ctx.prisma.skillEntitlement.count({
        where: { status: EntitlementStatus.ACTIVE },
      }),
      ctx.prisma.skillEntitlement.groupBy({
        by: ["status"],
        _count: true,
      }),
      ctx.prisma.skillEntitlement.groupBy({
        by: ["skillPackageId"],
        _count: true,
      }),
    ]);

    return {
      totalCustomers,
      totalOrganizations,
      totalEntitlements,
      activeEntitlements,
      entitlementsByStatus: entitlementsByStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {}
      ),
      entitlementsByType: entitlementsByType.reduce(
        (acc, t) => ({ ...acc, [t.skillPackageId]: t._count }),
        {}
      ),
    };
  }),
});
