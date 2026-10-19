// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { signupRegionSettings } from "@/server/services/org-region";
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
import { planTemplateRemoval, removeTemplateItems } from "@/server/services/template-items/remove";
import { logger } from "@/lib/logger";
import {
  assertOrganizationsPerAccount,
  organizationCapacity,
  getPilotStatus,
  pilotLocale,
  pilotMessage,
  assertPilotCapacity,
} from "@/server/services/pilot/caps";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { GROUP_STATE_SELECT, inheritedGroupState } from "@/server/services/pilot/umbrella";
import { isHostedDeployment } from "@/lib/hosted";
import { BLOCKED_EMAIL_MESSAGES, isBlockedAccountEmail } from "@/lib/email-policy";
import { PILOT_DPA, PILOT_DPA_ACTION, PILOT_DPA_REQUIRED } from "@/config/pilot-dpa";
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

/**
 * The organisation without the operator's plan references (planNote, and the
 * Stripe subscription recorded by the automatic upgrade).
 */
function withoutPlanNote<
  T extends { planNote?: string | null; planStripeSubscriptionId?: string | null },
>(org: T): Omit<T, "planNote" | "planStripeSubscriptionId"> {
  const { planNote: _planNote, planStripeSubscriptionId: _sub, ...rest } = org;
  return rest;
}

/** Whether the organisation has an acceptance of the current agreement on record. */
async function hasAcceptedCurrentDpa(
  prisma: { auditLog: { findMany: (args: object) => Promise<Array<{ changes: unknown }>> } },
  organizationId: string
): Promise<boolean> {
  const entries = await prisma.auditLog.findMany({
    where: { organizationId, action: PILOT_DPA_ACTION },
    select: { changes: true },
  });
  return entries.some(
    (e) => (e.changes as { dpaVersion?: unknown } | null)?.dpaVersion === PILOT_DPA.version
  );
}

export const organizationRouter = createTRPCRouter({
  // List all organizations the user belongs to
  // Hosted service: whether this account may open another organisation, and
  // the message to show when it may not. Always open on the kit.
  capacity: protectedProcedure.query(async ({ ctx }) => {
    const capacity = await organizationCapacity(ctx.prisma, ctx.session.user.id);
    if (!capacity.limited || capacity.canAdd) return { ...capacity, message: null };
    const lang = pilotLocale(localeFromCookieGetter(ctx.getCookie));
    return { ...capacity, message: pilotMessage("organizationLimit", lang) };
  }),

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

    // planNote is the operator's reference for the paid plan (an invoice
    // id): never sent to the organisation's members.
    return memberships.map((m) => ({
      ...withoutPlanNote(m.organization),
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
        ...(org ? withoutPlanNote(org) : org),
        currentUserRole: ctx.membership.role,
      };
    }),

  // Hosted pilot status for the Settings card ({ hosted: false } on the kit)
  getPilotStatus: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return getPilotStatus(ctx.prisma, ctx.organization);
    }),

  // Hosted: whether this organisation still has to accept the current data
  // processing agreement (src/config/pilot-dpa.ts). Organisations opened
  // before acceptance was asked at opening have no entry for it and are asked
  // once, at the next sign-in. An owner or administrator accepts on behalf of
  // the organisation; other members only see a note. Never asked on the kit.
  getDpaStatus: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      if (!isHostedDeployment()) return { required: false, canAccept: false };
      const accepted = await hasAcceptedCurrentDpa(ctx.prisma, ctx.organization.id);
      return {
        required: !accepted,
        canAccept: ctx.membership.role === "OWNER" || ctx.membership.role === "ADMIN",
      };
    }),

  // Hosted: an owner or administrator accepts the current agreement for an
  // organisation that has no acceptance of it on record. Recorded as the same
  // audit-trail entry as at opening. Accepting twice records nothing new.
  acceptDpa: adminOrgProcedure
    .input(z.object({ organizationId: z.string(), accept: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      if (!isHostedDeployment()) return { accepted: false };
      if (await hasAcceptedCurrentDpa(ctx.prisma, ctx.organization.id)) return { accepted: true };
      const lang = pilotLocale(localeFromCookieGetter(ctx.getCookie));
      await ctx.prisma.auditLog.create({
        data: {
          organizationId: ctx.organization.id,
          userId: ctx.session.user.id,
          entityType: "Organization",
          entityId: ctx.organization.id,
          action: PILOT_DPA_ACTION,
          changes: { dpaVersion: PILOT_DPA.version, locale: lang, document: PILOT_DPA.href[lang] },
        },
      });
      return { accepted: true };
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
        // Hosted pilot: the data processing agreement (src/config/pilot-dpa.ts)
        // is accepted when the organisation is opened. Ignored on the kit.
        acceptDpa: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lang = pilotLocale(localeFromCookieGetter(ctx.getCookie));
      // Hosted service: up to ORGANIZATIONS_PER_ACCOUNT organisations per
      // account (no-op on the kit)
      await assertOrganizationsPerAccount(ctx.prisma, ctx.session.user.id, lang);

      // Hosted pilot: no organisation is opened without accepting the agreement.
      const hosted = isHostedDeployment();
      if (hosted && input.acceptDpa !== true) {
        throw new TRPCError({ code: "BAD_REQUEST", message: PILOT_DPA_REQUIRED[lang] });
      }

      const slug = await availableSlug(ctx.prisma, input.slug);

      // The domain drives the sign-in auto-join, so it is never taken on the
      // caller's word: only the domain of the creator's own proven address,
      // never a public one. Anything else: created without a domain.
      const domain = permittedOrgDomain(
        input.domain,
        await provenEmailOf(ctx.prisma, ctx.session.user.id)
      );

      // Hosted service: the creator is the billing owner, and a new
      // organisation joins the creator's group: same plan, same pilot window
      // (never a fresh one), same shared allowances (pilot/umbrella.ts).
      const group = hosted
        ? inheritedGroupState(
            await ctx.prisma.organization.findMany({
              where: { billingOwnerId: ctx.session.user.id },
              select: GROUP_STATE_SELECT,
            })
          )
        : null;

      // Hosted service: the safeguards question (how the service should run)
      // is asked once per account, not again for each client a consultant
      // adds: only when this person has neither answered it nor been asked it
      // in another organisation.
      const askedBefore = hosted
        ? (
            await ctx.prisma.organization.findMany({
              where: {
                OR: [
                  { safeguardsChoiceById: ctx.session.user.id },
                  { welcomeUserId: ctx.session.user.id },
                ],
              },
              select: { id: true },
              take: 1,
            })
          ).length
        : 0;

      const organization = await ctx.prisma.organization.create({
        data: {
          name: input.name,
          slug,
          domain,
          billingOwnerId: ctx.session.user.id,
          ...(group
            ? {
                plan: group.plan as "PILOT" | "EU_CLOUD",
                planStartedAt: group.planStartedAt,
                planRenewsAt: group.planRenewsAt,
                planStripeSubscriptionId: group.planStripeSubscriptionId,
                pilotStartedAt: group.pilotStartedAt,
              }
            : {}),
          // Hosted service: the creator sees the welcome card (safeguards
          // question) on the first visit to /privacy. Never on the kit.
          welcomeUserId: hosted && askedBefore === 0 ? ctx.session.user.id : null,
          // Hosted service: whether it was created from the EU, for the
          // currency of e-mails sent without a visitor.
          settings: signupRegionSettings(ctx.country, isHostedDeployment()),
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

      // The record of the acceptance: which agreement, in which language; the
      // entry's own date and user say when and who.
      if (hosted) {
        await ctx.prisma.auditLog.create({
          data: {
            organizationId: organization.id,
            userId: ctx.session.user.id,
            entityType: "Organization",
            entityId: organization.id,
            action: PILOT_DPA_ACTION,
            changes: { dpaVersion: PILOT_DPA.version, locale: lang, document: PILOT_DPA.href[lang] },
          },
        });
      }

      // Seed a default DSAR intake form so the public portal works out of the
      // box. Not when the rights-request module is left out of this plan
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

  /**
   * How many quick-start / template-created items "Remove all template items"
   * would clear, and how many it would keep (the ones a person has edited).
   * Read-only, so every member can see the count before anyone acts.
   */
  templateItemsPlan: organizationProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const plan = await planTemplateRemoval(ctx.prisma, ctx.organization.id);
      // The ids stay on the server; the UI only needs the counts.
      return {
        vendors: plan.vendors,
        dataAssets: plan.dataAssets,
        processingActivities: plan.processingActivities,
        totalRemove: plan.totalRemove,
        totalKeep: plan.totalKeep,
      };
    }),

  /**
   * Remove the unedited quick-start / template-created vendors, data assets and
   * processing activities in one step. Edited items stay. Owners and admins
   * only, and it is recorded in the audit trail.
   */
  removeTemplateItems: adminOrgProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      if (!["OWNER", "ADMIN"].includes(ctx.membership.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to remove template items",
        });
      }
      return removeTemplateItems(ctx.prisma, {
        organizationId: ctx.organization.id,
        userId: ctx.session.user.id,
      });
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

      const locale = pilotLocale(localeFromCookieGetter(ctx.getCookie));
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
        if (input.role === OrganizationRole.OWNER && ctx.membership.role !== "OWNER") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can invite an owner" });
        }
        const org = await ctx.prisma.organization.findUnique({
          where: { id: ctx.organization.id },
          select: { name: true, settings: true },
        });
        const pending = pendingInvitesOf(org?.settings).filter((i) => normEmail(i.email) !== normEmail(input.email));
        // Hosted pilot: pending invitations hold a place under the members cap.
        await assertPilotCapacity(ctx.prisma, ctx.organization, "members", 1 + pending.length, locale);
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
          locale,
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

      // Hosted service: the invitee may not already belong to the most
      // organisations an account may have (lifted when this organisation is on
      // the paid EU cloud plan)
      await assertOrganizationsPerAccount(
        ctx.prisma,
        user.id,
        pilotLocale(localeFromCookieGetter(ctx.getCookie)),
        ctx.organization
      );

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
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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
        activeAssessments,
        openIncidents,
        activeVendors,
        totalVendors,
        recentAuditLogs,
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
        ctx.prisma.assessment.count({
          where: {
            organizationId: ctx.organization.id,
            status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] },
          },
        }),
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
        // Every vendor in any status: the dashboard's vendor card lists them
        // all, so its count line names both figures (a prospective vendor is
        // listed but is not active).
        ctx.prisma.vendor.count({
          where: { organizationId: ctx.organization.id },
        }),
        ctx.prisma.auditLog.findMany({
          where: {
            organizationId: ctx.organization.id,
            createdAt: { gte: thirtyDaysAgo },
            ...(dsarOn ? {} : { entityType: { not: "DSARRequest" } }),
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
        totalVendors,
        recentAuditLogs,
      };
    }),
});
