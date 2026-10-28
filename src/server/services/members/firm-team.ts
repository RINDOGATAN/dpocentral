// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm team of an account.
 *
 * An account that manages several client organisations (typically a privacy
 * professional) can add people of its own firm once, and they become members
 * of every client organisation the account manages, including those it
 * creates later. Access still goes through the ordinary per-organisation
 * membership (OrganizationMember) and its role: the membership guard in
 * src/server/trpc.ts is unchanged, and a firm-team person has no access to an
 * organisation in which no membership row exists for them.
 *
 * Which organisations: those where the account is BOTH an OWNER (it still
 * controls the organisation) AND the billing owner (it created the
 * organisation, or pays for it on the hosted service). Owner alone would also
 * cover an organisation another account created and later made this account
 * an owner of; billing owner alone would cover an organisation from which the
 * account has since been removed or demoted.
 *
 * Every membership the firm team creates carries firmTeamMemberId. Only those
 * memberships are changed or removed from here; a membership the person holds
 * in their own right (firmTeamMemberId null) is never touched, and an
 * organisation where the person already has one is skipped.
 */

import { OrganizationRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { isHostedDeployment } from "@/lib/hosted";
import { logger } from "@/lib/logger";
import {
  assertPilotCapacity,
  assertPilotWritable,
  isPaidPlan,
  ORGANIZATIONS_PER_ACCOUNT,
} from "@/server/services/pilot/caps";
import { normEmail } from "./invitations";

type Locale = "en" | "es";

/** Roles a firm-team person may hold. Never OWNER. */
export const FIRM_TEAM_ROLES = [
  OrganizationRole.ADMIN,
  OrganizationRole.PRIVACY_OFFICER,
  OrganizationRole.MEMBER,
  OrganizationRole.VIEWER,
] as const;
export type FirmTeamRole = (typeof FIRM_TEAM_ROLES)[number];

/**
 * The default role: privacy officer. Firm staff do the privacy work (records,
 * rights requests, incidents, assessments), but do not change the client's
 * organisation settings, delete records or manage the client's members,
 * which stay with the account (OWNER) and the client's own administrators.
 */
export const FIRM_TEAM_DEFAULT_ROLE: FirmTeamRole = OrganizationRole.PRIVACY_OFFICER;

export function isFirmTeamRole(role: string): role is FirmTeamRole {
  return (FIRM_TEAM_ROLES as readonly string[]).includes(role);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export type FirmOrg = {
  id: string;
  plan: string | null;
  pilotStartedAt: Date | null;
  billingOwnerId: string | null;
};

export type FirmRow = {
  id: string;
  ownerUserId: string;
  memberUserId: string | null;
  invitedEmail: string;
  role: OrganizationRole;
};

const ORG_SELECT = { id: true, plan: true, pilotStartedAt: true, billingOwnerId: true } as const;

/** The organisations an account's firm team works in (see the header). */
export function firmOrganizationsWhere(ownerUserId: string) {
  return {
    billingOwnerId: ownerUserId,
    members: { some: { userId: ownerUserId, role: OrganizationRole.OWNER } },
  };
}

export async function firmOrganizations(db: Db, ownerUserId: string): Promise<FirmOrg[]> {
  return db.organization.findMany({
    where: firmOrganizationsWhere(ownerUserId),
    select: ORG_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/** True when `organizationId` is one of the account's firm organisations. */
export async function isFirmOrganization(db: Db, ownerUserId: string, organizationId: string): Promise<boolean> {
  const org = await db.organization.findFirst({
    where: { id: organizationId, ...firmOrganizationsWhere(ownerUserId) },
    select: { id: true },
  });
  return !!org;
}

export function firmLimitMessage(locale: Locale): string {
  const n = ORGANIZATIONS_PER_ACCOUNT;
  return locale === "es"
    ? `Esta persona no puede unirse a todos tus clientes: en el piloto del servicio alojado una cuenta puede pertenecer como máximo a ${n} organizaciones, contando las que ya tiene. Puedes quitarla de otras organizaciones o pasar al plan de pago, en el que este límite no se aplica.`
    : `This person cannot join all your clients: on the hosted pilot an account can belong to at most ${n} organisations, counting the ones it already has. You can remove them from other organisations, or move to the paid plan, where this limit does not apply.`;
}

export type SyncResult = { added: string[]; updated: string[]; skipped: string[] };

/**
 * Makes sure the firm-team person holds a firm membership, with the firm
 * role, in each of `orgs`. Idempotent: an existing firm membership only has
 * its role brought in line; an organisation where the person already has a
 * membership of their own is skipped (it stays theirs).
 *
 * Hosted pilot: the organisations-per-account rule of addMember applies to an
 * organisation that is not on the paid plan. With `strict`, a membership that
 * the rule would refuse throws (nothing is written when the caller runs this
 * in a transaction); otherwise that organisation is skipped and the next
 * sign-in tries again.
 */
export async function syncFirmMember(
  db: Db,
  firm: FirmRow,
  orgs: FirmOrg[],
  opts: { strict?: boolean; locale?: Locale; actorUserId?: string | null } = {}
): Promise<SyncResult> {
  const result: SyncResult = { added: [], updated: [], skipped: [] };
  const userId = firm.memberUserId;
  if (!userId || userId === firm.ownerUserId) return result;
  const hosted = isHostedDeployment();
  let memberships: number | null = null;

  for (const org of orgs) {
    const existing = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId } },
      select: { id: true, role: true, firmTeamMemberId: true },
    });
    if (existing) {
      if (existing.firmTeamMemberId === firm.id && existing.role !== firm.role) {
        await db.organizationMember.update({ where: { id: existing.id }, data: { role: firm.role } });
        result.updated.push(org.id);
      } else if (existing.firmTeamMemberId !== firm.id) {
        result.skipped.push(org.id);
      }
      continue;
    }
    if (hosted && !isPaidPlan(org)) {
      memberships ??= await db.organizationMember.count({ where: { userId } });
      if ((memberships as number) >= ORGANIZATIONS_PER_ACCOUNT) {
        if (opts.strict) {
          throw new TRPCError({ code: "FORBIDDEN", message: firmLimitMessage(opts.locale ?? "en") });
        }
        result.skipped.push(org.id);
        continue;
      }
    }
    const membership = await db.organizationMember.create({
      data: {
        organizationId: org.id,
        userId,
        role: firm.role,
        invitedEmail: firm.invitedEmail,
        invitedAt: new Date(),
        firmTeamMemberId: firm.id,
      },
      select: { id: true },
    });
    if (memberships !== null) memberships++;
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        userId: opts.actorUserId === undefined ? firm.ownerUserId : opts.actorUserId,
        entityType: "OrganizationMember",
        entityId: membership.id,
        action: "FIRM_TEAM_ADD",
        changes: { email: firm.invitedEmail, role: firm.role, firmTeamMemberId: firm.id },
      },
    });
    result.added.push(org.id);
  }
  return result;
}

/**
 * Adds a person to the account's firm team. The person joins every firm
 * organisation now (an account that already exists) or at their first
 * sign-in (an address nobody has signed in with yet). All or nothing: run in
 * one transaction.
 */
export async function addFirmTeamMember(
  db: Db,
  input: {
    ownerUserId: string;
    email: string;
    role: FirmTeamRole;
    locale: Locale;
  }
): Promise<{ firm: FirmRow; pending: boolean; result: SyncResult }> {
  const email = normEmail(input.email);
  if (!isFirmTeamRole(input.role)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This role cannot be given to a firm team member" });
  }
  return db.$transaction(async (tx: Db) => {
    const existing = await tx.firmTeamMember.findUnique({
      where: { ownerUserId_invitedEmail: { ownerUserId: input.ownerUserId, invitedEmail: email } },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: input.locale === "es" ? "Esta persona ya está en tu equipo." : "This person is already in your firm team.",
      });
    }
    const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (user?.id === input.ownerUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: input.locale === "es" ? "No puedes añadirte a ti mismo." : "You cannot add yourself.",
      });
    }
    const orgs = await firmOrganizations(tx, input.ownerUserId);

    // Hosted pilot: the same rules as adding a member to one organisation.
    // The organisations of one account share one pilot (plan, window and
    // allowances), so the first pilot organisation stands for all of them.
    const pilotOrg = orgs.find((o) => !isPaidPlan(o));
    if (pilotOrg && isHostedDeployment()) {
      for (const o of orgs) if (!isPaidPlan(o)) assertPilotWritable(o, input.locale);
      const alreadyInGroup = user
        ? (await tx.organizationMember.count({
            where: { userId: user.id, organizationId: { in: orgs.map((o) => o.id) } },
          })) > 0
        : false;
      if (!alreadyInGroup) {
        const pendingFirm = await tx.firmTeamMember.count({
          where: { ownerUserId: input.ownerUserId, memberUserId: null },
        });
        await assertPilotCapacity(tx, pilotOrg, "members", 1 + pendingFirm, input.locale);
      }
    }

    const now = new Date();
    const firm: FirmRow = await tx.firmTeamMember.create({
      data: {
        ownerUserId: input.ownerUserId,
        invitedEmail: email,
        role: input.role,
        memberUserId: user?.id ?? null,
        invitedAt: now,
        acceptedAt: user ? now : null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: input.ownerUserId,
        entityType: "FirmTeamMember",
        entityId: firm.id,
        action: "FIRM_TEAM_INVITE",
        changes: { email, role: input.role },
      },
    });
    const result = user
      ? await syncFirmMember(tx, firm, orgs, { strict: true, locale: input.locale })
      : { added: [], updated: [], skipped: [] };
    return { firm, pending: !user, result };
  });
}

/** Changes a firm-team person's role here and in every firm membership. */
export async function updateFirmTeamRole(
  db: Db,
  input: { ownerUserId: string; id: string; role: FirmTeamRole }
): Promise<FirmRow> {
  if (!isFirmTeamRole(input.role)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This role cannot be given to a firm team member" });
  }
  return db.$transaction(async (tx: Db) => {
    const firm = await tx.firmTeamMember.findFirst({ where: { id: input.id, ownerUserId: input.ownerUserId } });
    if (!firm) throw new TRPCError({ code: "NOT_FOUND", message: "Firm team member not found" });
    const updated = await tx.firmTeamMember.update({ where: { id: firm.id }, data: { role: input.role } });
    const memberships: Array<{ id: string; organizationId: string }> = await tx.organizationMember.findMany({
      where: { firmTeamMemberId: firm.id },
      select: { id: true, organizationId: true },
    });
    await tx.organizationMember.updateMany({ where: { firmTeamMemberId: firm.id }, data: { role: input.role } });
    for (const m of memberships) {
      await tx.auditLog.create({
        data: {
          organizationId: m.organizationId,
          userId: input.ownerUserId,
          entityType: "OrganizationMember",
          entityId: m.id,
          action: "FIRM_TEAM_ROLE",
          changes: { role: input.role, firmTeamMemberId: firm.id },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: input.ownerUserId,
        entityType: "FirmTeamMember",
        entityId: firm.id,
        action: "FIRM_TEAM_ROLE",
        changes: { role: input.role },
      },
    });
    return updated;
  });
}

/**
 * Removes a person from the firm team and every membership the firm team
 * gave them. A membership the person holds in their own right stays.
 */
export async function removeFirmTeamMember(
  db: Db,
  input: { ownerUserId: string; id: string }
): Promise<{ removedMemberships: number }> {
  return db.$transaction(async (tx: Db) => {
    const firm = await tx.firmTeamMember.findFirst({ where: { id: input.id, ownerUserId: input.ownerUserId } });
    if (!firm) throw new TRPCError({ code: "NOT_FOUND", message: "Firm team member not found" });
    const memberships: Array<{ id: string; organizationId: string }> = await tx.organizationMember.findMany({
      where: { firmTeamMemberId: firm.id },
      select: { id: true, organizationId: true },
    });
    for (const m of memberships) {
      await tx.auditLog.create({
        data: {
          organizationId: m.organizationId,
          userId: input.ownerUserId,
          entityType: "OrganizationMember",
          entityId: m.id,
          action: "FIRM_TEAM_REMOVE",
          changes: { email: firm.invitedEmail, firmTeamMemberId: firm.id },
        },
      });
    }
    await tx.organizationMember.deleteMany({ where: { firmTeamMemberId: firm.id } });
    await tx.firmTeamMember.delete({ where: { id: firm.id } });
    await tx.auditLog.create({
      data: {
        organizationId: null,
        userId: input.ownerUserId,
        entityType: "FirmTeamMember",
        entityId: firm.id,
        action: "FIRM_TEAM_REMOVE",
        changes: { email: firm.invitedEmail },
      },
    });
    return { removedMemberships: memberships.length };
  });
}

/**
 * A new organisation of the account: every firm-team person who has signed
 * in joins it. Called right after organization.create. One transaction per
 * organisation; never throws (a failure is logged, and the person's next
 * sign-in adds what is missing).
 */
export async function addFirmTeamToOrganization(db: Db, ownerUserId: string, organizationId: string): Promise<number> {
  try {
    const team: FirmRow[] = await db.firmTeamMember.findMany({
      where: { ownerUserId, memberUserId: { not: null } },
    });
    if (team.length === 0) return 0;
    return await db.$transaction(async (tx: Db) => {
      const org: FirmOrg | null = await tx.organization.findFirst({
        where: { id: organizationId, ...firmOrganizationsWhere(ownerUserId) },
        select: ORG_SELECT,
      });
      if (!org) return 0;
      let added = 0;
      for (const firm of team) added += (await syncFirmMember(tx, firm, [org])).added.length;
      return added;
    });
  } catch (error) {
    logger.error("Adding the firm team to a new organisation failed", error, { organizationId });
    return 0;
  }
}

/**
 * The account `userId` stopped being an owner of `organizationId` (removed,
 * or given another role): the memberships its firm team holds there go too,
 * since the organisation is no longer one it manages.
 */
export async function removeFirmTeamFromOrganization(
  db: Db,
  ownerUserId: string,
  organizationId: string,
  actorUserId: string
): Promise<number> {
  if (typeof db.organizationMember?.findMany !== "function") return 0;
  const memberships: Array<{ id: string; firmTeamMemberId: string | null }> =
    (await db.organizationMember.findMany({
      where: { organizationId, firmTeamMember: { ownerUserId } },
      select: { id: true, firmTeamMemberId: true },
    })) ?? [];
  if (memberships.length === 0) return 0;
  for (const m of memberships) {
    await db.auditLog.create({
      data: {
        organizationId,
        userId: actorUserId,
        entityType: "OrganizationMember",
        entityId: m.id,
        action: "FIRM_TEAM_REMOVE",
        changes: { firmTeamMemberId: m.firmTeamMemberId, reason: "owner_left" },
      },
    });
  }
  await db.organizationMember.deleteMany({ where: { id: { in: memberships.map((m) => m.id) } } });
  return memberships.length;
}

/**
 * At sign-in: firm-team invitations for this address are accepted, and every
 * firm team the person belongs to is brought up to date (an organisation
 * skipped earlier under the hosted pilot's organisations-per-account rule is
 * added once there is room). Never throws.
 */
export async function acceptFirmTeamInvitations(
  db: Db,
  userId: string,
  email: string | null | undefined
): Promise<number> {
  let added = 0;
  try {
    const address = email ? normEmail(email) : null;
    const rows: FirmRow[] = await db.firmTeamMember.findMany({
      where: {
        OR: [{ memberUserId: userId }, ...(address ? [{ memberUserId: null, invitedEmail: address }] : [])],
      },
    });
    for (const row of rows) {
      if (row.ownerUserId === userId) continue;
      let firm = row;
      if (!row.memberUserId) {
        firm = await db.firmTeamMember.update({
          where: { id: row.id },
          data: { memberUserId: userId, acceptedAt: new Date() },
        });
      }
      const orgs = await firmOrganizations(db, firm.ownerUserId);
      added += (await syncFirmMember(db, firm, orgs, { actorUserId: userId })).added.length;
    }
  } catch (error) {
    logger.error("Accepting firm team invitations failed during sign-in", error);
  }
  return added;
}
