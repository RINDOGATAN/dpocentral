"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What the signed-in person's role in the current organisation lets them do,
 * for showing or hiding actions. It mirrors the server's procedures
 * (src/server/trpc.ts): writer = everyone except VIEWER, officer = OWNER /
 * ADMIN / PRIVACY_OFFICER, admin = OWNER / ADMIN. The server still decides;
 * this only stops the screens offering what it would refuse. While the role
 * is not known yet every action is shown, so nobody's buttons flicker away.
 */
import { useOrganization } from "@/lib/organization-context";

export interface OrgRoleAbilities {
  role: string | undefined;
  canWrite: boolean;
  isOfficer: boolean;
  isAdmin: boolean;
}

export function abilitiesFor(role: string | undefined): OrgRoleAbilities {
  if (!role) return { role, canWrite: true, isOfficer: true, isAdmin: true };
  return {
    role,
    canWrite: role !== "VIEWER",
    isOfficer: role === "OWNER" || role === "ADMIN" || role === "PRIVACY_OFFICER",
    isAdmin: role === "OWNER" || role === "ADMIN",
  };
}

export function useOrgRole(): OrgRoleAbilities {
  const { organization, organizations } = useOrganization();
  const role = organization
    ? (organizations.find((o) => o.id === organization.id) as { role?: string } | undefined)?.role
    : undefined;
  return abilitiesFor(role);
}
