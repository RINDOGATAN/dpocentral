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
