"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useOrganization } from "@/lib/organization-context";
import { canReadAuditTrail } from "@/lib/audit-access";

/**
 * Whether the signed-in member reads the audit trail of the current
 * organisation (src/lib/audit-access.ts). The role is read from the list of
 * the member's organisations, which carries it, as useDsarAccess does.
 *
 * `canRead` is null while the list loads, so the menu entry never flickers in
 * and out; the server enforces the rule either way.
 */
export function useAuditAccess(): { canRead: boolean | null } {
  const { organization, organizations, isLoading } = useOrganization();
  if (!organization) return { canRead: isLoading ? null : false };
  const role = (organizations.find((o) => o.id === organization.id) as { role?: string } | undefined)?.role;
  if (role === undefined) return { canRead: isLoading ? null : false };
  return { canRead: canReadAuditTrail(role) };
}
