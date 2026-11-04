// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { normEmail, pendingInvitesOf, settingsWithInvite, settingsWithoutInvite } from "@/server/services/members/invitations";
import { invitationSignInUrl, sendInvitationEmail } from "@/server/services/members/invitation-email";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, organizationProcedure, officerProcedure, adminOrgProcedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { OrganizationRole, UserType, type Prisma } from "@prisma/client";
import {
  isPublicEmailDomain,
  ownerProvenEmailOf,
  permittedOrgDomain,
  provenEmailOf,
} from "@/lib/org-domain";
import { ensureDefaultIntakeForm } from "@/server/services/dsar/defaultIntakeForm";
import { isDsarModuleEnabled } from "@/config/features";
import { logger } from "@/lib/logger";
import { listOrganizationsFor, withoutPlanNote } from "@/server/services/organization/list";
import { locateRecordForUser, RECORD_KINDS } from "@/server/services/record-locator";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { BLOCKED_EMAIL_MESSAGES, isBlockedAccountEmail } from "@/lib/email-policy";
import {
  departmentScopeConditions,
  loadBusinessUnitScope,
} from "@/server/services/business-units/scope";

/**
 * A free organisation slug close to the one asked for. The slug is the
 * public request-form address (/dsar/<slug>), so it stays lowercase letters,
 * digits and hyphens, 2 to 50 characters. A name with no Latin letters or
 * digits gives "org"; a taken slug gets a short random suffix. Two firms may
 * share a name; neither is told the other exists.
 */
export async function availableSlug(
  prisma: { organization: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> } },
  wanted: string
): Promise<string> {
  const cleaned = wanted
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44)
    .replace(/-+$/, "");
  const base = cleaned.length >= 2 ? cleaned : cleaned ? `${cleaned}-org` : "org";
  const taken = async (slug: string) => !!(await prisma.organization.findUnique({ where: { slug } }));
  if (base.length >= 2 && !(await taken(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(3).toString("hex").slice(0, 5)}`;
    if (!(await taken(candidate))) return candidate;
  }
  throw new TRPCError({
    code: "CONFLICT",
    message: "This organization could not be created. Please try again with a slightly different name.",
  });
}

export const organizationRouter = createTRPCRouter({
  // Shared with the root layout (src/server/services/organization/list.ts).
  list: protectedProcedure.query(({ ctx }) => listOrganizationsFor(ctx.prisma, ctx.session.user.id)),

  // Which of the caller's organisations holds a record (a link from a
  // reminder or from the clients list may point at another client's record
  // than the one selected in the browser). Null for a record the caller is
  // not a member of, whether or not it exists.
  locateRecord: protectedProcedure
    .input(z.object({ kind: z.enum(RECORD_KINDS), id: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      return locateRecordForUser(ctx.prisma, ctx.session.user.id, input.kind, input.id);
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
              incidents: true,
              vendors: true,
            },
          },
        },
      });

      return {
        ...(org ? withoutPlanNote(org) : org),
        currentUserRole: ctx.membership.role,
      };
    }),

  // Create a new organization
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        // The client derives the slug from the name. A person never sees or
        // chooses it, so a name that yields a short, empty or taken slug
        // must not block the first-run screen: availableSlug() settles it.
        slug: z.string().max(200),
        domain: z.string().optional(),
        creatorType: z.nativeEnum(UserType).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = await availableSlug(ctx.prisma, input.slug);

      // The domain drives the sign-in auto-join, so it is never taken on the
      // caller's word: only the domain of the creator's own proven address,
      // never a public one. Anything else: created without a domain.
      const domain = permittedOrgDomain(
        input.domain,
        await provenEmailOf(ctx.prisma, ctx.session.user.id)
      );

      const organization = await ctx.prisma.organization.create({
        data: {
          name: input.name,
          slug,
          domain,
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
          changes: { name: input.name, slug },
        },
      });

      // Seed a default DSAR intake form so the public portal works out of the
      // box. Not when the rights-request module is left out of this build
      // (src/config/features.ts): there is no public portal to serve it.
      if (isDsarModuleEnabled()) {
        try {
          await ensureDefaultIntakeForm(ctx.prisma, organization.id);
        } catch (error) {
          logger.error("Failed to seed default DSAR intake form", error, {
            organizationId: organization.id,
          });
        }
      }

      // Auto-link to Customer for Privacy Professionals
      try {
        const dbUser = await ctx.prisma.user.findUnique({
          where: { id: ctx.session.user.id },
          select: { userType: true, email: true, name: true },
        });

        // Use explicit creatorType from onboarding, fall back to DB value
        const userType = input.creatorType || dbUser?.userType;

        if (userType === "PRIVACY_PROFESSIONAL" && dbUser?.email) {
          let customer = await ctx.prisma.customer.findUnique({
            where: { email: dbUser.email },
          });

          if (!customer) {
            customer = await ctx.prisma.customer.create({
              data: {
                name: dbUser.name || dbUser.email,
                email: dbUser.email,
                type: "SAAS",
              },
            });
          }

          await ctx.prisma.customerOrganization.create({
            data: {
              customerId: customer.id,
              organizationId: organization.id,
            },
          });
        }
      } catch (error) {
        console.error("Failed to auto-link Customer for Privacy Professional:", error);
      }

      return organization;
    }),

  // Update organization details
  update: adminOrgProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().min(1).max(200).optional(),
        domain: z.string().optional().nullable(),
        // No free-form settings: the server keeps its own values there
        // (pending invitations).
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

      // Reject public email domains as org domains
      if (input.domain && isPublicEmailDomain(input.domain)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Public email domains (e.g. gmail.com) cannot be used as organization domains",
        });
      }

      // Same rule as create: only the domain of the OWNER's own proven
      // address is stored. Anything else is saved as "no domain".
      const domain =
        input.domain === undefined
          ? undefined
          : permittedOrgDomain(
              input.domain,
              await ownerProvenEmailOf(ctx.prisma, ctx.organization.id)
            );

      const organization = await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: {
          name: input.name,
          domain,
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
  addMember: adminOrgProcedure
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

      // Only an owner may make someone an owner, whether or not an account
      // already exists for the address: otherwise an admin could add a second
      // account as owner and then demote the original owner.
      if (input.role === OrganizationRole.OWNER && ctx.membership.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can invite an owner" });
      }

      // E-mail policy (src/lib/email-policy.ts): both rules apply to every
      // invitation, whether or not an account exists for the address (a
      // refused address can no longer sign in).
      if (isBlockedAccountEmail(input.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: BLOCKED_EMAIL_MESSAGES.en });
      }
      // Find user by email
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      // Nobody has signed in with this address yet: keep an invitation on the
      // organisation and e-mail it; the membership is created at their first
      // sign-in (src/server/services/members/invitations.ts).
      if (!user) {
        const org = await ctx.prisma.organization.findUnique({
          where: { id: ctx.organization.id },
          select: { name: true, settings: true },
        });
        const invite = {
          email: normEmail(input.email),
          role: input.role,
          invitedAt: new Date().toISOString(),
          invitedById: ctx.session.user.id,
        };
        await ctx.prisma.organization.update({
          where: { id: ctx.organization.id },
          data: { settings: settingsWithInvite(org?.settings, invite) as Prisma.InputJsonValue },
        });
        const emailSent = await sendInvitationEmail({
          to: invite.email,
          orgName: org?.name ?? "",
          inviterName: ctx.session.user.name || ctx.session.user.email || "",
          role: input.role,
          locale: localeFromCookieGetter(ctx.getCookie)?.startsWith("es") ? "es" : "en",
          signInUrl: invitationSignInUrl(),
        });
        await ctx.prisma.auditLog.create({
          data: {
            organizationId: ctx.organization.id,
            userId: ctx.session.user.id,
            entityType: "OrganizationMember",
            entityId: ctx.organization.id,
            action: "INVITE",
            changes: { email: invite.email, role: input.role, emailSent },
          },
        });
        return { invited: true as const, emailSent, signInUrl: invitationSignInUrl() };
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

      return { invited: false as const, membership };
    }),

  // Invitations waiting for the person's first sign-in (owners and admins).
  listInvitations: adminOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        select: { settings: true },
      });
      return pendingInvitesOf(org?.settings).map((i) => ({ email: i.email, role: i.role, invitedAt: i.invitedAt }));
    }),

  // Cancel an invitation that has not been accepted yet (owners and admins).
  cancelInvitation: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUnique({
        where: { id: ctx.organization.id },
        select: { settings: true },
      });
      const had = pendingInvitesOf(org?.settings).some((i) => normEmail(i.email) === normEmail(input.email));
      if (!had) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      await ctx.prisma.organization.update({
        where: { id: ctx.organization.id },
        data: { settings: settingsWithoutInvite(org?.settings, input.email) as Prisma.InputJsonValue },
      });
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "OrganizationMember",
          entityId: ctx.organization.id,
          action: "INVITE_CANCELLED",
          changes: { email: normEmail(input.email) },
        },
      });
      return { success: true };
    }),

  // Update a member's role (procedure gate: OWNER/ADMIN; handler additionally
  // restricts to OWNER only)
  updateMember: adminOrgProcedure
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

      // Scope the lookup to the caller's organization — a raw memberId must
      // never reach across tenant boundaries.
      const memberToUpdate = await ctx.prisma.organizationMember.findFirst({
        where: {
          id: input.memberId,
          organizationId: ctx.organization.id,
        },
      });

      if (!memberToUpdate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found in this organization",
        });
      }

      // Cannot demote the last owner
      if (memberToUpdate.role === "OWNER" && input.role !== "OWNER") {
        const ownerCount = await ctx.prisma.organizationMember.count({
          where: {
            organizationId: ctx.organization.id,
            role: "OWNER",
          },
        });

        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot change the role of the last owner of an organization",
          });
        }
      }

      const membership = await ctx.prisma.organizationMember.update({
        where: { id: memberToUpdate.id },
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
  removeMember: adminOrgProcedure
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

      // Scope the lookup to the caller's organization — a raw memberId must
      // never reach across tenant boundaries. This also makes the last-owner
      // guard below correct: the member is guaranteed to belong to the same
      // organization whose owners are being counted.
      const memberToRemove = await ctx.prisma.organizationMember.findFirst({
        where: {
          id: input.memberId,
          organizationId: ctx.organization.id,
        },
      });

      if (!memberToRemove) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found in this organization",
        });
      }

      // Only an owner may remove an owner.
      if (memberToRemove.role === "OWNER" && ctx.membership.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can remove an owner" });
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
        where: { id: memberToRemove.id },
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
  addJurisdiction: officerProcedure
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
      // The inventory counts follow the member's department limit, like the
      // inventory lists: a limited member is shown their department's figures,
      // not the whole organisation's.
      const deptConditions = departmentScopeConditions(
        await loadBusinessUnitScope(ctx.prisma, ctx.membership.id),
      );
      const deptWhere = deptConditions.length > 0 ? { AND: deptConditions as never } : {};
      const dsarOn = isDsarModuleEnabled();

      const [
        totalAssets,
        totalActivities,
        openDSARs,
        overdueDSARs,
        openIncidents,
        activeVendors,
        totalVendors,
      ] = await Promise.all([
        ctx.prisma.dataAsset.count({
          where: { organizationId: ctx.organization.id, ...deptWhere },
        }),
        ctx.prisma.processingActivity.count({
          where: { organizationId: ctx.organization.id, isActive: true, ...deptWhere },
        }),
        // Rights-request counts are zero when the module is off.
        dsarOn
          ? ctx.prisma.dSARRequest.count({
              where: {
                organizationId: ctx.organization.id,
                status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
              },
            })
          : 0,
        dsarOn
          ? ctx.prisma.dSARRequest.count({
              where: {
                organizationId: ctx.organization.id,
                status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
                dueDate: { lt: now },
              },
            })
          : 0,
        ctx.prisma.incident.count({
          where: { recordedInErrorAt: null,
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
        // Every vendor in any status (a prospective vendor is listed but is
        // not active).
        ctx.prisma.vendor.count({
          where: { organizationId: ctx.organization.id },
        }),
      ]);

      return {
        totalAssets,
        totalActivities,
        openDSARs,
        overdueDSARs,
        openIncidents,
        activeVendors,
        totalVendors,
      };
    }),
});
