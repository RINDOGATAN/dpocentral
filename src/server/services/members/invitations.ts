// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Invitations to an organisation for people who have not signed in yet.
 *
 * A membership needs a user row, and creating one for someone who has never
 * signed in would block a later Google sign-in with that address (the
 * account is not linked). So an invitation is kept on the organisation
 * (Organization.settings.pendingInvites, with the lower-cased addresses in
 * pendingInviteEmails for the look-up) until the person signs in with that
 * address: acceptPendingInvitations, called once per sign-in from the JWT
 * callback, turns it into a membership with the invited role and removes it.
 * No new table, no migration.
 */

import type { OrganizationRole, Prisma } from "@prisma/client";
import { isHostedDeployment } from "@/lib/hosted";
import { isPaidPlan } from "@/server/services/pilot/caps";
import { logger } from "@/lib/logger";

export interface PendingInvite {
  email: string;
  role: OrganizationRole;
  invitedAt: string;
  invitedById: string;
}

export const INVITES_KEY = "pendingInvites";
export const INVITE_EMAILS_KEY = "pendingInviteEmails";

export const normEmail = (email: string) => email.trim().toLowerCase();

function settingsObject(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
}

export function pendingInvitesOf(settings: unknown): PendingInvite[] {
  const list = settingsObject(settings)[INVITES_KEY];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (i): i is PendingInvite =>
      !!i && typeof i === "object" && typeof (i as PendingInvite).email === "string" && typeof (i as PendingInvite).role === "string"
  );
}

function withList(settings: unknown, invites: PendingInvite[]): Record<string, unknown> {
  return {
    ...settingsObject(settings),
    [INVITES_KEY]: invites,
    [INVITE_EMAILS_KEY]: invites.map((i) => normEmail(i.email)),
  };
}

/** The settings with this invitation added (replacing one for the same address). */
export function settingsWithInvite(settings: unknown, invite: PendingInvite): Record<string, unknown> {
  const others = pendingInvitesOf(settings).filter((i) => normEmail(i.email) !== normEmail(invite.email));
  return withList(settings, [...others, { ...invite, email: normEmail(invite.email) }]);
}

/** The settings without the invitation for `email`. */
export function settingsWithoutInvite(settings: unknown, email: string): Record<string, unknown> {
  return withList(settings, pendingInvitesOf(settings).filter((i) => normEmail(i.email) !== normEmail(email)));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * At sign-in: every organisation holding an invitation for this address
 * gets a membership with the invited role, and the invitation is removed.
 * On the hosted pilot the one-organisation-per-account rule still applies:
 * an account that already belongs to an organisation is not added to a
 * pilot organisation (the invitation stays until it is cancelled).
 * Never throws: a failure is logged and sign-in goes on.
 */
export async function acceptPendingInvitations(db: Db, userId: string, email: string | null | undefined): Promise<number> {
  if (!email) return 0;
  const address = normEmail(email);
  let joined = 0;
  try {
    const orgs: Array<{ id: string; plan: string; settings: Prisma.JsonValue }> = await db.organization.findMany({
      where: { settings: { path: [INVITE_EMAILS_KEY], array_contains: [address] } },
      select: { id: true, plan: true, settings: true },
    });
    for (const org of orgs) {
      const invite = pendingInvitesOf(org.settings).find((i) => normEmail(i.email) === address);
      if (!invite) continue;
      const existing = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId } },
      });
      if (!existing) {
        if (isHostedDeployment() && !isPaidPlan(org as never)) {
          const memberships = await db.organizationMember.count({ where: { userId } });
          if (memberships > 0) continue;
        }
        const membership = await db.organizationMember.create({
          data: {
            organizationId: org.id,
            userId,
            role: invite.role,
            invitedEmail: address,
            invitedAt: new Date(invite.invitedAt),
          },
        });
        await db.auditLog.create({
          data: {
            organizationId: org.id,
            userId,
            entityType: "OrganizationMember",
            entityId: membership.id,
            action: "JOIN_BY_INVITATION",
            changes: { role: invite.role },
          },
        });
        joined++;
      }
      await db.organization.update({
        where: { id: org.id },
        data: { settings: settingsWithoutInvite(org.settings, address) as Prisma.InputJsonValue },
      });
    }
  } catch (error) {
    logger.error("Accepting pending invitations failed during sign-in", error);
  }
  return joined;
}
