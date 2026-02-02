import { z } from "zod";
import { createTRPCRouter, protectedProcedure, organizationProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { OrganizationRole } from "@prisma/client";

export const organizationRouter = createTRPCRouter({
  // List all organizations the user belongs to
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.organizationMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                dataAssets: true,
                dsarRequests: true,
                incidents: true,
                vendors: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return memberships.map((m) => ({
      ...m.organization,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }),

  // Get a single organization by ID
  getById: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          jurisdictions: {
            include: {
              jurisdiction: true,
            },
          },
          _count: {
            select: {
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

      return {
        ...org,
        currentUserRole: ctx.membership.role,
      };
    }),

  // Create a new organization
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
        domain: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is already taken
      const existing = await ctx.prisma.organization.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An organization with this slug already exists",
        });
      }

      const organization = await ctx.prisma.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          domain: input.domain,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: OrganizationRole.OWNER,
            },
          },
        },
        include: {
          members: true,
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: ctx.session.user.id,
          entityType: "Organization",
          entityId: organization.id,
          action: "CREATE",
          changes: { name: input.name, slug: input.slug },
        },
      });

      return organization;
    }),

  // Update organization details
  update: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(200).optional(),
        domain: z.string().optional().nullable(),
        settings: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only owners and admins can update
      if (!["OWNER", "ADMIN"].includes(ctx.membership.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this organization",
        });
      }

      const organization = await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          name: input.name,
          domain: input.domain,
          settings: input.settings,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: ctx.session.user.id,
          entityType: "Organization",
          entityId: organization.id,
          action: "UPDATE",
          changes: input,
        },
      });

      return organization;
    }),

  // Add a member to the organization
  addMember: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email(),
        role: z.nativeEnum(OrganizationRole).default(OrganizationRole.MEMBER),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only owners and admins can add members
      if (!["OWNER", "ADMIN"].includes(ctx.membership.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to add members",
        });
      }

      // Find user by email
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with this email. They must sign up first.",
        });
      }

      // Check if already a member
      const existingMembership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.organization.id,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This user is already a member of the organization",
        });
      }

      const membership = await ctx.prisma.organizationMember.create({
        data: {
          organizationId: ctx.organization.id,
          userId: user.id,
          role: input.role,
          invitedEmail: input.email,
          invitedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationMember",
          entityId: membership.id,
          action: "CREATE",
          changes: { email: input.email, role: input.role },
        },
      });

      return membership;
    }),

  // Update a member's role
  updateMember: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        memberId: z.string(),
        role: z.nativeEnum(OrganizationRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only owners can change roles
      if (ctx.membership.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can change member roles",
        });
      }

      const membership = await ctx.prisma.organizationMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationMember",
          entityId: membership.id,
          action: "UPDATE",
          changes: { role: input.role },
        },
      });

      return membership;
    }),

  // Remove a member from the organization
  removeMember: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        memberId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only owners and admins can remove members
      if (!["OWNER", "ADMIN"].includes(ctx.membership.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to remove members",
        });
      }

      const memberToRemove = await ctx.prisma.organizationMember.findUnique({
        where: { id: input.memberId },
      });

      if (!memberToRemove) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      // Cannot remove the last owner
      if (memberToRemove.role === "OWNER") {
        const ownerCount = await ctx.prisma.organizationMember.count({
          where: {
            organizationId: ctx.organization.id,
            role: "OWNER",
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last owner of an organization",
          });
        }
      }

      await ctx.prisma.organizationMember.delete({
        where: { id: input.memberId },
      });

      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationMember",
          entityId: input.memberId,
          action: "DELETE",
        },
      });

      return { success: true };
    }),

  // Add jurisdiction to organization
  addJurisdiction: organizationProcedure
    .input(
      z.object({
        organizationId: z.string(),
        jurisdictionId: z.string(),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!["OWNER", "ADMIN", "PRIVACY_OFFICER"].includes(ctx.membership.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to manage jurisdictions",
        });
      }

      // If setting as primary, unset any existing primary
      if (input.isPrimary) {
        await ctx.prisma.organizationJurisdiction.updateMany({
          where: {
            organizationId: ctx.organization.id,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      const orgJurisdiction = await ctx.prisma.organizationJurisdiction.upsert({
        where: {
          organizationId_jurisdictionId: {
            organizationId: ctx.organization.id,
            jurisdictionId: input.jurisdictionId,
          },
        },
        update: { isPrimary: input.isPrimary },
        create: {
          organizationId: ctx.organization.id,
          jurisdictionId: input.jurisdictionId,
          isPrimary: input.isPrimary,
        },
        include: {
          jurisdiction: true,
        },
      });

      return orgJurisdiction;
    }),

  // List all available jurisdictions
  listJurisdictions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.jurisdiction.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }),

  // Get dashboard stats for organization
  getDashboardStats: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalAssets,
        totalActivities,
        openDSARs,
        overdueDSARs,
        activeAssessments,
        openIncidents,
        activeVendors,
        recentAuditLogs,
      ] = await Promise.all([
        ctx.prisma.dataAsset.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.processingActivity.count({
          where: { organizationId: ctx.organization.id, isActive: true },
        }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: ctx.organization.id,
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
          },
        }),
        ctx.prisma.dSARRequest.count({
          where: {
            organizationId: ctx.organization.id,
            status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
            dueDate: { lt: now },
          },
        }),
        ctx.prisma.assessment.count({
          where: {
            organizationId: ctx.organization.id,
            status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] },
          },
        }),
        ctx.prisma.incident.count({
          where: {
            organizationId: ctx.organization.id,
            status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
          },
        }),
        ctx.prisma.vendor.count({
          where: {
            organizationId: ctx.organization.id,
            status: "ACTIVE",
          },
        }),
        ctx.prisma.auditLog.findMany({
          where: {
            organizationId: ctx.organization.id,
            createdAt: { gte: thirtyDaysAgo },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        }),
      ]);

      return {
        totalAssets,
        totalActivities,
        openDSARs,
        overdueDSARs,
        activeAssessments,
        openIncidents,
        activeVendors,
        recentAuditLogs,
      };
    }),
});
