// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team of the signed-in account (src/server/services/members/firm-team.ts).
 *
 * Every procedure acts on the caller's own firm team only (ownerUserId is the
 * session's user, never an input), and only for a privacy-professional
 * account, read from the account's own row. Nothing here grants access by
 * itself: it creates or removes ordinary organisation memberships, which the
 * membership guard in src/server/trpc.ts then checks as for anyone else.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { OrganizationRole, UserType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { localeFromCookieGetter } from "@/i18n/locale-cookie";
import { pilotLocale } from "@/server/services/pilot/caps";
import { BLOCKED_EMAIL_MESSAGES, isBlockedAccountEmail } from "@/lib/email-policy";
import {
  addFirmTeamMember,
  FIRM_TEAM_DEFAULT_ROLE,
  FIRM_TEAM_ROLES,
  firmOrganizations,
  removeFirmTeamMember,
  updateFirmTeamRole,
} from "@/server/services/members/firm-team";
import { invitationSignInUrl, sendInvitationEmail } from "@/server/services/members/invitation-email";
import { suiteFirmTeamEnabled } from "@/lib/suite-firm-team";
import { markEmptyFirmTeamOwed, schedulePushFirmTeam } from "@/server/services/suite/firm-team-push";

const firmRole = z.enum(FIRM_TEAM_ROLES as unknown as [OrganizationRole, ...OrganizationRole[]]);

async function isProfessional(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { user: { findUnique: (args: any) => Promise<{ userType: UserType | null } | null> } },
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { userType: true } });
  return user?.userType === UserType.PRIVACY_PROFESSIONAL;
}

const NOT_AVAILABLE = "The firm team is available to privacy professional accounts only";

export const firmTeamRouter = createTRPCRouter({
  // The caller's firm team, with how many of the caller's client
  // organisations each person is in through it. `available` is false for an
  // account that is not a privacy professional: it cannot add anyone, but
  // still sees (and can remove) people it added before switching type.
  list: protectedProcedure.query(async ({ ctx }) => {
    const ownerUserId = ctx.session.user.id;
    const [available, orgs, rows] = await Promise.all([
      isProfessional(ctx.prisma, ownerUserId),
      firmOrganizations(ctx.prisma, ownerUserId),
      ctx.prisma.firmTeamMember.findMany({
        where: { ownerUserId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          invitedEmail: true,
          role: true,
          invitedAt: true,
          acceptedAt: true,
          member: { select: { name: true, email: true } },
          _count: { select: { memberships: true } },
        },
      }),
    ]);
    return {
      available,
      clients: orgs.length,
      members: rows.map((r) => ({
        id: r.id,
        email: r.member?.email ?? r.invitedEmail,
        name: r.member?.name ?? null,
        role: r.role,
        pending: !r.acceptedAt,
        invitedAt: r.invitedAt,
        clientsJoined: r._count.memberships,
      })),
    };
  }),

  add: protectedProcedure
    .input(z.object({ email: z.string().email(), role: firmRole.default(FIRM_TEAM_DEFAULT_ROLE) }))
    .mutation(async ({ ctx, input }) => {
      const ownerUserId = ctx.session.user.id;
      if (!(await isProfessional(ctx.prisma, ownerUserId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_AVAILABLE });
      }
      // E-mail policy (src/lib/email-policy.ts), as for organization.addMember.
      if (isBlockedAccountEmail(input.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: BLOCKED_EMAIL_MESSAGES.en });
      }
      const locale = pilotLocale(localeFromCookieGetter(ctx.getCookie));
      const { firm, pending, result } = await addFirmTeamMember(ctx.prisma, {
        ownerUserId,
        email: input.email,
        role: input.role as (typeof FIRM_TEAM_ROLES)[number],
        locale,
      });
      // AI Sentinel applies the same list (src/server/services/suite/firm-team-push.ts).
      schedulePushFirmTeam(ctx.prisma, ownerUserId);
      let emailSent = false;
      if (pending) {
        emailSent = await sendInvitationEmail({
          to: firm.invitedEmail,
          orgName: "",
          inviterName: ctx.session.user.name || ctx.session.user.email || "",
          role: input.role,
          locale,
          signInUrl: invitationSignInUrl(),
          firmTeam: true,
        });
      }
      return {
        id: firm.id,
        pending,
        emailSent,
        signInUrl: pending ? invitationSignInUrl() : null,
        joined: result.added.length,
        skipped: result.skipped.length,
      };
    }),

  updateRole: protectedProcedure
    .input(z.object({ id: z.string(), role: firmRole }))
    .mutation(async ({ ctx, input }) => {
      const ownerUserId = ctx.session.user.id;
      if (!(await isProfessional(ctx.prisma, ownerUserId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_AVAILABLE });
      }
      const firm = await updateFirmTeamRole(ctx.prisma, {
        ownerUserId,
        id: input.id,
        role: input.role as (typeof FIRM_TEAM_ROLES)[number],
      });
      schedulePushFirmTeam(ctx.prisma, ownerUserId);
      return { id: firm.id, role: firm.role };
    }),

  // Removing is allowed whatever the account type now is, so an account that
  // switched type can still take people out of its clients.
  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const ownerUserId = ctx.session.user.id;
    const result = await removeFirmTeamMember(ctx.prisma, { ownerUserId, id: input.id });
    // Sent even when the team is now empty, so the last person goes on AI
    // Sentinel too; an empty list is recorded as owed so the hourly push
    // retries it if this one is lost.
    if (suiteFirmTeamEnabled() && (await ctx.prisma.firmTeamMember.count({ where: { ownerUserId } })) === 0) {
      await markEmptyFirmTeamOwed(ctx.prisma, ownerUserId);
    }
    schedulePushFirmTeam(ctx.prisma, ownerUserId, { includeEmpty: true });
    return result;
  }),
});
