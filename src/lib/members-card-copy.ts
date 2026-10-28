// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which wording the Settings "Team members" card uses.
 *
 * An invitation is added to the selected organisation only (organization.addMember
 * with that organizationId). For an account that works across several
 * organisations, the card names the selected organisation so it is clear that
 * the person added joins that organisation and no other. A business account
 * with a single organisation keeps the generic team wording.
 */
export function membersCardIsScoped(userType: string | null | undefined, organizationCount: number): boolean {
  return userType === "PRIVACY_PROFESSIONAL" || organizationCount > 1;
}

export type MembersKey = "title" | "descriptionAdmin" | "inviteLabel" | "inviteHelp";

/** Message key under pages.settings.members for the given variant. */
export function membersCardKey(key: MembersKey, scoped: boolean): MembersKey | `scoped.${MembersKey}` {
  return scoped ? `scoped.${key}` : key;
}

type CardMember = {
  firmTeamMemberId?: string | null;
  firmTeamMember?: { ownerUserId: string; owner: { name: string | null; email: string } | null } | null;
};

export type FirmGroup<M> = { ownerUserId: string; ownerName: string; members: M[] };

/**
 * The members card lists memberships that came from a firm team apart from
 * the organisation's own members, one group per team, named after the
 * account that owns it. Those memberships are changed only from that
 * account's firm team (enforced in organization.updateMember / removeMember).
 */
export function splitFirmMembers<M extends CardMember>(members: M[]): { own: M[]; firmGroups: FirmGroup<M>[] } {
  const own: M[] = [];
  const groups = new Map<string, FirmGroup<M>>();
  for (const m of members) {
    const team = m.firmTeamMemberId ? m.firmTeamMember : null;
    if (!team) {
      own.push(m);
      continue;
    }
    let group = groups.get(team.ownerUserId);
    if (!group) {
      group = {
        ownerUserId: team.ownerUserId,
        ownerName: team.owner?.name || team.owner?.email || "",
        members: [],
      };
      groups.set(team.ownerUserId, group);
    }
    group.members.push(m);
  }
  return { own, firmGroups: [...groups.values()] };
}
