import { z } from "zod";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { CustomerType, LicenseType, EntitlementStatus, UserType } from "@prisma/client";
import {
  createEntitlement,
  suspendEntitlement,
  reactivateEntitlement,
} from "../services/licensing/entitlement";

export const platformAdminRouter = createTRPCRouter({
  // ============================================================
  // ADMIN CHECK
  // ============================================================

  // Check if current user is a platform admin (via ADMIN_EMAILS env var)
  isAdmin: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user?.email) {
      return { isAdmin: false };
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    return { isAdmin: adminEmails.includes(ctx.session.user.email.toLowerCase()) };
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
  // ORGANIZATIONS (full management)
  // ============================================================

  listOrganizations: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const organizations = await ctx.prisma.organization.findMany({
        where: input?.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { slug: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          _count: {
            select: {
              members: true,
              dataAssets: true,
              vendors: true,
            },
          },
          customerLinks: {
            include: {
              customer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (organizations.length > limit) {
        const nextItem = organizations.pop();
        nextCursor = nextItem?.id;
      }

      return { organizations, nextCursor };
    }),

  getOrganization: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const organization = await ctx.prisma.organization.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
            orderBy: { joinedAt: "desc" },
          },
          customerLinks: {
            include: {
              customer: { select: { id: true, name: true, email: true } },
            },
          },
          _count: {
            select: {
              members: true,
              dataAssets: true,
              processingActivities: true,
              dsarRequests: true,
              assessments: true,
              incidents: true,
              vendors: true,
            },
          },
        },
      });

      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      const recentLogs = await ctx.prisma.auditLog.findMany({
        where: { organizationId: input.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return { ...organization, recentLogs };
    }),

  // ============================================================
  // USERS (full management)
  // ============================================================

  listUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const users = await ctx.prisma.user.findMany({
        where: input?.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          _count: {
            select: { organizationMemberships: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (users.length > limit) {
        const nextItem = users.pop();
        nextCursor = nextItem?.id;
      }

      return { users, nextCursor };
    }),

  getUser: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        include: {
          organizationMemberships: {
            include: {
              organization: { select: { id: true, name: true, slug: true } },
            },
            orderBy: { joinedAt: "desc" },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const recentLogs = await ctx.prisma.auditLog.findMany({
        where: { userId: input.id },
        include: {
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return { ...user, recentLogs };
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string(),
        userType: z.nativeEnum(UserType).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input.id } });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      return ctx.prisma.user.update({
        where: { id: input.id },
        data: { userType: input.userType },
      });
    }),

  // ============================================================
  // AUDIT LOGS
  // ============================================================

  listAuditLogs: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        organizationId: z.string().optional(),
        userId: z.string().optional(),
        entityType: z.string().optional(),
        action: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;

      const where: Record<string, unknown> = {};
      if (input?.organizationId) where.organizationId = input.organizationId;
      if (input?.userId) where.userId = input.userId;
      if (input?.entityType) where.entityType = input.entityType;
      if (input?.action) where.action = input.action;
      if (input?.search) {
        where.OR = [
          { entityType: { contains: input.search, mode: "insensitive" } },
          { entityId: { contains: input.search, mode: "insensitive" } },
          { action: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input?.dateFrom || input?.dateTo) {
        where.createdAt = {
          ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
          ...(input?.dateTo ? { lte: new Date(input.dateTo + "T23:59:59.999Z") } : {}),
        };
      }

      const [logs, entityTypes, actions] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          cursor: input?.cursor ? { id: input.cursor } : undefined,
        }),
        ctx.prisma.auditLog.findMany({
          select: { entityType: true },
          distinct: ["entityType"],
          orderBy: { entityType: "asc" },
        }),
        ctx.prisma.auditLog.findMany({
          select: { action: true },
          distinct: ["action"],
          orderBy: { action: "asc" },
        }),
      ]);

      let nextCursor: string | undefined;
      if (logs.length > limit) {
        const nextItem = logs.pop();
        nextCursor = nextItem?.id;
      }

      return {
        logs,
        nextCursor,
        filterOptions: {
          entityTypes: entityTypes.map((e) => e.entityType),
          actions: actions.map((a) => a.action),
        },
      };
    }),

  // ============================================================
  // CUSTOMER DELETE
  // ============================================================

  deleteCustomer: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({ where: { id: input.id } });
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      await ctx.prisma.customer.delete({ where: { id: input.id } });
      return { success: true };
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

  getRecentActivity: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recentLogs, newUsers7d, newUsers30d, activeSubscriptions] = await Promise.all([
      ctx.prisma.auditLog.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      ctx.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ctx.prisma.skillEntitlement.count({
        where: {
          status: EntitlementStatus.ACTIVE,
          licenseType: "SUBSCRIPTION",
        },
      }),
    ]);

    return { recentLogs, newUsers7d, newUsers30d, activeSubscriptions };
  }),
});
